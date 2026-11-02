/**
 * Unlimited Agent — Connections (workspace admins): the client links their own GitHub, Odoo.sh, CICDoo and
 * servers to their workspace. Secrets are stored on the server for this workspace only and never shown again.
 * Design preview: demo data until the per-workspace connection API lands.
 */
import { Check, CircleAlert, CircleCheck, Cloud, Copy, FolderGit2, KeyRound, Link2, Plug, RefreshCw, Server, ShieldCheck } from "lucide-react";
import * as React from "react";

import { cn } from "@/shared/lib/cn";
import { Button } from "@/shared/ui/button";

type Kind = "github" | "odoosh" | "cicdoo" | "server";
type State = "connected" | "attention" | "off";

type Conn = {
  kind: Kind;
  name: string;
  what: string;
  icon: React.ComponentType<{ className?: string }>;
  state: State;
  detail: string;
  checked?: string;
};

const DEMO: Conn[] = [
  { kind: "github", name: "GitHub", what: "Repositories the employees may push to (staging branches only)", icon: FolderGit2,
    state: "connected", detail: "acme-trading · 3 repositories", checked: "2 minutes ago" },
  { kind: "odoosh", name: "Odoo.sh", what: "Projects, branches, builds and logs", icon: Cloud,
    state: "attention", detail: "Session needs renewing", checked: "1 hour ago" },
  { kind: "cicdoo", name: "CICDoo", what: "Your own servers managed on CICDoo", icon: Plug, state: "off", detail: "Not connected" },
  { kind: "server", name: "Own server", what: "A staging server you run yourself, reached over SSH", icon: Server,
    state: "off", detail: "Not connected" },
];

const STATE: Record<State, { label: string; tone: string; dot: string }> = {
  connected: { label: "Connected", tone: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300", dot: "bg-emerald-500" },
  attention: { label: "Needs attention", tone: "bg-amber-500/10 text-amber-700 dark:text-amber-300", dot: "bg-amber-500" },
  off: { label: "Not connected", tone: "bg-muted text-muted-foreground", dot: "bg-muted-foreground/60" },
};

const field =
  "h-9 w-full rounded-md border border-border/70 bg-background px-3 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring";

function Badge({ state }: { state: State }) {
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

function GithubPanel({ c }: { c: Conn }) {
  return (
    <div className="space-y-4">
      <Section
        action={<Button className="h-8 text-xs" size="sm" type="button" variant="outline">Choose repositories</Button>}
        hint={`Signed in as ${c.detail.split(" ·")[0]}, checked ${c.checked}`}
        title="Repositories"
      >
        <ul className="divide-y divide-border/50">
          {[
            ["acme-trading/odoo-erp", "staging", "main, production"],
            ["acme-trading/acme-addons", "stag", "main"],
            ["acme-trading/website", "develop", "main"],
          ].map(([repo, staging, locked]) => (
            <li className="flex items-center justify-between gap-3 py-2.5 text-sm first:pt-0 last:pb-0" key={repo}>
              <span className="min-w-0">
                <span className="block truncate font-medium text-foreground">{repo}</span>
                <span className="text-xs text-muted-foreground">
                  Employees push to <b className="font-medium text-foreground">{staging}</b>, locked: {locked}
                </span>
              </span>
              <CircleCheck className="h-4 w-4 shrink-0 text-emerald-600" />
            </li>
          ))}
        </ul>
      </Section>
      <p className="flex items-center gap-2 text-xs text-muted-foreground">
        <ShieldCheck className="h-3.5 w-3.5" /> You can remove access any time from GitHub, Settings, Applications.
      </p>
    </div>
  );
}

function OdooShPanel() {
  return (
    <div className="space-y-4">
      <Section hint="Stored on the server for this workspace only and never shown again" title="Connect your Odoo.sh session">
        <Steps
          items={[
            <>Sign in to <b>odoo.sh</b> in your browser.</>,
            <>Copy the value of the <b>session_id</b> cookie and paste it below.</>,
          ]}
        />
        <div className="mt-3 flex gap-2">
          <input autoComplete="off" className={field} placeholder="session_id" type="password" />
          <Button className="h-9 gap-1.5 text-xs" size="sm" type="button">
            <KeyRound className="h-3.5 w-3.5" /> Save
          </Button>
        </div>
      </Section>
      <p className="flex items-center gap-2 rounded-lg bg-amber-500/10 px-3 py-2 text-xs text-amber-800 dark:text-amber-200">
        <CircleAlert className="h-3.5 w-3.5" /> The saved session stopped working 1 hour ago. Paste a new one to renew it.
      </p>
    </div>
  );
}

function CicdooPanel() {
  return (
    <Section hint="Stored on the server for this workspace only and never shown again" title="Connect your CICDoo account">
      <Steps
        items={[
          <>In CICDoo open <b>Settings</b>, then <b>Security</b>, then <b>API Tokens</b>, and create a token with <b>read and actions</b>.</>,
          <>Paste it here:</>,
        ]}
      />
      <div className="mt-3 flex gap-2">
        <input autoComplete="off" className={field} placeholder="cdo_…" type="password" />
        <Button className="h-9 gap-1.5 text-xs" size="sm" type="button">
          <Link2 className="h-3.5 w-3.5" /> Connect
        </Button>
      </div>
      <div className="mt-5 border-t border-border/50 pt-4">
        <p className="mb-2 text-sm text-foreground">
          Then add this SSH key in CICDoo (<b>Settings</b>, <b>Security</b>, <b>SSH Keys</b>) so the employees can read staging logs and the
          staging database:
        </p>
        <CopyLine label="SSH public key" value="ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAI…acme unlimited-agent@acme-trading" />
      </div>
    </Section>
  );
}

function ServerPanel() {
  return (
    <Section hint="Staging only. Production servers are refused." title="Connect a staging server">
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="flex flex-col gap-1 text-xs text-muted-foreground">
          Server address
          <input className={field} placeholder="staging.acme.com" />
        </label>
        <label className="flex flex-col gap-1 text-xs text-muted-foreground">
          SSH user
          <input className={field} placeholder="odoo" />
        </label>
        <label className="flex flex-col gap-1 text-xs text-muted-foreground">
          Odoo URL
          <input className={field} placeholder="https://staging.acme.com" />
        </label>
        <label className="flex flex-col gap-1 text-xs text-muted-foreground">
          Database
          <input className={field} placeholder="acme_staging" />
        </label>
      </div>
      <div className="mt-4">
        <p className="mb-2 text-sm text-foreground">Add this key to the SSH user's authorized_keys on the server:</p>
        <CopyLine label="SSH public key" value="ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAI…acme unlimited-agent@acme-trading" />
      </div>
      <div className="mt-4 flex justify-end">
        <Button className="h-8 text-xs" size="sm" type="button">
          Test and save
        </Button>
      </div>
    </Section>
  );
}

export function ConnectionsScreen({ embedded = false }: { embedded?: boolean }) {
  const [selected, setSelected] = React.useState<Kind>("github");
  const c = DEMO.find((x) => x.kind === selected) ?? DEMO[0];
  const connected = DEMO.filter((x) => x.state === "connected").length;

  return (
    <div className={cn("w-full", !embedded && "flex h-full min-h-0")} data-testid="connections-screen">
      <main className={cn("min-w-0 flex-1", !embedded && "overflow-y-auto px-6 py-5")}>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-xl bg-muted/45 px-4 py-3">
          <div>
            <h1 className="flex items-center gap-2 text-base font-semibold text-foreground">
              <Plug className="h-4 w-4 text-muted-foreground" /> Connections
            </h1>
            <p className="text-xs text-muted-foreground">Acme Trading: link the systems your projects run on</p>
          </div>
          <span className="rounded-full border border-border/70 bg-background px-2.5 py-1 text-xs text-muted-foreground">
            Connected <b className="font-semibold text-foreground">{connected} of {DEMO.length}</b>
          </span>
        </div>

        <nav
          aria-label="Connections"
          className="mb-4 grid grid-cols-2 gap-1 rounded-xl border border-border/60 bg-muted/40 p-1 md:grid-cols-4"
          role="tablist"
        >
          {DEMO.map((x) => {
            const Icon = x.icon;
            const active = x.kind === selected;
            return (
              <button
                aria-selected={active}
                className={cn(
                  "flex min-w-0 items-center gap-2.5 rounded-lg px-3 py-2.5 text-start transition-colors",
                  active ? "bg-background shadow-sm ring-1 ring-border/70" : "hover:bg-background/60",
                )}
                data-testid={`connection-tab-${x.kind}`}
                key={x.kind}
                onClick={() => setSelected(x.kind)}
                role="tab"
                type="button"
              >
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-muted">
                  <Icon className="h-4 w-4 text-foreground" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold text-foreground">{x.name}</span>
                  <span className="mt-0.5 flex items-center gap-1.5 text-[11px] text-muted-foreground">
                    <span className={cn("h-1.5 w-1.5 shrink-0 rounded-full", STATE[x.state].dot)} />
                    <span className="truncate">{STATE[x.state].label}</span>
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
                {c.name} <Badge state={c.state} />
              </h2>
              <p className="text-sm text-muted-foreground">{c.what}</p>
              <p className="mt-0.5 text-xs text-muted-foreground/90">
                {c.detail}
                {c.checked ? `, checked ${c.checked}` : ""}
              </p>
            </div>
            {c.state === "connected" ? (
              <div className="flex gap-2">
                <Button className="h-8 gap-1.5 text-xs" size="sm" type="button" variant="outline">
                  <RefreshCw className="h-3.5 w-3.5" /> Check now
                </Button>
                <Button className="h-8 text-xs" size="sm" type="button" variant="ghost">
                  Disconnect
                </Button>
              </div>
            ) : null}
          </section>
          {c.kind === "github" ? <GithubPanel c={c} /> : null}
          {c.kind === "odoosh" ? <OdooShPanel /> : null}
          {c.kind === "cicdoo" ? <CicdooPanel /> : null}
          {c.kind === "server" ? <ServerPanel /> : null}
          <p className="flex items-start gap-2 px-1 text-xs text-muted-foreground">
            <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            Keys and tokens are stored encrypted for this workspace only. The employees never see them, and production stays locked.
          </p>
        </div>
      </main>
    </div>
  );
}
