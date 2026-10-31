//! Unlimited Agent: huddle TTS with Arabic support.
//!
//! English keeps Buzz's Pocket TTS. Text that contains Arabic script is spoken by
//! Nabra-82M (Arabic, Apache-2.0) through sherpa-onnx's Kokoro runtime. Both run
//! locally on the user's machine; nothing is sent to a cloud service. Nabra ships in
//! the Arabic voice pack installed next to the Arabic STT model (`<stt dir>/nabra`).

pub use buzz_voice_pkg::pocket::*;
pub(crate) use buzz_voice_pkg::{
    april_model_info, PocketModelArtifact, APRIL_BUNDLE_ID, APRIL_MODEL_ID, APRIL_MODEL_REVISION,
};

use buzz_voice_pkg::pocket as base;

/// Longest Arabic unit sent to Nabra in one call (characters).
const ARABIC_UNIT_CHARS: usize = 180;

pub fn has_arabic(text: &str) -> bool {
    text.chars().any(|c| {
        matches!(c, '\u{0600}'..='\u{06FF}' | '\u{0750}'..='\u{077F}' | '\u{08A0}'..='\u{08FF}'
            | '\u{FB50}'..='\u{FDFF}' | '\u{FE70}'..='\u{FEFF}')
    })
}

/// Pocket TTS for English plus an optional local Arabic engine.
pub struct PocketTts {
    inner: base::PocketTts,
    arabic: Option<sherpa_onnx::OfflineTts>,
}

pub fn load_text_to_speech(model_dir: &str) -> Result<PocketTts, String> {
    let inner = base::load_text_to_speech(model_dir)?;
    let arabic = load_arabic();
    eprintln!(
        "buzz-desktop: tts arabic={}",
        if arabic.is_some() { "ready" } else { "unavailable" }
    );
    Ok(PocketTts { inner, arabic })
}

fn load_arabic() -> Option<sherpa_onnx::OfflineTts> {
    let dir = super::models::stt_model_dir()?.join("nabra");
    let model = dir.join("model.int8.onnx");
    let voices = dir.join("voices.bin");
    let tokens = dir.join("tokens.txt");
    let data = dir.join("espeak-ng-data");
    if !(model.is_file() && voices.is_file() && tokens.is_file() && data.is_dir()) {
        return None;
    }
    let mut cfg = sherpa_onnx::OfflineTtsConfig::default();
    cfg.model.kokoro.model = Some(model.to_string_lossy().into_owned());
    cfg.model.kokoro.voices = Some(voices.to_string_lossy().into_owned());
    cfg.model.kokoro.tokens = Some(tokens.to_string_lossy().into_owned());
    cfg.model.kokoro.data_dir = Some(data.to_string_lossy().into_owned());
    cfg.model.kokoro.lang = Some("ar".to_string());
    cfg.model.kokoro.length_scale = 1.0;
    cfg.model.num_threads = std::thread::available_parallelism()
        .map(|n| (n.get() / 2).clamp(1, 4) as i32)
        .unwrap_or(2);
    cfg.model.debug = false;
    cfg.max_num_sentences = 1;
    cfg.silence_scale = 0.2;
    let tts = sherpa_onnx::OfflineTts::create(&cfg)?;
    // Warm the session so the first Arabic reply is not slow.
    let _ = generate(&tts, "مرحبا");
    Some(tts)
}

fn generate(tts: &sherpa_onnx::OfflineTts, text: &str) -> Result<Vec<f32>, String> {
    let gen = sherpa_onnx::GenerationConfig {
        sid: 0,
        speed: 1.0,
        ..Default::default()
    };
    let audio = tts
        .generate_with_config(text, &gen, None::<fn(&[f32], f32) -> bool>)
        .ok_or_else(|| "Arabic TTS generation failed".to_string())?;
    let rate = audio.sample_rate();
    let samples = audio.samples();
    if rate <= 0 || rate as u32 == SAMPLE_RATE {
        return Ok(samples.to_vec());
    }
    // Linear resample to the playback rate (Nabra is already 24 kHz; this is a safety net).
    let ratio = rate as f64 / SAMPLE_RATE as f64;
    let out_len = (samples.len() as f64 / ratio) as usize;
    Ok((0..out_len)
        .map(|i| {
            let pos = i as f64 * ratio;
            let j = pos as usize;
            let frac = (pos - j as f64) as f32;
            let a = samples.get(j).copied().unwrap_or(0.0);
            let b = samples.get(j + 1).copied().unwrap_or(a);
            a + (b - a) * frac
        })
        .collect())
}

/// Contiguous sentence units (concatenation reproduces the input), first sentence alone.
fn split_arabic(text: &str) -> Vec<String> {
    let mut sentences: Vec<String> = Vec::new();
    let mut cur = String::new();
    for c in text.chars() {
        cur.push(c);
        if matches!(c, '.' | '!' | '?' | '؟' | '؛' | '\n' | '،') && cur.chars().count() >= 12 {
            sentences.push(std::mem::take(&mut cur));
        }
    }
    if !cur.trim().is_empty() {
        sentences.push(cur);
    } else if let Some(last) = sentences.last_mut() {
        last.push_str(&cur);
    }
    let mut units: Vec<String> = Vec::new();
    for (i, s) in sentences.into_iter().enumerate() {
        match units.last_mut() {
            Some(last) if i > 1 && last.chars().count() + s.chars().count() <= ARABIC_UNIT_CHARS => {
                last.push_str(&s)
            }
            _ => units.push(s),
        }
    }
    units.retain(|u| !u.trim().is_empty());
    units
}

impl PocketTts {
    fn arabic_for(&self, text: &str) -> Option<&sherpa_onnx::OfflineTts> {
        if has_arabic(text) {
            self.arabic.as_ref()
        } else {
            None
        }
    }

    pub fn split_text_into_chunks(&self, text: &str) -> Result<Vec<String>, String> {
        if self.arabic_for(text).is_some() {
            return Ok(split_arabic(text));
        }
        self.inner.split_text_into_chunks(text)
    }

    pub fn split_text_for_playback(&self, text: &str) -> Result<Vec<String>, String> {
        if self.arabic_for(text).is_some() {
            return Ok(split_arabic(text));
        }
        self.inner.split_text_for_playback(text)
    }

    pub fn synth_chunk(
        &self,
        text: &str,
        lang: &str,
        style: &VoiceStyle,
        steps: usize,
    ) -> Result<Vec<f32>, String> {
        if let Some(tts) = self.arabic_for(text) {
            return generate(tts, text.trim());
        }
        self.inner.synth_chunk(text, lang, style, steps)
    }

    pub fn synth_chunk_streaming(
        &self,
        text: &str,
        style: &VoiceStyle,
        emit_frames: usize,
        on_audio: &mut dyn FnMut(Vec<f32>) -> bool,
    ) -> Result<bool, String> {
        if let Some(tts) = self.arabic_for(text) {
            let samples = generate(tts, text.trim())?;
            return Ok(samples.is_empty() || on_audio(samples));
        }
        self.inner.synth_chunk_streaming(text, style, emit_frames, on_audio)
    }
}
