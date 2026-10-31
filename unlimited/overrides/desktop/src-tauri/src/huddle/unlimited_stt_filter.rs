//! Unlimited Agent: clean huddle transcripts before they are posted.
//!
//! Whisper invents text on silence, breathing or background noise ("نعم. نعم. نعم.",
//! "شكرا للمشاهدة", "Thank you."). Posting those makes agents answer things nobody said,
//! so they are dropped here. Real speech passes through unchanged.

const HALLUCINATIONS: &[&str] = &[
    "شكرا للمشاهدة", "شكرا على المشاهدة", "شكرا لكم على المشاهدة", "اشتركوا في القناة",
    "اشترك في القناة", "ترجمة نانسي قنقر", "السلام عليكم ورحمة الله وبركاته",
    "thank you", "thanks for watching", "thank you for watching", "you", "bye",
    "subtitles by the amara.org community",
];

fn normalize(s: &str) -> String {
    s.chars()
        .filter(|c| c.is_alphanumeric() || c.is_whitespace())
        .collect::<String>()
        .split_whitespace()
        .collect::<Vec<_>>()
        .join(" ")
        .to_lowercase()
}

/// Returns the transcript to post, or an empty string to drop it.
pub(crate) fn clean(text: &str) -> String {
    let text = text.trim();
    let norm = normalize(text);
    let letters = norm.chars().filter(|c| c.is_alphabetic()).count();
    if letters < 2 {
        return String::new();
    }
    if HALLUCINATIONS.iter().any(|h| norm == *h) {
        return String::new();
    }
    // One short word repeated ("نعم نعم نعم", "Okay. Okay. Okay.") is noise, not speech.
    let words: Vec<&str> = norm.split_whitespace().collect();
    if words.len() >= 3 && words.iter().all(|w| *w == words[0]) {
        return String::new();
    }
    text.to_string()
}

#[cfg(test)]
mod tests {
    use super::clean;

    #[test]
    fn drops_noise_and_keeps_speech() {
        assert_eq!(clean("نعم. نعم. نعم. نعم."), "");
        assert_eq!(clean("شكرا للمشاهدة"), "");
        assert_eq!(clean("Thank you."), "");
        assert_eq!(clean("."), "");
        assert_eq!(clean("افتح موديول المخازن"), "افتح موديول المخازن");
        assert_eq!(clean("check the build on stag"), "check the build on stag");
    }
}
