/**
 * Unlimited Agent — Settings > Notifications: phone notifications from Unlimited Agent itself (APNs).
 * The owner uploads the Apple push key once; each phone that opens the app registers itself. Approvals, emails
 * waiting in the Outbox and plans that need a decision then reach the right person's phone.
 */
import { Bell, CircleAlert, KeyRound, Loader2, Smartphone } from "lucide-react";
import * as React from "react";

import { Button } from "@/shared/ui/button";

import { connectionsApi, type ConnItem } from "../connections/api";

const field =
  "h-9 w-full rounded-md border border-border/70 bg-background px-3 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring";

function errorText(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}

export function PhoneNotificationsCard() {
  const [c, setC] = React.useState<ConnItem | null>(null);
  const [owner, setOwner] = React.useState(true);
  const [f, setF] = React.useState({ p8: "", file: "", key_id: "SN8GF5647D", team_id: "93UW993K5H" });
  const [busy, setBusy] = React.useState("");
  const [msg, setMsg] = React.useState<{ ok: boolean; text: string } | null>(null);

  const load = React.useCallback(async () => {
    try {
      const o = await connectionsApi.overview();
      setC(o.items.find((x) => x.kind === "push") ?? { kind: "push", state: "off", detail: "" });
    } catch {
      setOwner(false);
    }
  }, []);
  React.useEffect(() => {
    void load();
    const onFocus = () => void load();
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [load]);

  if (!owner) return null;

  const run = async (label: string, fn: () => Promise<unknown>, ok?: string) => {
    setBusy(label);
    setMsg(null);
    try {
      await fn();
      if (ok) setMsg({ ok: true, text: ok });
      await load();
    } catch (e) {
      setMsg({ ok: false, text: errorText(e) });
    } finally {
      setBusy("");
    }
  };

  const pick = async (file: File | undefined) => {
    if (!file) return;
    const text = await file.text();
    const m = file.name.match(/AuthKey_([A-Z0-9]{10})\.p8$/i);
    setF((x) => ({ ...x, p8: text, file: file.name, key_id: m ? m[1]!.toUpperCase() : x.key_id }));
  };

  const on = c?.state === "connected";
  return (
    <section className="mb-6 overflow-hidden rounded-xl border border-border/60 bg-background" data-testid="phone-notifications">
      <header className="flex items-start justify-between gap-3 border-b border-border/60 px-4 py-3">
        <div className="min-w-0">
          <h3 className="flex items-center gap-2 text-sm font-semibold text-foreground">
            <Smartphone className="h-4 w-4 text-muted-foreground" /> Phone notifications
          </h3>
          <p className="text-xs text-muted-foreground">
            Approvals, emails waiting for you and plans that need a decision reach your phone from Unlimited Agent.
          </p>
        </div>
        {c ? (
          <span
            className={
              on
                ? "rounded-full bg-emerald-500/10 px-2 py-0.5 text-[11px] font-medium text-emerald-700 dark:text-emerald-300"
                : "rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground"
            }
          >
            {on ? "On" : "Off"}
          </span>
        ) : (
          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
        )}
      </header>
      <div className="space-y-3 px-4 py-4">
        {!c ? null : on ? (
          <>
            <p className="text-sm text-foreground">
              {c.phones
                ? `${c.phones} phone${c.phones === 1 ? "" : "s"} registered.`
                : "No phone registered yet. Update Unlimited Agent on your phone, open it and press Allow when it asks about notifications."}
            </p>
            {!c.phones && c.last_error ? (
              <p className="rounded-lg bg-amber-500/10 px-3 py-2 text-xs text-amber-800 dark:text-amber-200">Your phone said: {c.last_error}</p>
            ) : null}
            <p className="text-xs text-muted-foreground">Apple key {c.key_id}. Stored encrypted on your server and never shown again.</p>
            <div className="flex flex-wrap justify-end gap-2">
              <Button
                className="h-8 text-xs"
                disabled={busy !== ""}
                onClick={() => void run("off", () => connectionsApi.disconnect("push"))}
                size="sm"
                type="button"
                variant="ghost"
              >
                Turn off
              </Button>
              <Button
                className="h-8 gap-1.5 text-xs"
                disabled={busy !== ""}
                onClick={() => void run("test", () => connectionsApi.pushTest(), "Sent. Check your phone.")}
                size="sm"
                type="button"
                variant="outline"
              >
                {busy === "test" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Bell className="h-3.5 w-3.5" />} Send a test
              </Button>
            </div>
          </>
        ) : (
          <>
            <p className="text-sm text-foreground">
              Pick the Apple push key you downloaded (<b>AuthKey_SN8GF5647D.p8</b>), then press Save.
            </p>
            <div className="grid gap-3 sm:grid-cols-3">
              <label className="flex flex-col gap-1 text-xs text-muted-foreground sm:col-span-3">
                Apple key file (.p8)
                <input
                  accept=".p8"
                  className="text-sm text-foreground file:me-3 file:rounded-md file:border file:border-border/70 file:bg-background file:px-3 file:py-1.5"
                  onChange={(e) => void pick(e.target.files?.[0])}
                  type="file"
                />
                {f.file ? <span className="text-[11px] text-emerald-700">{f.file} ready</span> : null}
              </label>
              <label className="flex flex-col gap-1 text-xs text-muted-foreground">
                Key ID
                <input className={field} onChange={(e) => setF({ ...f, key_id: e.target.value })} value={f.key_id} />
              </label>
              <label className="flex flex-col gap-1 text-xs text-muted-foreground">
                Team ID
                <input className={field} onChange={(e) => setF({ ...f, team_id: e.target.value })} value={f.team_id} />
              </label>
            </div>
            <div className="flex justify-end">
              <Button
                className="h-8 gap-1.5 text-xs"
                disabled={!f.p8 || busy !== ""}
                onClick={() =>
                  void run("save", async () => {
                    await connectionsApi.save("push", { p8: f.p8, key_id: f.key_id.trim(), team_id: f.team_id.trim() });
                    setF((x) => ({ ...x, p8: "", file: "" }));
                  })
                }
                size="sm"
                type="button"
              >
                {busy === "save" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <KeyRound className="h-3.5 w-3.5" />} Save
              </Button>
            </div>
          </>
        )}
        {msg ? (
          <p
            className={
              msg.ok
                ? "rounded-lg bg-emerald-500/10 px-3 py-2 text-xs text-emerald-800 dark:text-emerald-200"
                : "flex items-start gap-2 rounded-lg bg-destructive/10 px-3 py-2 text-xs text-destructive"
            }
          >
            {msg.ok ? null : <CircleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" />} {msg.text}
          </p>
        ) : null}
      </div>
    </section>
  );
}
