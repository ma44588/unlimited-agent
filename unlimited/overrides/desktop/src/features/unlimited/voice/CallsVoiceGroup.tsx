/**
 * Unlimited Agent — Settings > Voice > Calls (design preview): the paid voice used when you call the team.
 * Listening, speaking and each employee's own voice. Keys are stored on the server only.
 */
import { Check, KeyRound } from "lucide-react";
import * as React from "react";

import { SettingsOptionGroup, SettingsOptionRow } from "@/features/settings/ui/SettingsOptionGroup";
import { cn } from "@/shared/lib/cn";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { isDemo } from "@/features/unlimited/odoo/api";

const ENGINES = [
  { id: "split", title: "Deepgram + Claude + ElevenLabs", tag: "Recommended",
    text: "Deepgram Nova-3 listens (fast on Arabic), Claude thinks (Anthropic API), ElevenLabs speaks (natural Arabic voices)." },
  { id: "realtime", title: "OpenAI Realtime", tag: "Simpler",
    text: "One service listens, thinks and speaks. Easiest to set up, weaker on Egyptian and Gulf dialects." },
  { id: "device", title: "On this device", tag: "Free",
    text: "The current Pocket TTS voice. Private and free, but robotic and English-first." },
] as const;

function KeyRow({ name, hint, ok }: { name: string; hint: string; ok: boolean }) {
  return (
    <SettingsOptionRow>
      <div className="min-w-0">
        <p className="text-sm font-medium">{name}</p>
        <p className="text-sm text-muted-foreground/70" data-settings-subcopy>{hint}</p>
      </div>
      {ok ? (
        <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-2.5 py-1 text-xs font-medium text-emerald-700 dark:text-emerald-300">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" /> Connected
        </span>
      ) : (
        <div className="flex w-72 max-w-full gap-2">
          <Input autoComplete="off" className="h-9 text-xs" placeholder="API key" type="password" />
          <Button size="sm" type="button"><KeyRound /> Save</Button>
        </div>
      )}
    </SettingsOptionRow>
  );
}

export function CallsVoiceGroup() {
  return isDemo() ? <CallsVoiceDesign /> : null; // design preview until the call service is built
}

function CallsVoiceDesign() {
  const [engine, setEngine] = React.useState<(typeof ENGINES)[number]["id"]>("split");
  return (
    <>
      <SettingsOptionGroup
        description="The voice used when you call the team or an employee. Each employee's own voice is set in its profile (Agents)."
        title="Calls with employees"
      >
        <div className="grid gap-2 p-3 md:grid-cols-3">
          {ENGINES.map((e) => (
            <button
              className={cn("rounded-lg border p-3 text-start transition-colors",
                engine === e.id ? "border-primary/60 bg-primary/5 ring-1 ring-primary/30" : "border-border/60 hover:bg-muted/40")}
              data-testid={`calls-engine-${e.id}`}
              key={e.id}
              onClick={() => setEngine(e.id)}
              type="button"
            >
              <span className="flex items-center justify-between gap-2">
                <span className="text-sm font-semibold text-foreground">{e.title}</span>
                {engine === e.id ? <Check className="h-4 w-4 text-primary" /> : (
                  <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] text-muted-foreground">{e.tag}</span>
                )}
              </span>
              <span className="mt-1 block text-xs text-muted-foreground">{e.text}</span>
            </button>
          ))}
        </div>
      </SettingsOptionGroup>
      {engine !== "device" ? (
        <SettingsOptionGroup description="Stored on the Unlimited server only. Call minutes show under Usage." title="Voice services">
          {engine === "split" ? (
            <>
              <KeyRow hint="Listening: speech to text, Arabic and English" name="Deepgram" ok />
              <KeyRow hint="Thinking: Claude answers during calls (fast, billed per call)" name="Anthropic" ok={false} />
              <KeyRow hint="Speaking: the employees' voices" name="ElevenLabs" ok={false} />
            </>
          ) : (
            <KeyRow hint="Listening, thinking and speaking in one service" name="OpenAI" ok={false} />
          )}
        </SettingsOptionGroup>
      ) : null}
    </>
  );
}
