/**
 * Unlimited Agent — Settings > AI provider.
 * Top: what the employees run on right now and how much is left. Below: each provider full width with its plan,
 * what it gives, what it does not, and (for Claude) several accounts that take over from each other.
 */
import { ArrowDown, ArrowUp, Asterisk, Bell, Check, KeyRound, Loader2, MoreHorizontal, PenLine, Plus, RefreshCw, Trash2, X } from "lucide-react";
import * as React from "react";

import { cn } from "@/shared/lib/cn";
import { Button } from "@/shared/ui/button";

import { type AiAccount, type AiAccountState, aiApi, type AiView } from "./api";

export const AiProviderIcon = Asterisk;

const field =
  "h-9 w-full rounded-md border border-border/70 bg-background px-3 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring";
const select =
  "h-8 rounded-md border border-border/70 bg-background px-2 text-xs text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring";

const pct = (v: number | null) => (v == null ? "—" : `${Math.round(v * 100)}%`);
function until(ts: number | null): string {
  if (!ts) return "—";
  const s = Math.max(0, ts - Date.now() / 1000);
  if (s < 3600) return `${Math.max(1, Math.round(s / 60))} min`;
  if (s < 86400) return `${Math.floor(s / 3600)} h ${Math.round((s % 3600) / 60)} m`;
  return `${Math.round(s / 86400)} days`;
}
function clock(ts: number | null): string {
  if (!ts) return "";
  return new Date(ts * 1000).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}
function ago(ts: number): string {
  const s = Math.max(0, Date.now() / 1000 - ts);
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.round(s / 60)} min ago`;
  if (s < 86400) return `${Math.round(s / 3600)} h ago`;
  return `${Math.round(s / 86400)} d ago`;
}
const barTone = (v: number | null) =>
  v == null ? "bg-muted" : v >= 0.9 ? "bg-red-500" : v >= 0.7 ? "bg-amber-500" : "bg-emerald-500";

function Bar({ v }: { v: number | null }) {
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
      <div className={cn("h-full rounded-full", barTone(v))} style={{ width: `${Math.min(100, Math.round((v ?? 0) * 100))}%` }} />
    </div>
  );
}

const STATE: Record<AiAccountState, { label: string; tone: string }> = {
  active: { label: "Active now", tone: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300" },
  standby: { label: "Standby", tone: "bg-sky-500/10 text-sky-700 dark:text-sky-300" },
  resting: { label: "Resting", tone: "bg-amber-500/10 text-amber-700 dark:text-amber-300" },
  invalid: { label: "Signed out", tone: "bg-red-500/10 text-red-700 dark:text-red-300" },
  error: { label: "Can't check", tone: "bg-muted text-muted-foreground" },
};
function StatePill({ a }: { a: AiAccount }) {
  const s = STATE[a.state];
  const label = a.state === "resting" && a.resting_until ? `Resting · back ${clock(a.resting_until)}` : s.label;
  return <span className={cn("whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-medium", s.tone)}>{label}</span>;
}

function Stat({ label, value, v, sub }: { label: string; value: string; v?: number | null; sub?: string }) {
  return (
    <div className="rounded-lg border border-border/60 px-3 py-2.5">
      <p className="text-[11px] text-muted-foreground">{label}</p>
      <p className="mt-0.5 text-base font-semibold text-foreground">{value}</p>
      {v !== undefined ? <div className="mt-1.5"><Bar v={v} /></div> : null}
      {sub ? <p className="mt-1 text-[11px] text-muted-foreground">{sub}</p> : null}
    </div>
  );
}

function Card({ children, className }: { children: React.ReactNode; className?: string }) {
  return <section className={cn("rounded-xl border border-border/60 bg-background p-4", className)}>{children}</section>;
}

function Column({ title, items, tone }: { title: string; items: string[]; tone: "plan" | "yes" | "no" }) {
  return (
    <div className="min-w-0">
      <p className="mb-1.5 text-[11px] font-semibold text-muted-foreground">{title}</p>
      <ul className="space-y-1">
        {items.map((it) => (
          <li className="flex gap-1.5 text-xs text-foreground" key={it}>
            {tone === "no" ? (
              <X className="mt-0.5 h-3 w-3 shrink-0 text-muted-foreground" />
            ) : (
              <Check className={cn("mt-0.5 h-3 w-3 shrink-0", tone === "yes" ? "text-emerald-600" : "text-primary")} />
            )}
            <span>{it}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function AccountMenu({ a, first, last, onAct, onToken, onRename }: {
  a: AiAccount; first: boolean; last: boolean; onAct: (body: Record<string, unknown>) => void; onToken: () => void; onRename: () => void;
}) {
  const [open, setOpen] = React.useState(false);
  const ref = React.useRef<HTMLDivElement>(null);
  React.useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false); };
    window.addEventListener("mousedown", close);
    return () => window.removeEventListener("mousedown", close);
  }, [open]);
  const item = (label: string, icon: React.ReactNode, fn: () => void, danger = false, disabled = false) => (
    <button
      className={cn("flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-xs hover:bg-muted disabled:opacity-40",
        danger ? "text-red-600" : "text-foreground")}
      disabled={disabled}
      onClick={() => { setOpen(false); fn(); }}
      type="button"
    >
      {icon}{label}
    </button>
  );
  return (
    <div className="relative" ref={ref}>
      <button aria-label="Account options" className="grid h-7 w-7 place-items-center rounded-md hover:bg-muted" onClick={() => setOpen((o) => !o)} type="button">
        <MoreHorizontal className="h-4 w-4 text-muted-foreground" />
      </button>
      {open ? (
        <div className="absolute right-0 z-20 mt-1 w-44 rounded-lg border border-border/70 bg-background p-1 shadow-lg">
          {item("Use this one now", <Check className="h-3.5 w-3.5" />, () => onAct({ action: "activate" }), false, a.state === "active" || a.state === "invalid")}
          {item("Move up", <ArrowUp className="h-3.5 w-3.5" />, () => onAct({ action: "up" }), false, first)}
          {item("Move down", <ArrowDown className="h-3.5 w-3.5" />, () => onAct({ action: "down" }), false, last)}
          {item("Rename", <PenLine className="h-3.5 w-3.5" />, onRename)}
          {item("Reconnect", <KeyRound className="h-3.5 w-3.5" />, onToken)}
          {item("Remove", <Trash2 className="h-3.5 w-3.5" />, () => {
            if (window.confirm(`Remove ${a.label}? Employees using it move to the next account.`)) onAct({ action: "remove" });
          }, true, a.state === "active")}
        </div>
      ) : null}
    </div>
  );
}

function TokenDialog({ mode, onClose, onSave }: {
  mode: { kind: "add" } | { kind: "token"; account: AiAccount };
  onClose: () => void;
  onSave: (v: { label: string; plan: string; token: string }) => Promise<void>;
}) {
  const [label, setLabel] = React.useState(mode.kind === "token" ? mode.account.label : "");
  const [plan, setPlan] = React.useState(mode.kind === "token" ? mode.account.plan : "Max");
  const [token, setToken] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState("");
  const save = async () => {
    setBusy(true);
    setError("");
    try {
      await onSave({ label: label.trim(), plan, token: token.trim() });
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/30 p-4" onMouseDown={onClose}>
      <div className="w-full max-w-md rounded-xl border border-border/70 bg-background p-5 shadow-xl" onMouseDown={(e) => e.stopPropagation()}>
        <h3 className="text-sm font-semibold text-foreground">{mode.kind === "add" ? "Add a Claude account" : `Reconnect ${mode.account.label}`}</h3>
        <ol className="mt-3 space-y-1.5 text-xs text-muted-foreground">
          <li>1. On a computer signed in to that Claude account, open Terminal.</li>
          <li>2. Run <code className="rounded bg-muted px-1 py-0.5 text-foreground">claude setup-token</code> and approve in the browser.</li>
          <li>3. Paste the token it prints below. It goes to the server only and is never shown again.</li>
        </ol>
        <div className="mt-4 space-y-2.5">
          {mode.kind === "add" ? (
            <div className="grid grid-cols-[1fr_110px] gap-2">
              <input className={field} onChange={(e) => setLabel(e.target.value)} placeholder="Name, e.g. ops@unlimited" value={label} />
              <select className={field} onChange={(e) => setPlan(e.target.value)} value={plan}>
                <option>Max</option><option>Pro</option><option>Team</option>
              </select>
            </div>
          ) : null}
          <input autoComplete="off" className={field} onChange={(e) => setToken(e.target.value)} placeholder="sk-ant-oat…" type="password" value={token} />
          {error ? <p className="text-xs text-red-600">{error}</p> : null}
        </div>
        <div className="mt-4 flex justify-end gap-2">
          <Button onClick={onClose} size="sm" variant="ghost">Cancel</Button>
          <Button disabled={busy || !token.trim() || (mode.kind === "add" && !label.trim())} onClick={() => void save()} size="sm">
            {busy ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : null}
            {mode.kind === "add" ? "Check and add" : "Check and save"}
          </Button>
        </div>
      </div>
    </div>
  );
}

export function AiProviderScreen() {
  const [v, setV] = React.useState<AiView | null>(null);
  const [error, setError] = React.useState("");
  const [busy, setBusy] = React.useState("");
  const [renaming, setRenaming] = React.useState("");
  const [dialog, setDialog] = React.useState<null | { kind: "add" } | { kind: "token"; account: AiAccount }>(null);

  const load = React.useCallback(async () => {
    try {
      setV(await aiApi.view());
      setError("");
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, []);
  React.useEffect(() => {
    void load();
    const t = window.setInterval(() => void load(), 60_000);
    return () => window.clearInterval(t);
  }, [load]);

  const run = async (label: string, fn: () => Promise<AiView>) => {
    setBusy(label);
    setError("");
    try {
      setV(await fn());
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy("");
    }
  };

  if (!v) {
    return (
      <div className="p-6 text-sm text-muted-foreground">
        {error ? <span className="text-red-600">{error}</span> : <Loader2 className="h-4 w-4 animate-spin" />}
      </div>
    );
  }

  const accounts = [...v.accounts].sort((a, b) => a.order - b.order);
  const models = v.models?.length ? v.models : [{ id: "opus", name: "Opus" }, { id: "sonnet", name: "Sonnet" }, { id: "haiku", name: "Haiku" }];
  const active = accounts.find((a) => a.id === v.active) ?? accounts[0];
  const allResting = accounts.length > 0 && accounts.every((a) => a.state !== "active" && a.state !== "standby");
  const nextBack = accounts.map((a) => a.resting_until ?? a.reset5 ?? 0).filter(Boolean).sort()[0] ?? null;
  const assign = v.settings.mode === "assign";
  const modeValue = assign ? "assign" : v.settings.return_first ? "switch-first" : "switch-stay";

  return (
    <div className="mx-auto w-full max-w-4xl space-y-4 p-6" data-testid="ai-provider-screen">
      <header>
        <h2 className="text-lg font-semibold text-foreground">AI provider</h2>
        <p className="text-sm text-muted-foreground">The AI your employees think with, how much is left, and what happens when it runs out.</p>
      </header>
      {error ? <p className="rounded-md bg-red-500/10 px-3 py-2 text-xs text-red-700">{error}</p> : null}

      {/* What runs right now */}
      <Card>
        <div className="flex items-center gap-3">
          <div className="grid h-10 w-10 place-items-center rounded-xl bg-orange-100 text-orange-700 dark:bg-orange-500/15"><Asterisk className="h-5 w-5" /></div>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-foreground">Claude · {active?.plan ?? "—"}</p>
            <p className="truncate text-xs text-muted-foreground">{active ? `${active.label}${active.checked_at ? ` · checked ${ago(active.checked_at)}` : ""}` : "No account yet"}</p>
          </div>
          <span className={cn("ml-auto rounded-full px-2.5 py-1 text-[11px] font-semibold",
            allResting ? "bg-amber-500/10 text-amber-700" : active?.state === "invalid" ? "bg-red-500/10 text-red-700" : "bg-emerald-500/10 text-emerald-700")}>
            ● {allResting ? "Limit reached" : active?.state === "invalid" ? "Signed out" : "Working"}
          </span>
          <Button disabled={!!busy} onClick={() => void run("check", aiApi.check)} size="sm" variant="outline">
            {busy === "check" ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="mr-1.5 h-3.5 w-3.5" />}Check now
          </Button>
        </div>
        <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
          <Stat label="5-hour window" v={active?.util5 ?? null} value={pct(active?.util5 ?? null)} />
          <Stat label="This week" v={active?.util7 ?? null} value={pct(active?.util7 ?? null)} />
          <Stat label="5-hour resets in" value={until(active?.reset5 ?? null)} />
          <Stat label="Week resets in" value={until(active?.reset7 ?? null)} />
        </div>
        {allResting ? (
          <p className="mt-3 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:bg-amber-500/10">
            Every account is at its limit. Employees wait and continue by themselves{nextBack ? ` around ${clock(nextBack)}` : ""}.
          </p>
        ) : null}
      </Card>

      {/* Employees */}
      <Card className="py-3">
        <div className="flex items-center justify-between">
          <p className="text-sm font-semibold text-foreground">Employees</p>
          <p className="text-xs text-muted-foreground">{assign ? "Each employee uses the account you pick" : "Auto follows the active account; pick one to keep an employee on it"}</p>
        </div>
        <div className="mt-2">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-[11px] text-muted-foreground">
                <th className="py-1.5 font-medium">Employee</th><th className="font-medium">Model</th><th className="font-medium">Account</th>
              </tr>
            </thead>
            <tbody>
              {v.employees.map((e) => (
                <tr className="border-t border-border/50" key={e.slug}>
                  <td className="py-2"><span className="font-medium text-foreground">{e.name}</span><span className="text-xs text-muted-foreground"> · {e.title}</span></td>
                  <td>
                    <select className={cn(select, "w-44")} disabled={!!busy} onChange={(ev) => void run(`m-${e.slug}`, () => aiApi.employee(e.slug, { model: ev.target.value }))} value={e.model || "sonnet"}>
                      <optgroup label="Always the newest">
                        {models.filter((m) => !m.id.startsWith("claude-")).map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
                      </optgroup>
                      <optgroup label="A fixed version">
                        {models.filter((m) => m.id.startsWith("claude-")).map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
                      </optgroup>
                      {models.some((m) => m.id === e.model) ? null : <option value={e.model}>{e.model}</option>}
                    </select>
                  </td>
                  <td>
                    <select
                      className={cn(select, "w-48")}
                      disabled={!!busy}
                      onChange={(ev) => void run(`a-${e.slug}`, () => aiApi.employee(e.slug, { account: ev.target.value }))}
                      value={assign || e.pinned ? e.account : ""}
                    >
                      {assign ? null : <option value="">Auto · {active?.label ?? "active account"}</option>}
                      {accounts.map((a) => <option key={a.id} value={a.id}>{assign ? a.label : `Always ${a.label}`}</option>)}
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="mt-3 flex items-center gap-3 border-t border-border/50 pt-3 text-xs">
          <span className="text-muted-foreground">Backup brain:</span>
          <span className="font-medium text-foreground">Codex · not available yet</span>
          <label className="ml-auto flex cursor-pointer items-center gap-1.5 text-foreground">
            <input checked={v.settings.alert} className="accent-primary" onChange={(ev) => void run("alert", () => aiApi.settings({ alert: ev.target.checked }))} type="checkbox" />
            <Bell className="h-3.5 w-3.5" />Phone alert at 80% and when it switches
          </label>
        </div>
      </Card>

      <h3 className="pt-2 text-sm font-semibold text-foreground">Providers</h3>

      {/* Claude */}
      <Card>
        <div className="flex items-center gap-3">
          <div className="grid h-10 w-10 place-items-center rounded-xl bg-orange-100 text-orange-700 dark:bg-orange-500/15"><Asterisk className="h-5 w-5" /></div>
          <div>
            <p className="text-sm font-semibold text-foreground">Claude</p>
            <p className="text-xs text-muted-foreground">Anthropic · runs every employee today</p>
          </div>
          <span className="ml-auto rounded-full bg-emerald-500/10 px-2.5 py-1 text-[11px] font-semibold text-emerald-700">
            {accounts.length} account{accounts.length === 1 ? "" : "s"}
          </span>
        </div>

        <div className="mt-4 flex items-center justify-between">
          <p className="text-xs font-semibold text-muted-foreground">Accounts · used in this order</p>
          <Button onClick={() => setDialog({ kind: "add" })} size="sm" variant="outline"><Plus className="mr-1 h-3.5 w-3.5" />Add account</Button>
        </div>
        <table className="mt-2 w-full text-sm">
          <thead>
            <tr className="text-left text-[11px] text-muted-foreground">
              <th className="w-8 py-1.5 font-medium">#</th><th className="font-medium">Account</th><th className="font-medium">Plan</th>
              <th className="w-32 font-medium">5 hours</th><th className="w-20 font-medium">Week</th><th className="font-medium">State</th><th className="w-8" />
            </tr>
          </thead>
          <tbody>
            {accounts.map((a, i) => (
              <tr className="border-t border-border/50" data-testid="ai-account" key={a.id}>
                <td className="py-2.5 text-xs text-muted-foreground">{i + 1}</td>
                <td>
                  {renaming === a.id ? (
                    <form
                      className="flex items-center gap-1"
                      onSubmit={(ev) => {
                        ev.preventDefault();
                        const label = String(new FormData(ev.currentTarget).get("label") ?? "").trim();
                        setRenaming("");
                        if (label && label !== a.label) void run(`acc-${a.id}`, () => aiApi.account(a.id, { label }));
                      }}
                    >
                      <input autoFocus className={cn(field, "h-8 w-48")} defaultValue={a.label} name="label" onBlur={(ev) => ev.currentTarget.form?.requestSubmit()} onKeyDown={(ev) => { if (ev.key === "Escape") setRenaming(""); }} />
                    </form>
                  ) : (
                    <button className="text-left font-medium text-foreground hover:underline" onClick={() => setRenaming(a.id)} title="Rename" type="button">{a.label}</button>
                  )}
                  {a.employees.length ? <p className="text-[11px] text-muted-foreground">{a.employees.length} employee{a.employees.length === 1 ? "" : "s"}</p> : null}
                  {a.error ? <p className="text-[11px] text-red-600">{a.error}</p> : null}
                </td>
                <td className="text-xs">{a.plan}</td>
                <td className="pr-3"><div className="flex items-center gap-2"><Bar v={a.util5} /><span className="w-9 text-right text-xs">{pct(a.util5)}</span></div></td>
                <td className="text-xs">{pct(a.util7)}</td>
                <td><StatePill a={a} /></td>
                <td>
                  <AccountMenu
                    a={a}
                    first={i === 0}
                    last={i === accounts.length - 1}
                    onAct={(body) => void run(`acc-${a.id}`, () => aiApi.account(a.id, body))}
                    onRename={() => setRenaming(a.id)}
                    onToken={() => setDialog({ kind: "token", account: a })}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="mt-4 grid gap-2 border-t border-border/50 pt-3 sm:grid-cols-[auto_1fr] sm:items-center">
          <span className="text-xs font-medium text-foreground">When an account runs out</span>
          <select
            className={cn(select, "w-full sm:w-auto")}
            disabled={!!busy}
            onChange={(ev) => {
              const m = ev.target.value;
              void run("mode", () => aiApi.settings(m === "assign" ? { mode: "assign" } : { mode: "switch", return_first: m === "switch-first" }));
            }}
            value={modeValue}
          >
            <option value="switch-first">Switch to the next one, go back to #1 when it resets</option>
            <option value="switch-stay">Switch to the next one and stay there</option>
            <option value="assign">I pick an account per employee (no switching)</option>
          </select>
        </div>
        <p className="mt-3 text-[11px] text-muted-foreground">
          The server checks every account every 5 minutes. Switching restarts the employees (about a minute); unfinished work continues.
          Using several subscriptions to go past one account's limit may conflict with Anthropic's terms — check before relying on it.
        </p>
        {v.events.length ? (
          <div className="mt-3 space-y-1 border-t border-border/50 pt-3">
            {v.events.slice(0, 5).map((e) => (
              <p className="text-xs text-muted-foreground" key={`${e.at}-${e.text}`}><span className="text-foreground">{ago(e.at)}</span> · {e.text}</p>
            ))}
          </div>
        ) : null}
      </Card>

      {/* Codex */}
      <Card>
        <div className="flex items-center gap-3">
          <div className="grid h-10 w-10 place-items-center rounded-xl bg-teal-100 font-bold text-teal-700 dark:bg-teal-500/15">◎</div>
          <div>
            <p className="text-sm font-semibold text-foreground">Codex</p>
            <p className="text-xs text-muted-foreground">OpenAI · ChatGPT plan or API key</p>
          </div>
          <span className="ml-auto rounded-full bg-muted px-2.5 py-1 text-[11px] font-semibold text-muted-foreground">Not available yet</span>
        </div>
        <div className="mt-4 grid gap-4 rounded-lg bg-muted/40 p-3 sm:grid-cols-3">
          <Column items={["ChatGPT Plus / Pro", "or an OpenAI API key"]} title="Plans" tone="plan" />
          <Column items={["A backup when Claude is at its limit", "GPT-5 models for chosen employees"]} title="What it would give" tone="yes" />
          <Column items={["Works with today's employees", "Shared memory with Claude sessions"]} title="Not included today" tone="no" />
        </div>
        <p className="mt-3 text-xs text-muted-foreground">{v.codex.why}</p>
      </Card>

      <Card className="border-dashed">
        <p className="text-sm font-medium text-foreground">Add another provider</p>
        <p className="text-xs text-muted-foreground">Gemini, local models and others — later.</p>
      </Card>

      {dialog ? (
        <TokenDialog
          mode={dialog}
          onClose={() => setDialog(null)}
          onSave={async ({ label, plan, token }) => {
            const next = dialog.kind === "add" ? await aiApi.add(label, plan, token) : await aiApi.account(dialog.account.id, { action: "token", token });
            setV(next);
          }}
        />
      ) : null}
    </div>
  );
}
