/**
 * Unlimited Agent — Settings > Voice > Calls with employees.
 * The call engine and the voice service keys. Keys are checked with the provider, stored encrypted on the
 * Unlimited server only, and never shown again.
 */
import { Check, KeyRound, Loader2, Trash2 } from "lucide-react";
import * as React from "react";

import { SettingsOptionGroup, SettingsOptionRow } from "@/features/settings/ui/SettingsOptionGroup";
import { cn } from "@/shared/lib/cn";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";

import { connectionsApi, type ConnItem, type VoiceProvider } from "../connections/api";
import { PhoneLineGroup } from "./PhoneLineGroup";

const ENGINES = [
  {
    id: "realtime",
    title: "Live voice (OpenAI Realtime)",
    tag: "Recommended",
    text: "Answers while you speak, like a phone call. Google Gemini Live takes over if OpenAI is down. The employee does the real work in Claude.",
  },
  {
    id: "device",
    title: "On this device",
    tag: "Free",
    text: "The current on-device voice. Private and free, but slower and English-first.",
  },
] as const;

const HINTS: Record<VoiceProvider, { hint: string; placeholder: string; needed?: boolean }> = {
  openai: { hint: "Listens and speaks during calls (gpt-realtime)", placeholder: "sk-…", needed: true },
  gemini: { hint: "Backup live voice when OpenAI is busy (Gemini Live)", placeholder: "AIza…" },
  anthropic: { hint: "Claude answers short questions during a call, billed per call", placeholder: "sk-ant-…" },
  elevenlabs: { hint: "Optional: custom voices for each employee", placeholder: "API key" },
};

function KeyRow({
  id,
  name,
  connected,
  busy,
  onSave,
  onRemove,
}: {
  id: VoiceProvider;
  name: string;
  connected: boolean;
  busy: boolean;
  onSave: (key: string) => Promise<boolean>;
  onRemove: () => void;
}) {
  const [key, setKey] = React.useState("");
  const h = HINTS[id];
  return (
    <SettingsOptionRow>
      <div className="min-w-0">
        <p className="text-sm font-medium">
          {name} {h.needed ? <span className="ml-1 rounded bg-primary/10 px-1.5 py-0.5 text-[10px] text-primary">Needed</span> : null}
        </p>
        <p className="text-sm text-muted-foreground/70" data-settings-subcopy>
          {h.hint}
        </p>
      </div>
      {connected ? (
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-2.5 py-1 text-xs font-medium text-emerald-700 dark:text-emerald-300">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" /> Connected
          </span>
          <Button aria-label={`Remove ${name} key`} disabled={busy} onClick={onRemove} size="sm" type="button" variant="ghost">
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      ) : (
        <div className="flex w-80 max-w-full gap-2">
          <Input
            autoComplete="off"
            className="h-9 text-xs"
            onChange={(e) => setKey(e.target.value)}
            placeholder={h.placeholder}
            type="password"
            value={key}
          />
          <Button
            disabled={!key.trim() || busy}
            onClick={() => void onSave(key.trim()).then((ok) => ok && setKey(""))}
            size="sm"
            type="button"
          >
            {busy ? <Loader2 className="animate-spin" /> : <KeyRound />} Save
          </Button>
        </div>
      )}
    </SettingsOptionRow>
  );
}

export function CallsVoiceGroup() {
  const [voice, setVoice] = React.useState<ConnItem | null>(null);
  const [busy, setBusy] = React.useState<string>("");
  const [error, setError] = React.useState("");

  const apply = (r: { items?: ConnItem[] }) => setVoice(r.items?.find((x) => x.kind === "voice") ?? null);
  React.useEffect(() => {
    connectionsApi
      .overview()
      .then(apply)
      .catch((e: unknown) => setError(e instanceof Error ? e.message : String(e)));
  }, []);

  const act = async (label: string, fn: () => Promise<{ items?: ConnItem[] }>): Promise<boolean> => {
    setBusy(label);
    setError("");
    try {
      apply(await fn());
      return true;
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      return false;
    } finally {
      setBusy("");
    }
  };

  const engine = voice?.engine === "device" ? "device" : "realtime";
  return (
    <>
      <SettingsOptionGroup
        description="The voice used when you call an employee. Each employee's own voice is set in its profile (Agents)."
        title="Calls with employees"
      >
        <div className="grid gap-2 p-3 md:grid-cols-2">
          {ENGINES.map((e) => (
            <button
              className={cn(
                "rounded-lg border p-3 text-start transition-colors",
                engine === e.id ? "border-primary/60 bg-primary/5 ring-1 ring-primary/30" : "border-border/60 hover:bg-muted/40",
              )}
              data-testid={`calls-engine-${e.id}`}
              disabled={!voice || busy !== ""}
              key={e.id}
              onClick={() => void act("engine", () => connectionsApi.voiceEngine(e.id))}
              type="button"
            >
              <span className="flex items-center justify-between gap-2">
                <span className="text-sm font-semibold text-foreground">{e.title}</span>
                {engine === e.id ? (
                  <Check className="h-4 w-4 text-primary" />
                ) : (
                  <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] text-muted-foreground">{e.tag}</span>
                )}
              </span>
              <span className="mt-1 block text-xs text-muted-foreground">{e.text}</span>
            </button>
          ))}
        </div>
      </SettingsOptionGroup>
      {engine === "realtime" ? (
        <SettingsOptionGroup
          description="Each key is checked with the provider, then stored encrypted on the Unlimited server. It is never shown again."
          title="Voice services"
        >
          {!voice && !error ? (
            <div className="flex items-center gap-2 p-4 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading…
            </div>
          ) : null}
          {(voice?.providers ?? []).map((p) => (
            <KeyRow
              busy={busy === p.id}
              connected={p.connected}
              id={p.id}
              key={p.id}
              name={p.name}
              onRemove={() => void act(p.id, () => connectionsApi.voiceRemove(p.id))}
              onSave={(key) => act(p.id, () => connectionsApi.voiceSave(p.id, key))}
            />
          ))}
          {error ? <p className="px-4 pb-3 text-xs text-destructive">{error}</p> : null}
        </SettingsOptionGroup>
      ) : null}
      <PhoneLineGroup />
    </>
  );
}
