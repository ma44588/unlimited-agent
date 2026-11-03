/**
 * Unlimited Agent — Connections (Settings): the workspace links its own GitHub, Odoo.sh, CICDoo and staging
 * server. Live data from the connector (/admin/connections). Secrets are sent once, stored encrypted on the
 * server for this workspace only, and never shown again.
 */
import { invoke } from "@tauri-apps/api/core";
import { openUrl } from "@tauri-apps/plugin-opener";
import { Check, CircleAlert, CircleCheck, Cloud, Copy, FolderGit2, KeyRound, Link2, Loader2, Mail, Plug, RefreshCw, Server, ShieldCheck } from "lucide-react";
import * as React from "react";

import { cn } from "@/shared/lib/cn";
import { Button } from "@/shared/ui/button";

import { isDemo } from "../odoo/api";
import { connectionsApi, type ConnItem, type ConnKind, type ConnState } from "./api";

type TabKind = Exclude<ConnKind, "voice" | "company_odoo" | "push">;
const META: Record<TabKind, { name: string; what: string; icon: React.ComponentType<{ className?: string }> }> = {
  github: { name: "GitHub", what: "Repositories the employees may push to (staging branches only)", icon: FolderGit2 },
  odoosh: { name: "Odoo.sh", what: "Projects, branches, builds and logs", icon: Cloud },
  cicdoo: { name: "CICDoo", what: "Your own servers managed on CICDoo", icon: Plug },
  server: { name: "Own server", what: "A staging server you run yourself, reached over SSH", icon: Server },
  email: { name: "Email", what: "The team mailbox the employees read and write from (you approve every send)", icon: Mail },
};
const ORDER: TabKind[] = ["github", "odoosh", "cicdoo", "server", "email"];

const STATE: Record<ConnState, { label: string; tone: string; dot: string }> = {
  connected: { label: "Connected", tone: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300", dot: "bg-emerald-500" },
  attention: { label: "Needs attention", tone: "bg-amber-500/10 text-amber-700 dark:text-amber-300", dot: "bg-amber-500" },
  off: { label: "Not connected", tone: "bg-muted text-muted-foreground", dot: "bg-muted-foreground/60" },
};

const field =
  "h-9 w-full rounded-md border border-border/70 bg-background px-3 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring";

function ago(iso?: string): string {
  if (!iso) return "";
  const s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.round(s / 60)} min ago`;
  if (s < 86400) return `${Math.round(s / 3600)} h ago`;
  return `${Math.round(s / 86400)} d ago`;
}

function Badge({ state }: { state: ConnState }) {
  const s = STATE[state];
  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-medium", s.tone)}>
      <span className={cn("h-1.5 w-1.5 rounded-full", s.dot)} />
      {s.label}
    </span>
  );
}

function Section({ title, hint, children, action }: { title: string; hint?: string; children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <section className="overflow-hidden rounded-xl border border-border/60 bg-background">
      <header className="flex items-center justify-between gap-2 border-b border-border/60 px-4 py-2.5">
        <div className="min-w-0">
          <h3 className="text-sm font-semibold text-foreground">{title}</h3>
          {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
        </div>
        {action}
      </header>
      <div className="px-4 py-4">{children}</div>
    </section>
  );
}

function Steps({ items }: { items: React.ReactNode[] }) {
  return (
    <ol className="space-y-2.5">
      {items.map((it, i) => (
        <li className="flex gap-3 text-sm text-foreground" key={i}>
          <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[11px] font-semibold text-primary">
            {i + 1}
          </span>
          <span className="min-w-0 flex-1">{it}</span>
        </li>
      ))}
    </ol>
  );
}

function CopyLine({ value, label }: { value: string; label: string }) {
  const [done, setDone] = React.useState(false);
  return (
    <div className="flex items-center gap-2">
      <code aria-label={label} className="min-w-0 flex-1 truncate rounded-md border border-border/60 bg-muted/40 px-2.5 py-2 text-xs">
        {value}
      </code>
      <Button
        className="h-8 gap-1.5 text-xs"
        onClick={() => void navigator.clipboard?.writeText(value).then(() => setDone(true))}
        size="sm"
        type="button"
        variant="outline"
      >
        {done ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />} {done ? "Copied" : "Copy"}
      </Button>
    </div>
  );
}

type Run = (label: string, fn: () => Promise<unknown>) => Promise<void>;
type PanelProps = { c: ConnItem; run: Run; busy: string };

function Note({ tone, children }: { tone: "warn" | "error"; children: React.ReactNode }) {
  return (
    <p
      className={cn(
        "flex items-start gap-2 rounded-lg px-3 py-2 text-xs",
        tone === "warn" ? "bg-amber-500/10 text-amber-800 dark:text-amber-200" : "bg-destructive/10 text-destructive",
      )}
    >
      <CircleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" /> <span>{children}</span>
    </p>
  );
}

function Spin({ on, icon }: { on: boolean; icon: React.ReactNode }) {
  return on ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <>{icon}</>;
}

// ------------------------------------------------------------------ GitHub
function GithubPanel({ c, run, busy }: PanelProps) {
  const start = () =>
    run("github", async () => {
      const r = await connectionsApi.githubStart();
      await openUrl(r.url);
    });
  const viaApp = c.method === "app";
  return (
    <div className="space-y-4">
      {!viaApp ? (
        <Section
          hint="GitHub opens in your browser. Choose the repositories, then come back here."
          title={c.state === "off" ? "Connect GitHub" : "Install the Unlimited Agent app"}
        >
          <Steps
            items={[
              <>Press <b>Connect GitHub</b>. GitHub shows its own page for the <b>Unlimited Agent</b> app.</>,
              <>Pick <b>Only select repositories</b>, choose the ones the employees should work on, then press <b>Install</b>.</>,
              <>Come back here. The repositories appear below.</>,
            ]}
          />
          <div className="mt-4 flex justify-end">
            <Button className="h-8 gap-1.5 text-xs" disabled={busy === "github"} onClick={() => void start()} size="sm" type="button">
              <Spin icon={<Link2 className="h-3.5 w-3.5" />} on={busy === "github"} /> Connect GitHub
            </Button>
          </div>
        </Section>
      ) : null}
      {c.repos && c.repos.length ? (
        <Section
          action={
            viaApp ? (
              <Button className="h-8 text-xs" disabled={busy === "github"} onClick={() => void start()} size="sm" type="button" variant="outline">
                Choose repositories
              </Button>
            ) : undefined
          }
          hint={`${viaApp ? "Through the Unlimited Agent app" : "Through the server's GitHub account"} as ${c.account ?? "?"}`}
          title="Repositories"
        >
          <ul className="divide-y divide-border/50">
            {c.repos.map((r) => (
              <li className="flex items-center justify-between gap-3 py-2.5 text-sm first:pt-0 last:pb-0" key={r.full_name}>
                <span className="min-w-0">
                  <span className="block truncate font-medium text-foreground">{r.full_name}</span>
                  <span className="text-xs text-muted-foreground">
                    {r.ok === false ? "No write access" : "Employees push to staging branches only"}
                  </span>
                </span>
                {r.ok === false ? (
                  <CircleAlert className="h-4 w-4 shrink-0 text-amber-600" />
                ) : (
                  <CircleCheck className="h-4 w-4 shrink-0 text-emerald-600" />
                )}
              </li>
            ))}
          </ul>
        </Section>
      ) : null}
      {c.state === "attention" && c.detail ? <Note tone="warn">{c.detail}</Note> : null}
      <p className="flex items-center gap-2 text-xs text-muted-foreground">
        <ShieldCheck className="h-3.5 w-3.5" /> You can remove access any time from GitHub, Settings, Applications.
      </p>
    </div>
  );
}

// ------------------------------------------------------------------ Odoo.sh
function OdooShPanel({ c, run, busy }: PanelProps) {
  const [session, setSession] = React.useState("");
  const save = () =>
    run("odoosh", async () => {
      const r = await connectionsApi.save("odoosh", { session: session.trim() });
      setSession("");
      return r;
    });
  const signIn = () =>
    run("odoosh", async () => {
      const value = isDemo() ? "" : await invoke<string>("unlimited_odoosh_signin");
      return value ? connectionsApi.save("odoosh", { session: value }) : connectionsApi.overview();
    });
  return (
    <div className="space-y-4">
      <Section
        hint="Your password goes only to Odoo. The session is stored on the server for this workspace and never shown again."
        title={c.state === "connected" ? "Sign in to Odoo.sh again" : "Sign in to Odoo.sh"}
      >
        <Steps
          items={[
            <>Press <b>Sign in to Odoo.sh</b>. The real odoo.sh sign-in page opens in a small window.</>,
            <>Sign in as usual. When your projects appear, the window closes by itself and Odoo.sh shows as connected.</>,
          ]}
        />
        <div className="mt-4 flex justify-end">
          <Button className="h-9 gap-1.5 text-xs" disabled={busy === "odoosh"} onClick={() => void signIn()} size="sm" type="button">
            <Spin icon={<Cloud className="h-3.5 w-3.5" />} on={busy === "odoosh"} /> Sign in to Odoo.sh
          </Button>
        </div>
        <p className="mt-4 border-t border-border/50 pt-3 text-xs text-muted-foreground">Or paste the session_id cookie yourself:</p>
        <div className="mt-2 flex gap-2">
          <input
            autoComplete="off"
            className={field}
            onChange={(e) => setSession(e.target.value)}
            placeholder="session_id"
            type="password"
            value={session}
          />
          <Button className="h-9 gap-1.5 text-xs" disabled={!session.trim() || busy === "odoosh"} onClick={() => void save()} size="sm" type="button">
            <Spin icon={<KeyRound className="h-3.5 w-3.5" />} on={busy === "odoosh"} /> Save
          </Button>
        </div>
        <p className="mt-3 text-xs text-muted-foreground">
          Odoo.sh renews the session while it is in use, and the server keeps the renewed one. You only sign in again after you sign out of
          Odoo.sh or change your password.
        </p>
      </Section>
      {c.state === "attention" ? <Note tone="warn">{c.detail}. Press Sign in to Odoo.sh to renew it.</Note> : null}
    </div>
  );
}

// ------------------------------------------------------------------ CICDoo
function CicdooPanel({ c, run, busy }: PanelProps) {
  const [token, setToken] = React.useState("");
  const save = () =>
    run("cicdoo", async () => {
      const r = await connectionsApi.save("cicdoo", { token: token.trim() });
      setToken("");
      return r;
    });
  return (
    <Section
      action={
        c.state !== "off" ? (
          <Button
            className="h-8 text-xs"
            disabled={busy === "cicdoo"}
            onClick={() => void run("cicdoo", () => connectionsApi.disconnect("cicdoo"))}
            size="sm"
            type="button"
            variant="ghost"
          >
            Disconnect
          </Button>
        ) : undefined
      }
      hint="Stored on the server for this workspace only and never shown again"
      title={c.state === "connected" ? "Replace the CICDoo token" : "Connect your CICDoo account"}
    >
      <Steps
        items={[
          <>In CICDoo open <b>Settings</b>, then <b>Security</b>, then <b>API Tokens</b>, and create a token with <b>read and actions</b>.</>,
          <>Paste it here:</>,
        ]}
      />
      <div className="mt-3 flex gap-2">
        <input autoComplete="off" className={field} onChange={(e) => setToken(e.target.value)} placeholder="cdo_…" type="password" value={token} />
        <Button className="h-9 gap-1.5 text-xs" disabled={!token.trim() || busy === "cicdoo"} onClick={() => void save()} size="sm" type="button">
          <Spin icon={<Link2 className="h-3.5 w-3.5" />} on={busy === "cicdoo"} /> Connect
        </Button>
      </div>
      {c.public_key ? (
        <div className="mt-5 border-t border-border/50 pt-4">
          <p className="mb-2 text-sm text-foreground">
            Then add this SSH key in CICDoo (<b>Settings</b>, <b>Security</b>, <b>SSH Keys</b>) so the employees can read staging logs and the
            staging database:
          </p>
          <CopyLine label="SSH public key" value={c.public_key} />
        </div>
      ) : null}
    </Section>
  );
}

// ------------------------------------------------------------------ Own server
function ServerPanel({ c, run, busy }: PanelProps) {
  const s = c.server;
  const [f, setF] = React.useState({
    host: s?.host ?? "",
    user: s?.user ?? "",
    port: String(s?.port ?? 22),
    odoo_url: s?.odoo_url ?? "",
    database: s?.database ?? "",
  });
  const input = (k: keyof typeof f, label: string, ph: string) => (
    <label className="flex flex-col gap-1 text-xs text-muted-foreground">
      {label}
      <input className={field} onChange={(e) => setF({ ...f, [k]: e.target.value })} placeholder={ph} value={f[k]} />
    </label>
  );
  return (
    <Section
      action={
        c.state !== "off" ? (
          <Button
            className="h-8 text-xs"
            disabled={busy === "server"}
            onClick={() => void run("server", () => connectionsApi.disconnect("server"))}
            size="sm"
            type="button"
            variant="ghost"
          >
            Disconnect
          </Button>
        ) : undefined
      }
      hint="Staging only. Never register a production server here."
      title={c.state === "connected" ? "Staging server" : "Connect a staging server"}
    >
      <div className="grid gap-3 sm:grid-cols-2">
        {input("host", "Server address", "staging.example.com")}
        {input("user", "SSH user", "odoo")}
        {input("odoo_url", "Odoo URL", "https://staging.example.com")}
        {input("database", "Database", "example_staging")}
        {input("port", "SSH port", "22")}
      </div>
      {c.public_key ? (
        <div className="mt-4">
          <p className="mb-2 text-sm text-foreground">Add this key to the SSH user's authorized_keys on the server:</p>
          <CopyLine label="SSH public key" value={c.public_key} />
        </div>
      ) : null}
      <div className="mt-4 flex justify-end">
        <Button
          className="h-8 gap-1.5 text-xs"
          disabled={!f.host || !f.user || !f.odoo_url || busy === "server"}
          onClick={() => void run("server", () => connectionsApi.save("server", { ...f, port: Number(f.port) || 22 }))}
          size="sm"
          type="button"
        >
          <Spin icon={null} on={busy === "server"} /> Test and save
        </Button>
      </div>
    </Section>
  );
}

// ------------------------------------------------------------------ Email
function EmailPanel({ c, run, busy }: PanelProps) {
  const [f, setF] = React.useState({ address: c.address ?? "", display_name: c.display_name ?? "Unlimited Solutions", password: "" });
  const save = () =>
    run("email", async () => {
      const r = await connectionsApi.save("email", { ...f, address: f.address.trim() });
      setF((x) => ({ ...x, password: "" }));
      return r;
    });
  const domain = (f.address.split("@")[1] || "yourdomain.com").trim();
  return (
    <div className="space-y-4">
      <Section
        action={
          c.state !== "off" ? (
            <Button
              className="h-8 text-xs"
              disabled={busy === "email"}
              onClick={() => void run("email", () => connectionsApi.disconnect("email"))}
              size="sm"
              type="button"
              variant="ghost"
            >
              Disconnect
            </Button>
          ) : undefined
        }
        hint="The password is stored encrypted on the server and never shown again. The employees never see it."
        title={c.state === "off" ? "Connect the team mailbox" : "Team mailbox"}
      >
        <Steps
          items={[
            <>In Hostinger, create one mailbox for the team, for example <b>team@{domain}</b>. Don't use your personal mailbox.</>,
            <>Enter its address and password here, then press <b>Test and save</b>.</>,
            <>
              Add an <b>alias</b> for each employee that points to this mailbox (for example omar@{domain}), and put the alias in the
              employee's profile. Mail to the alias arrives here.
            </>,
          ]}
        />
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <label className="flex flex-col gap-1 text-xs text-muted-foreground">
            Mailbox address
            <input className={field} onChange={(e) => setF({ ...f, address: e.target.value })} placeholder={`team@${domain}`} value={f.address} />
          </label>
          <label className="flex flex-col gap-1 text-xs text-muted-foreground">
            Sender name
            <input className={field} onChange={(e) => setF({ ...f, display_name: e.target.value })} placeholder="Unlimited Solutions" value={f.display_name} />
          </label>
          <label className="flex flex-col gap-1 text-xs text-muted-foreground sm:col-span-2">
            Password {c.state !== "off" ? <span className="text-muted-foreground/70">(leave empty to keep the saved one)</span> : null}
            <input
              autoComplete="new-password"
              className={field}
              onChange={(e) => setF({ ...f, password: e.target.value })}
              placeholder="Mailbox password"
              type="password"
              value={f.password}
            />
          </label>
        </div>
        <p className="mt-3 text-xs text-muted-foreground">
          Server: {c.imap_host ?? "imap.hostinger.com"} (reading) and {c.smtp_host ?? "smtp.hostinger.com"} (sending).
        </p>
        <div className="mt-4 flex justify-end">
          <Button
            className="h-8 gap-1.5 text-xs"
            disabled={!f.address.trim() || (c.state === "off" && !f.password) || busy === "email"}
            onClick={() => void save()}
            size="sm"
            type="button"
          >
            <Spin icon={<Mail className="h-3.5 w-3.5" />} on={busy === "email"} /> Test and save
          </Button>
        </div>
      </Section>
      {c.state === "attention" ? <Note tone="warn">{c.detail}</Note> : null}
      <p className="flex items-center gap-2 text-xs text-muted-foreground">
        <ShieldCheck className="h-3.5 w-3.5" /> Employees can read and draft. Nothing is sent until you approve it in the Outbox.
      </p>
    </div>
  );
}

// ------------------------------------------------------------------ screen
export function ConnectionsScreen({ embedded = false }: { embedded?: boolean }) {
  const [selected, setSelected] = React.useState<TabKind>("github");
  const [items, setItems] = React.useState<ConnItem[] | null>(null);
  const [busy, setBusy] = React.useState("");
  const [error, setError] = React.useState("");

  const load = React.useCallback(async () => {
    try {
      setItems((await connectionsApi.overview()).items);
      setError("");
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, []);
  React.useEffect(() => {
    void load();
    const onFocus = () => void load();
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [load]);

  const run: Run = async (label, fn) => {
    setBusy(label);
    setError("");
    try {
      const r = (await fn()) as { items?: ConnItem[] } | undefined;
      if (r && Array.isArray(r.items)) setItems(r.items);
      else await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy("");
    }
  };

  const byKind = new Map((items ?? []).map((x) => [x.kind, x]));
  const c: ConnItem = byKind.get(selected) ?? { kind: selected, state: "off", detail: items ? "Not connected" : "Loading…" };
  const meta = META[selected];
  const connected = (items ?? []).filter((x) => x.kind !== "voice" && x.kind !== "company_odoo" && x.kind !== "push" && x.state === "connected").length;

  return (
    <div className={cn("w-full", !embedded && "flex h-full min-h-0")} data-testid="connections-screen">
      <main className={cn("min-w-0 flex-1", !embedded && "overflow-y-auto px-6 py-5")}>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-xl bg-muted/45 px-4 py-3">
          <div>
            <h1 className="flex items-center gap-2 text-base font-semibold text-foreground">
              <Plug className="h-4 w-4 text-muted-foreground" /> Connections
            </h1>
            <p className="text-xs text-muted-foreground">Link the systems your projects run on</p>
          </div>
          <span className="rounded-full border border-border/70 bg-background px-2.5 py-1 text-xs text-muted-foreground">
            Connected <b className="font-semibold text-foreground">{items ? `${connected} of ${ORDER.length}` : "…"}</b>
          </span>
        </div>

        <nav
          aria-label="Connections"
          className="mb-4 grid grid-cols-2 gap-1 rounded-xl border border-border/60 bg-muted/40 p-1 md:grid-cols-5"
          role="tablist"
        >
          {ORDER.map((kind) => {
            const x = byKind.get(kind);
            const Icon = META[kind].icon;
            const active = kind === selected;
            return (
              <button
                aria-selected={active}
                className={cn(
                  "flex min-w-0 items-center gap-2.5 rounded-lg px-3 py-2.5 text-start transition-colors",
                  active ? "bg-background shadow-sm ring-1 ring-border/70" : "hover:bg-background/60",
                )}
                data-testid={`connection-tab-${kind}`}
                key={kind}
                onClick={() => setSelected(kind)}
                role="tab"
                type="button"
              >
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-muted">
                  <Icon className="h-4 w-4 text-foreground" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold text-foreground">{META[kind].name}</span>
                  <span className="mt-0.5 flex items-center gap-1.5 text-[11px] text-muted-foreground">
                    {x ? (
                      <>
                        <span className={cn("h-1.5 w-1.5 shrink-0 rounded-full", STATE[x.state].dot)} />
                        <span className="truncate">{STATE[x.state].label}</span>
                      </>
                    ) : (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    )}
                  </span>
                </span>
              </button>
            );
          })}
        </nav>

        <div className="min-w-0 space-y-4" role="tabpanel">
          <section className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border/60 bg-background px-4 py-3.5">
            <div className="min-w-0">
              <h2 className="flex items-center gap-2 text-lg font-semibold text-foreground">
                {meta.name} {items ? <Badge state={c.state} /> : null}
              </h2>
              <p className="text-sm text-muted-foreground">{meta.what}</p>
              {c.state !== "off" ? (
                <p className="mt-0.5 text-xs text-muted-foreground/90">
                  {c.detail}
                  {c.checked_at ? `, checked ${ago(c.checked_at)}` : ""}
                </p>
              ) : null}
            </div>
            <div className="flex gap-2">
              <Button
                className="h-8 gap-1.5 text-xs"
                disabled={busy !== ""}
                onClick={() => void run("check", () => (selected === "odoosh" || selected === "email" ? connectionsApi.check(selected) : connectionsApi.overview()))}
                size="sm"
                type="button"
                variant="outline"
              >
                <RefreshCw className={cn("h-3.5 w-3.5", busy === "check" && "animate-spin")} /> Check now
              </Button>
              {selected === "github" && c.method === "app" ? (
                <Button
                  className="h-8 text-xs"
                  disabled={busy !== ""}
                  onClick={() => void run("github", () => connectionsApi.disconnect("github"))}
                  size="sm"
                  type="button"
                  variant="ghost"
                >
                  Disconnect
                </Button>
              ) : null}
            </div>
          </section>
          {error ? <Note tone="error">{error}</Note> : null}
          {items ? (
            <>
              {selected === "github" ? <GithubPanel busy={busy} c={c} run={run} /> : null}
              {selected === "odoosh" ? <OdooShPanel busy={busy} c={c} run={run} /> : null}
              {selected === "cicdoo" ? <CicdooPanel busy={busy} c={c} run={run} /> : null}
              {selected === "server" ? <ServerPanel busy={busy} c={c} key={c.server?.host ?? "new"} run={run} /> : null}
              {selected === "email" ? <EmailPanel busy={busy} c={c} key={c.address ?? "new"} run={run} /> : null}
            </>
          ) : null}
          <p className="flex items-start gap-2 px-1 text-xs text-muted-foreground">
            <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            Keys and tokens are stored encrypted for this workspace only. The employees never see them, and production stays locked.
          </p>
        </div>
      </main>
    </div>
  );
}
