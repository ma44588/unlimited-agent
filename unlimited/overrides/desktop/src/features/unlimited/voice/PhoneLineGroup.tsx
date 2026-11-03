/**
 * Unlimited Agent — Settings > Voice > Phone line: the Twilio account (so employees can call you), and the
 * phone numbers recognised as you. Each employee's own number is set in its profile (Agents > Phone).
 */
import { Check, Loader2, Phone } from "lucide-react";
import * as React from "react";

import { SettingsOptionGroup } from "@/features/settings/ui/SettingsOptionGroup";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";

import { phoneApi, type PhoneStatus } from "./phoneApi";

function errorText(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}

export function PhoneLineGroup() {
  const [st, setSt] = React.useState<PhoneStatus | null>(null);
  const [owner, setOwner] = React.useState(true);
  const [sid, setSid] = React.useState("");
  const [token, setToken] = React.useState("");
  const [mine, setMine] = React.useState("");
  const [busy, setBusy] = React.useState("");
  const [msg, setMsg] = React.useState<{ ok: boolean; text: string } | null>(null);

  React.useEffect(() => {
    phoneApi
      .status()
      .then((s) => {
        setSt(s);
        setMine(s.owner_phones.join(", "));
      })
      .catch(() => setOwner(false));
  }, []);
  if (!owner) return null;

  const run = async (label: string, fn: () => Promise<PhoneStatus>, ok: string) => {
    setBusy(label);
    setMsg(null);
    try {
      const s = await fn();
      setSt(s);
      setMsg({ ok: true, text: ok });
    } catch (e) {
      setMsg({ ok: false, text: errorText(e) });
    } finally {
      setBusy("");
    }
  };

  const numbers = Object.entries(st?.numbers ?? {});
  return (
    <SettingsOptionGroup
      description="Call your employees on real phone numbers, and let them call you when a task is done or they need you."
      title="Phone line"
    >
      <div className="space-y-4 p-4">
        <div className="space-y-1.5">
          <p className="text-sm font-semibold text-foreground">Employee numbers</p>
          {numbers.length ? (
            numbers.map(([n, slug]) => (
              <p className="flex items-center gap-2 text-sm text-foreground" key={n}>
                <Phone className="h-3.5 w-3.5 text-muted-foreground" /> {n} <span className="text-muted-foreground">answers as</span> {slug}
              </p>
            ))
          ) : (
            <p className="text-xs text-muted-foreground">No number yet. Give an employee a number in its profile (Agents &gt; Phone).</p>
          )}
        </div>

        <div className="space-y-1.5">
          <p className="text-sm font-semibold text-foreground">Your numbers</p>
          <p className="text-xs text-muted-foreground">Calls from these numbers are you: the employee takes work from them. Anyone else is treated as a caller.</p>
          <div className="flex max-w-xl gap-2">
            <Input className="h-9" onChange={(e) => setMine(e.target.value)} placeholder="+966512345678" value={mine} />
            <Button
              className="h-9"
              disabled={busy !== ""}
              onClick={() =>
                void run(
                  "mine",
                  () => phoneApi.update({ owner_phones: mine.split(/[,\s]+/).map((x) => x.trim()).filter(Boolean) }),
                  "Saved",
                )
              }
              size="sm"
              type="button"
              variant="outline"
            >
              Save
            </Button>
          </div>
        </div>

        <div className="space-y-1.5">
          <p className="flex items-center gap-2 text-sm font-semibold text-foreground">
            Twilio account {st?.twilio.connected ? <Check className="h-4 w-4 text-emerald-600" /> : null}
          </p>
          <p className="text-xs text-muted-foreground">
            {st?.twilio.connected
              ? `Connected (${st.twilio.account}). Employees can call you.`
              : "Needed so employees can call you. Copy both from the Twilio console home page."}
          </p>
          {!st?.twilio.connected ? (
            <div className="grid max-w-xl gap-2 sm:grid-cols-[1fr_1fr_auto]">
              <Input className="h-9" onChange={(e) => setSid(e.target.value)} placeholder="Account SID (AC…)" value={sid} />
              <Input autoComplete="new-password" className="h-9" onChange={(e) => setToken(e.target.value)} placeholder="Auth Token" type="password" value={token} />
              <Button
                className="h-9"
                disabled={!sid.trim() || !token.trim() || busy !== ""}
                onClick={() =>
                  void run(
                    "twilio",
                    async () => {
                      const s = await phoneApi.twilio(sid.trim(), token.trim());
                      setToken("");
                      return s;
                    },
                    "Twilio connected",
                  )
                }
                size="sm"
                type="button"
              >
                {busy === "twilio" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null} Connect
              </Button>
            </div>
          ) : null}
        </div>
        {msg ? <p className={msg.ok ? "text-xs text-emerald-700" : "text-xs text-destructive"}>{msg.text}</p> : null}
      </div>
    </SettingsOptionGroup>
  );
}
