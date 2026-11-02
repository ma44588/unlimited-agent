/**
 * Unlimited Agent — live voice call with a server employee.
 *
 * WebRTC straight to OpenAI Realtime: the offer goes through the Unlimited server, which adds the employee's
 * persona and tools and uses the owner's stored key (never sent to this app). Replies start while you speak,
 * and you can interrupt. Real work is handed to the same employee on the server (hand_off_task), and the
 * transcript is filed in the employee's calls channel when the call ends.
 */
import { Mic, MicOff, PhoneOff } from "lucide-react";
import * as React from "react";

import { odooApi, type ServerEmployee } from "@/features/unlimited/odoo/api";
import { cn } from "@/shared/lib/cn";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/shared/ui/dialog";

type Phase = "connecting" | "listening" | "speaking" | "thinking" | "ended" | "error";
type Line = { who: "you" | "them"; text: string };

const LABEL: Record<Phase, string> = {
  connecting: "Calling…",
  listening: "Listening",
  speaking: "Speaking",
  thinking: "Working on it",
  ended: "Call ended",
  error: "Call failed",
};

function useTimer(running: boolean) {
  const [secs, setSecs] = React.useState(0);
  React.useEffect(() => {
    if (!running) return;
    const t = window.setInterval(() => setSecs((s) => s + 1), 1000);
    return () => window.clearInterval(t);
  }, [running]);
  return `${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, "0")}`;
}

export function EmployeeCallDialog({ employee, onClose }: { employee: ServerEmployee | null; onClose: () => void }) {
  return (
    <Dialog onOpenChange={(o) => !o && onClose()} open={employee !== null}>
      {employee ? <CallBody employee={employee} key={employee.slug} onClose={onClose} /> : null}
    </Dialog>
  );
}

function CallBody({ employee, onClose }: { employee: ServerEmployee; onClose: () => void }) {
  const [phase, setPhase] = React.useState<Phase>("connecting");
  const [error, setError] = React.useState("");
  const [muted, setMuted] = React.useState(false);
  const [caption, setCaption] = React.useState("");
  const [lines, setLines] = React.useState<Line[]>([]);
  const [handoffs, setHandoffs] = React.useState(0);
  const pcRef = React.useRef<RTCPeerConnection | null>(null);
  const micRef = React.useRef<MediaStream | null>(null);
  const linesRef = React.useRef<Line[]>([]);
  const endedRef = React.useRef(false);
  const name = employee.person || employee.name;
  const first = name.split(" ")[0];
  const live = phase === "listening" || phase === "speaking" || phase === "thinking";
  const time = useTimer(live);

  const addLine = React.useCallback((line: Line) => {
    if (!line.text.trim()) return;
    linesRef.current = [...linesRef.current, line];
    setLines(linesRef.current);
  }, []);

  const finish = React.useCallback(() => {
    if (endedRef.current) return;
    endedRef.current = true;
    micRef.current?.getTracks().forEach((t) => t.stop());
    pcRef.current?.close();
    if (linesRef.current.length) void odooApi.callNotes(employee.slug, linesRef.current).catch(() => undefined);
  }, [employee.slug]);

  React.useEffect(() => {
    let cancelled = false;
    async function start() {
      try {
        const pc = new RTCPeerConnection();
        pcRef.current = pc;
        const audio = new Audio();
        audio.autoplay = true;
        pc.ontrack = (e) => {
          audio.srcObject = e.streams[0];
        };
        const mic = await navigator.mediaDevices.getUserMedia({
          audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
        });
        if (cancelled) {
          mic.getTracks().forEach((t) => t.stop());
          return;
        }
        micRef.current = mic;
        pc.addTrack(mic.getTracks()[0], mic);
        const dc = pc.createDataChannel("oai-events");
        const send = (ev: unknown) => {
          if (dc.readyState === "open") dc.send(JSON.stringify(ev));
        };
        dc.onopen = () => {
          setPhase("listening");
          send({
            type: "response.create",
            response: { instructions: `Answer the call: greet Mostafa in one short Egyptian Arabic sentence as ${name}.` },
          });
        };
        dc.onmessage = async (msg) => {
          let ev: Record<string, unknown>;
          try {
            ev = JSON.parse(String(msg.data)) as Record<string, unknown>;
          } catch {
            return;
          }
          const type = String(ev.type ?? "");
          if (type === "input_audio_buffer.speech_started") {
            setPhase("listening");
            setCaption("");
          } else if (type === "response.created") {
            setPhase("speaking");
          } else if (type === "response.done" || type === "output_audio_buffer.stopped") {
            setPhase((p) => (p === "thinking" ? p : "listening"));
          } else if (type === "response.output_audio_transcript.delta" || type === "response.audio_transcript.delta") {
            setCaption((c) => c + String(ev.delta ?? ""));
          } else if (type === "response.output_audio_transcript.done" || type === "response.audio_transcript.done") {
            addLine({ who: "them", text: String(ev.transcript ?? "") });
            setCaption("");
          } else if (type === "conversation.item.input_audio_transcription.completed") {
            addLine({ who: "you", text: String(ev.transcript ?? "") });
          } else if (type === "response.function_call_arguments.done" && ev.name === "hand_off_task") {
            setPhase("thinking");
            let output = "Sent to the team channel. Tell Mostafa in one sentence that you started.";
            try {
              const args = JSON.parse(String(ev.arguments ?? "{}")) as { brief?: string; project?: string };
              await odooApi.callHandoff(employee.slug, { brief: args.brief ?? "", project: args.project });
              setHandoffs((n) => n + 1);
            } catch (e) {
              output = `Could not hand it off: ${e instanceof Error ? e.message : String(e)}. Tell Mostafa briefly.`;
            }
            send({ type: "conversation.item.create", item: { type: "function_call_output", call_id: ev.call_id, output } });
            send({ type: "response.create" });
          } else if (type === "error") {
            const err = ev.error as { message?: string } | undefined;
            setError(err?.message ?? "The voice service reported an error.");
          }
        };
        pc.onconnectionstatechange = () => {
          if (pc.connectionState === "failed") {
            setError("The connection dropped.");
            setPhase("error");
          }
        };
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        const answer = await odooApi.callConnect(employee.slug, offer.sdp ?? "");
        if (cancelled) return;
        await pc.setRemoteDescription({ type: "answer", sdp: answer.sdp });
      } catch (e) {
        if (cancelled) return;
        const msg = e instanceof Error ? e.message : String(e);
        setError(
          /Permission|NotAllowed/i.test(msg)
            ? "Allow microphone access for Unlimited Agent in System Settings > Privacy & Security > Microphone."
            : msg,
        );
        setPhase("error");
        micRef.current?.getTracks().forEach((t) => t.stop());
        pcRef.current?.close();
      }
    }
    void start();
    return () => {
      cancelled = true;
      finish();
    };
  }, [addLine, employee.slug, finish, name]);

  const toggleMute = () => {
    const next = !muted;
    micRef.current?.getAudioTracks().forEach((t) => {
      t.enabled = !next;
    });
    setMuted(next);
  };

  const endCall = () => {
    finish();
    setPhase((p) => (p === "error" ? p : "ended"));
    onClose();
  };

  return (
    <DialogContent className="w-[min(440px,calc(100vw-2rem))] overflow-hidden border-0 bg-[#0c0814] p-0 text-[#f4f0fa] sm:rounded-3xl">
      <div
        className="relative flex min-h-[560px] flex-col items-center px-6 pb-6 pt-10"
        style={{
          background:
            "radial-gradient(60% 40% at 50% 0%, rgba(122,71,147,.55), transparent 70%), radial-gradient(60% 40% at 50% 100%, rgba(154,51,103,.35), transparent 70%)",
        }}
      >
        <DialogTitle className="sr-only">Call with {name}</DialogTitle>
        <DialogDescription className="sr-only">Live voice call</DialogDescription>
        <div className="relative">
          <span
            className={cn(
              "absolute inset-[-14px] rounded-full bg-[#e06aa4]/25 transition-opacity motion-safe:animate-ping",
              phase === "speaking" ? "opacity-100" : "opacity-0",
            )}
          />
          <span className="absolute inset-[-6px] rounded-full ring-2 ring-[#b06ad9]/40" />
          {employee.avatar ? (
            <img alt="" className="relative h-24 w-24 rounded-full object-cover" src={employee.avatar} />
          ) : (
            <span className="relative flex h-24 w-24 items-center justify-center rounded-full bg-gradient-to-br from-[#7A4793] to-[#9A3367] text-3xl font-extrabold">
              {name
                .split(" ")
                .slice(0, 2)
                .map((p) => p[0]?.toUpperCase() ?? "")
                .join("")}
            </span>
          )}
        </div>
        <h2 className="mt-6 text-2xl font-extrabold tracking-tight">{name}</h2>
        <p className="mt-1 text-sm text-[#b4a9c7]">{employee.title || employee.role || "Unlimited Solutions"}</p>
        <p className="mt-3 flex items-center gap-2 text-sm text-[#b4a9c7]">
          <span className={cn("h-2 w-2 rounded-full", live ? "bg-[#3ddc97]" : phase === "error" ? "bg-red-400" : "bg-[#7d7290]")} />
          {LABEL[phase]}
          {live ? <span className="tabular-nums text-[#7d7290]">· {time}</span> : null}
        </p>

        <div className="mt-6 max-h-[220px] w-full flex-1 space-y-2 overflow-y-auto rounded-2xl border border-white/10 bg-white/[0.03] p-3 text-sm">
          {lines.length === 0 && !caption ? (
            <p className="py-6 text-center text-xs text-[#7d7290]">Speak naturally. You can interrupt any time.</p>
          ) : null}
          {lines.slice(-12).map((l, i) => (
            <p className={cn("leading-relaxed", l.who === "you" ? "text-[#b4a9c7]" : "text-[#f4f0fa]")} dir="auto" key={i}>
              <b className="me-1 text-xs font-semibold text-[#7d7290]">{l.who === "you" ? "You" : first}</b>
              {l.text}
            </p>
          ))}
          {caption ? (
            <p className="leading-relaxed text-[#f4f0fa]/80" dir="auto">
              <b className="me-1 text-xs font-semibold text-[#7d7290]">{first}</b>
              {caption}
            </p>
          ) : null}
        </div>
        {handoffs ? (
          <p className="mt-3 w-full rounded-xl bg-[#3ddc97]/10 px-3 py-2 text-xs text-[#3ddc97]">
            {handoffs === 1 ? "1 task" : `${handoffs} tasks`} sent to {first} on the server. Updates come in the calls-{employee.slug} channel.
          </p>
        ) : null}
        {error ? <p className="mt-3 w-full rounded-xl bg-red-500/10 px-3 py-2 text-xs text-red-300">{error}</p> : null}

        <div className="mt-6 flex items-center gap-6">
          <button
            aria-label={muted ? "Unmute" : "Mute"}
            className={cn(
              "flex h-14 w-14 items-center justify-center rounded-full border border-white/15 transition-colors disabled:opacity-40",
              muted ? "bg-white text-[#0c0814]" : "bg-white/5 text-white hover:bg-white/10",
            )}
            disabled={!live}
            onClick={toggleMute}
            type="button"
          >
            {muted ? <MicOff className="h-6 w-6" /> : <Mic className="h-6 w-6" />}
          </button>
          <button
            aria-label={phase === "ended" || phase === "error" ? "Close" : "End call"}
            className="flex h-16 w-16 items-center justify-center rounded-full bg-[#e5484d] text-white shadow-[0_12px_30px_-10px_rgba(229,72,77,.8)] transition-transform hover:scale-105"
            onClick={endCall}
            type="button"
          >
            <PhoneOff className="h-7 w-7" />
          </button>
        </div>
      </div>
    </DialogContent>
  );
}
