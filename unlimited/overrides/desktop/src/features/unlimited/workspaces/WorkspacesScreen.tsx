/**
 * Unlimited Agent — Workspaces (owner only): every client workspace on the platform, its plan and status,
 * who is in it, open invite links, and the controls to suspend, resume or archive it.
 */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Building2, Check, Copy, Link2, Loader2, Plus, RefreshCw, ShieldCheck, Trash2 } from "lucide-react";
import * as React from "react";

import {
  type Invite,
  type Member,
  type NewInvite,
  type Plan,
  type Workspace,
  type WorkspaceDetail,
  type WorkspaceRole,
  type WorkspaceStatus,
  workspacesApi,
} from "@/features/unlimited/workspaces/api";
import { cn } from "@/shared/lib/cn";
import { Button } from "@/shared/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/shared/ui/dialog";

const STATUS: Record<WorkspaceStatus, { label: string; tone: string; dot: string }> = {
  trial: { label: "Trial", tone: "bg-sky-500/10 text-sky-700 dark:text-sky-300", dot: "bg-sky-500" },
  active: { label: "Active", tone: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300", dot: "bg-emerald-500" },
  past_due: { label: "Payment due", tone: "bg-amber-500/10 text-amber-700 dark:text-amber-300", dot: "bg-amber-500" },
  suspended: { label: "Suspended", tone: "bg-rose-500/10 text-rose-700 dark:text-rose-300", dot: "bg-rose-500" },
  archived: { label: "Archived", tone: "bg-muted text-muted-foreground", dot: "bg-muted-foreground" },
};
const ACTION: Record<WorkspaceStatus, { label: string; danger?: boolean; hint: string }> = {
  active: { label: "Resume", hint: "People can sign in again and its employees start." },
  past_due: { label: "Mark payment due", hint: "Nothing is blocked yet; the workspace shows a payment reminder." },
  suspended: { label: "Suspend", danger: true, hint: "Nobody can sign in or send messages, and its employees stop. Data is kept." },
  archived: { label: "Archive", danger: true, hint: "Closed like a suspension, and hidden from active lists. It can be restored." },
  trial: { label: "Trial", hint: "" },
};
const ROLE_HINT: Record<WorkspaceRole, string> = {
  owner: "Owns the workspace",
  admin: "Manages people and channels",
  member: "Works in channels",
  viewer: "Reads only",
};

function when(t: number): string {
  return new Date(t * 1000).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}
function ago(t: number): string {
  const d = Math.round((Date.now() / 1000 - t) / 86400);
  return d <= 0 ? "today" : d === 1 ? "yesterday" : `${d} days ago`;
}
function short(pk: string): string {
  return `${pk.slice(0, 8)}…${pk.slice(-4)}`;
}
function errorText(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}

function StatusBadge({ status }: { status: WorkspaceStatus }) {
  const s = STATUS[status];
  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-medium", s.tone)}>
      <span className={cn("h-1.5 w-1.5 rounded-full", s.dot)} />
      {s.label}
    </span>
  );
}

function Panel({ title, hint, action, children }: { title: string; hint?: string; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="overflow-hidden rounded-xl border border-border/60 bg-background">
      <header className="flex items-center justify-between gap-2 border-b border-border/60 px-4 py-2.5">
        <div className="min-w-0">
          <h3 className="text-sm font-semibold text-foreground">{title}</h3>
          {hint ? <p className="truncate text-xs text-muted-foreground">{hint}</p> : null}
        </div>
        {action}
      </header>
      {children}
    </section>
  );
}

const field = "h-8 rounded-md border border-border/70 bg-background px-2 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring";

export function WorkspacesScreen() {
  const qc = useQueryClient();
  const list = useQuery({ queryKey: ["unlimited", "workspaces"], queryFn: () => workspacesApi.list(), retry: false });
  const [selected, setSelected] = React.useState<string | null>(null);
  const [creating, setCreating] = React.useState(false);
  const rows = list.data?.workspaces ?? [];
  const current = selected ?? rows[0]?.slug ?? null;
  const counts = React.useMemo(() => {
    const c = { live: 0, closed: 0, people: 0 };
    for (const w of rows) {
      if (w.status === "suspended" || w.status === "archived") c.closed += 1;
      else c.live += 1;
      c.people += w.members;
    }
    return c;
  }, [rows]);

  return (
    <div className="flex h-full min-h-0 w-full" data-testid="workspaces-screen">
      <main className="min-w-0 flex-1 overflow-y-auto px-6 py-5">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-xl bg-muted/45 px-4 py-3">
          <h1 className="flex items-center gap-2 text-base font-semibold text-foreground">
            <Building2 className="h-4 w-4 text-muted-foreground" /> Workspaces
          </h1>
          <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <span className="rounded-full border border-border/70 bg-background px-2.5 py-1">
              Open <b className="font-semibold text-foreground">{counts.live}</b>
            </span>
            <span className="rounded-full border border-border/70 bg-background px-2.5 py-1">
              Closed <b className="font-semibold text-foreground">{counts.closed}</b>
            </span>
            <span className="rounded-full border border-border/70 bg-background px-2.5 py-1">
              People <b className="font-semibold text-foreground">{counts.people}</b>
            </span>
            <Button className="h-7 gap-1.5 px-2.5 text-xs" onClick={() => setCreating(true)} size="sm" type="button">
              <Plus className="h-3.5 w-3.5" /> New workspace
            </Button>
          </div>
        </div>

        {list.isLoading ? (
          <p className="flex items-center gap-2 py-16 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading workspaces…
          </p>
        ) : list.isError ? (
          <p className="py-16 text-sm text-muted-foreground">Workspaces are available to the platform owner only.</p>
        ) : (
          <div className="grid gap-4 lg:grid-cols-[300px_minmax(0,1fr)]">
            <nav aria-label="Workspaces" className="flex flex-col gap-1.5">
              {rows.map((w) => (
                <WorkspaceRow active={w.slug === current} key={w.id} onSelect={() => setSelected(w.slug)} w={w} />
              ))}
            </nav>
            {current ? <WorkspacePanel plans={list.data?.plans ?? []} slug={current} /> : null}
          </div>
        )}
      </main>
      {creating ? (
        <CreateWorkspaceDialog
          onClose={() => setCreating(false)}
          onCreated={(slug) => {
            setCreating(false);
            setSelected(slug);
            void qc.invalidateQueries({ queryKey: ["unlimited", "workspaces"] });
          }}
          plans={list.data?.plans ?? []}
        />
      ) : null}
    </div>
  );
}

function WorkspaceRow({ w, active, onSelect }: { w: Workspace; active: boolean; onSelect: () => void }) {
  return (
    <button
      aria-current={active ? "true" : undefined}
      className={cn(
        "flex w-full flex-col gap-1 rounded-xl border px-3.5 py-2.5 text-start transition-colors",
        active ? "border-primary/50 bg-primary/5" : "border-border/60 bg-background hover:bg-muted/40",
      )}
      onClick={onSelect}
      type="button"
    >
      <span className="flex items-center justify-between gap-2">
        <span className="truncate text-sm font-semibold text-foreground">{w.name}</span>
        <StatusBadge status={w.status} />
      </span>
      <span className="truncate text-xs text-muted-foreground">{w.host}</span>
      <span className="text-[11px] text-muted-foreground/90">
        {w.plan_name ?? w.plan_id} plan, {w.members} {w.members === 1 ? "person" : "people"}
        {w.is_home ? ", your workspace" : ""}
      </span>
    </button>
  );
}

function WorkspacePanel({ slug, plans }: { slug: string; plans: Plan[] }) {
  const qc = useQueryClient();
  const detail = useQuery({ queryKey: ["unlimited", "workspace", slug], queryFn: () => workspacesApi.get(slug), retry: false });
  const refresh = () => {
    void qc.invalidateQueries({ queryKey: ["unlimited", "workspace", slug] });
    void qc.invalidateQueries({ queryKey: ["unlimited", "workspaces"] });
  };
  const sync = useMutation({ mutationFn: () => workspacesApi.get(slug, true), onSuccess: refresh });
  const plan = useMutation({ mutationFn: (p: string) => workspacesApi.setPlan(slug, p), onSuccess: refresh });
  const [confirm, setConfirm] = React.useState<WorkspaceStatus | null>(null);

  if (detail.isLoading) {
    return (
      <p className="flex items-center gap-2 py-16 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading…
      </p>
    );
  }
  if (detail.isError || !detail.data) return <p className="py-16 text-sm text-destructive">{errorText(detail.error)}</p>;
  const w = detail.data;
  const active = w.members.filter((m) => m.status === "active");
  const seats = plans.find((p) => p.id === w.plan_id)?.seats;

  return (
    <div className="min-w-0 space-y-4">
      <section className="rounded-xl border border-border/60 bg-background px-4 py-3.5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="flex items-center gap-2 text-lg font-semibold text-foreground">
              {w.name} <StatusBadge status={w.status} />
            </h2>
            <p className="truncate text-sm text-muted-foreground">{w.host}</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Created {when(w.created_at)} on {w.cell_name ?? "cell 1"}. Status changed {ago(w.status_changed_at)}.
            </p>
          </div>
          <label className="flex items-center gap-2 text-xs text-muted-foreground">
            Plan
            <select
              aria-label="Plan"
              className={field}
              disabled={plan.isPending}
              onChange={(e) => plan.mutate(e.target.value)}
              value={w.plan_id}
            >
              {plans.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}: {p.seats} people, {p.employees} employees
                </option>
              ))}
            </select>
          </label>
        </div>
        {w.is_home ? (
          <p className="mt-3 flex items-center gap-2 rounded-lg bg-muted/50 px-3 py-2 text-xs text-muted-foreground">
            <ShieldCheck className="h-3.5 w-3.5" /> This is your own workspace. It can't be suspended or archived from here.
          </p>
        ) : (
          <div className="mt-3 flex flex-wrap gap-2">
            {w.transitions.map((t) => (
              <Button
                className="h-8 text-xs"
                key={t}
                onClick={() => setConfirm(t)}
                size="sm"
                type="button"
                variant={ACTION[t].danger ? "destructive" : "outline"}
              >
                {ACTION[t].label}
              </Button>
            ))}
          </div>
        )}
        {plan.isError ? <p className="mt-2 text-xs text-destructive">{errorText(plan.error)}</p> : null}
      </section>

      <Panel
        action={
          <Button className="h-7 gap-1.5 px-2 text-xs" disabled={sync.isPending} onClick={() => sync.mutate()} size="sm" type="button" variant="ghost">
            <RefreshCw className={cn("h-3.5 w-3.5", sync.isPending && "animate-spin")} /> Refresh from server
          </Button>
        }
        hint={seats ? `${active.length} of ${seats} seats used` : `${active.length} people`}
        title="People"
      >
        <MembersTable members={w.members} onChanged={refresh} slug={slug} />
        {sync.isError ? <p className="px-4 pb-3 text-xs text-destructive">{errorText(sync.error)}</p> : null}
      </Panel>

      <InvitesPanel invites={w.invites} onChanged={refresh} slug={slug} status={w.status} />

      <Panel hint="The last 50 changes" title="Activity">
        {w.audit.length === 0 ? (
          <p className="px-4 py-6 text-sm text-muted-foreground">No changes yet.</p>
        ) : (
          <ul className="divide-y divide-border/50">
            {w.audit.map((a, i) => (
              <li className="flex items-center justify-between gap-3 px-4 py-2 text-sm" key={`${a.ts}-${i}`}>
                <span className="min-w-0 truncate text-foreground">
                  {a.action.replace(".", " ").replace("_", " ")} <span className="text-muted-foreground">{a.target}</span>
                </span>
                <span className="shrink-0 text-xs text-muted-foreground">
                  {a.actor}, {ago(a.ts)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Panel>

      {confirm ? <StatusDialog onClose={() => setConfirm(null)} onDone={refresh} target={confirm} w={w} /> : null}
    </div>
  );
}

function MembersTable({ slug, members, onChanged }: { slug: string; members: Member[]; onChanged: () => void }) {
  const act = useMutation({
    mutationFn: (v: { pk: string; input: { do: "remove" } | { do: "role"; role: WorkspaceRole } }) => workspacesApi.member(slug, v.pk, v.input),
    onSuccess: onChanged,
  });
  const shown = members.filter((m) => m.status === "active");
  if (shown.length === 0) return <p className="px-4 py-6 text-sm text-muted-foreground">Nobody has joined yet. Send an invite link below.</p>;
  return (
    <>
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-muted/30 text-xs text-muted-foreground">
            <th className="px-4 py-2 text-start font-medium">Person</th>
            <th className="px-4 py-2 text-start font-medium">Role</th>
            <th className="px-4 py-2 text-start font-medium">Joined</th>
            <th className="px-4 py-2" />
          </tr>
        </thead>
        <tbody className="divide-y divide-border/50">
          {shown.map((m) => (
            <tr key={m.pubkey}>
              <td className="px-4 py-2">
                <p className="font-medium text-foreground">{m.display_name || short(m.pubkey)}</p>
                <p className="text-xs text-muted-foreground">{m.email || short(m.pubkey)}</p>
              </td>
              <td className="px-4 py-2">
                {m.role === "owner" ? (
                  <span className="text-xs text-muted-foreground">Owner</span>
                ) : (
                  <select
                    aria-label={`Role of ${m.display_name || short(m.pubkey)}`}
                    className={field}
                    disabled={act.isPending}
                    onChange={(e) => act.mutate({ pk: m.pubkey, input: { do: "role", role: e.target.value as WorkspaceRole } })}
                    title={ROLE_HINT[m.role]}
                    value={m.role}
                  >
                    <option value="admin">Admin</option>
                    <option value="member">Member</option>
                    <option value="viewer">Viewer</option>
                  </select>
                )}
              </td>
              <td className="px-4 py-2 text-xs text-muted-foreground">{when(m.joined_at)}</td>
              <td className="px-4 py-2 text-end">
                {m.role !== "owner" ? (
                  <Button
                    aria-label={`Remove ${m.display_name || short(m.pubkey)}`}
                    className="h-7 px-2 text-xs text-muted-foreground hover:text-destructive"
                    disabled={act.isPending}
                    onClick={() => act.mutate({ pk: m.pubkey, input: { do: "remove" } })}
                    size="sm"
                    type="button"
                    variant="ghost"
                  >
                    <Trash2 className="h-3.5 w-3.5" /> Remove
                  </Button>
                ) : null}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {act.isError ? <p className="px-4 pb-3 text-xs text-destructive">{errorText(act.error)}</p> : null}
    </>
  );
}

function InvitesPanel({ slug, invites, status, onChanged }: { slug: string; invites: Invite[]; status: WorkspaceStatus; onChanged: () => void }) {
  const [email, setEmail] = React.useState("");
  const [role, setRole] = React.useState<WorkspaceRole>("member");
  const [days, setDays] = React.useState(7);
  const [uses, setUses] = React.useState(1);
  const [fresh, setFresh] = React.useState<NewInvite | null>(null);
  const [copied, setCopied] = React.useState(false);
  const closed = status === "suspended" || status === "archived";
  const make = useMutation({
    mutationFn: () => workspacesApi.invite(slug, { email, role, days, max_uses: uses }),
    onSuccess: (r) => {
      setFresh(r);
      setCopied(false);
      setEmail("");
      onChanged();
    },
  });
  const revoke = useMutation({ mutationFn: (id: string) => workspacesApi.revokeInvite(slug, id), onSuccess: onChanged });
  const nowS = Date.now() / 1000;
  const open = invites.filter((i) => !i.revoked_at && i.expires_at > nowS);

  return (
    <Panel hint="Anyone with a link can join until it expires or is used up" title="Invite links">
      <form
        className="flex flex-wrap items-end gap-2 border-b border-border/50 px-4 py-3"
        onSubmit={(e) => {
          e.preventDefault();
          make.mutate();
        }}
      >
        <label className="flex min-w-[200px] flex-1 flex-col gap-1 text-xs text-muted-foreground">
          Email (for your records)
          <input className={field} onChange={(e) => setEmail(e.target.value)} placeholder="name@company.com" type="email" value={email} />
        </label>
        <label className="flex flex-col gap-1 text-xs text-muted-foreground">
          Role
          <select className={field} onChange={(e) => setRole(e.target.value as WorkspaceRole)} value={role}>
            <option value="member">Member</option>
            <option value="viewer">Viewer</option>
            <option value="admin">Admin</option>
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs text-muted-foreground">
          Expires in
          <select className={field} onChange={(e) => setDays(Number(e.target.value))} value={days}>
            <option value={1}>1 day</option>
            <option value={7}>7 days</option>
            <option value={30}>30 days</option>
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs text-muted-foreground">
          Uses
          <select className={field} onChange={(e) => setUses(Number(e.target.value))} value={uses}>
            <option value={1}>1 person</option>
            <option value={5}>5 people</option>
            <option value={25}>25 people</option>
          </select>
        </label>
        <Button className="h-8 gap-1.5 text-xs" disabled={closed || make.isPending} size="sm" type="submit">
          {make.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Link2 className="h-3.5 w-3.5" />} Create link
        </Button>
        {closed ? <p className="w-full text-xs text-muted-foreground">Resume the workspace to invite people.</p> : null}
        {make.isError ? <p className="w-full text-xs text-destructive">{errorText(make.error)}</p> : null}
      </form>

      {fresh ? (
        <div className="space-y-1.5 border-b border-border/50 bg-emerald-500/5 px-4 py-3">
          <p className="text-xs text-foreground">Copy this link now. For safety it's shown only once.</p>
          <div className="flex items-center gap-2">
            <code className="min-w-0 flex-1 truncate rounded-md border border-border/60 bg-background px-2 py-1.5 text-xs">{fresh.url}</code>
            <Button
              className="h-8 gap-1.5 text-xs"
              onClick={() => {
                void navigator.clipboard.writeText(fresh.url).then(() => setCopied(true));
              }}
              size="sm"
              type="button"
              variant="outline"
            >
              {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />} {copied ? "Copied" : "Copy"}
            </Button>
          </div>
        </div>
      ) : null}

      {open.length === 0 ? (
        <p className="px-4 py-5 text-sm text-muted-foreground">No open links.</p>
      ) : (
        <ul className="divide-y divide-border/50">
          {open.map((i) => (
            <li className="flex items-center justify-between gap-3 px-4 py-2 text-sm" key={i.id}>
              <span className="min-w-0">
                <span className="block truncate text-foreground">{i.email || `Link ending ${i.code_hint}`}</span>
                <span className="text-xs text-muted-foreground">
                  {i.role}, {i.max_uses === 1 ? "one person" : `up to ${i.max_uses} people`}, expires {when(i.expires_at)}
                </span>
              </span>
              <Button
                className="h-7 px-2 text-xs"
                disabled={revoke.isPending}
                onClick={() => revoke.mutate(i.id)}
                size="sm"
                type="button"
                variant="outline"
              >
                Revoke
              </Button>
            </li>
          ))}
        </ul>
      )}
      {revoke.isError ? <p className="px-4 pb-3 text-xs text-destructive">{errorText(revoke.error)}</p> : null}
    </Panel>
  );
}

function StatusDialog({ w, target, onClose, onDone }: { w: WorkspaceDetail; target: WorkspaceStatus; onClose: () => void; onDone: () => void }) {
  const [reason, setReason] = React.useState("");
  const a = ACTION[target];
  const run = useMutation({
    mutationFn: () => workspacesApi.setStatus(w.slug, target, reason),
    onSuccess: () => {
      onDone();
      onClose();
    },
  });
  return (
    <Dialog onOpenChange={(v) => !v && onClose()} open>
      <DialogContent className="w-[480px] max-w-[calc(100vw-2rem)]">
        <DialogTitle className="text-lg font-semibold">
          {a.label} {w.name}?
        </DialogTitle>
        <DialogDescription className="text-sm text-muted-foreground">{a.hint}</DialogDescription>
        <label className="flex flex-col gap-1 text-xs text-muted-foreground">
          Reason (kept in the activity log)
          <input autoFocus className={field} onChange={(e) => setReason(e.target.value)} placeholder="Invoice unpaid" value={reason} />
        </label>
        {run.isError ? <p className="text-xs text-destructive">{errorText(run.error)}</p> : null}
        <div className="flex justify-end gap-2">
          <Button onClick={onClose} size="sm" type="button" variant="ghost">
            Cancel
          </Button>
          <Button disabled={run.isPending} onClick={() => run.mutate()} size="sm" type="button" variant={a.danger ? "destructive" : "default"}>
            {run.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null} {a.label}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function CreateWorkspaceDialog({ plans, onClose, onCreated }: { plans: Plan[]; onClose: () => void; onCreated: (slug: string) => void }) {
  const [name, setName] = React.useState("");
  const [slug, setSlug] = React.useState("");
  const [touched, setTouched] = React.useState(false);
  const [plan, setPlan] = React.useState("starter");
  const [admin, setAdmin] = React.useState("");
  const [note, setNote] = React.useState<{ text: string; slug: string } | null>(null);
  const auto = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 31);
  const value = touched ? slug : auto;
  const valid = /^[a-z][a-z0-9-]{2,30}$/.test(value) && (!admin || /^[0-9a-f]{64}$/.test(admin.trim()));
  const run = useMutation({
    mutationFn: () => workspacesApi.create({ name, slug: value, plan, admin_pubkey: admin.trim(), trial: true }),
    onSuccess: (r) => (r.note ? setNote({ text: r.note, slug: r.slug }) : onCreated(r.slug)),
  });

  return (
    <Dialog onOpenChange={(v) => !v && onClose()} open>
      <DialogContent className="w-[540px] max-w-[calc(100vw-2rem)]">
        <DialogTitle className="text-lg font-semibold">New workspace</DialogTitle>
        <DialogDescription className="text-sm text-muted-foreground">
          A separate space for one client, with its own people, channels and employees. It starts as a trial.
        </DialogDescription>
        {note ? (
          <>
            <p className="rounded-lg bg-amber-500/10 px-3 py-2 text-sm text-foreground">{note.text}</p>
            <div className="flex justify-end">
              <Button onClick={() => onCreated(note.slug)} size="sm" type="button">
                Open workspace
              </Button>
            </div>
          </>
        ) : (
          <form
            className="flex flex-col gap-3"
            onSubmit={(e) => {
              e.preventDefault();
              if (valid) run.mutate();
            }}
          >
            <label className="flex flex-col gap-1 text-xs text-muted-foreground">
              Client name
              <input autoFocus className={field} onChange={(e) => setName(e.target.value)} placeholder="Acme Trading" value={name} />
            </label>
            <label className="flex flex-col gap-1 text-xs text-muted-foreground">
              Address
              <span className="flex items-center gap-1">
                <input
                  className={cn(field, "w-48")}
                  onChange={(e) => {
                    setTouched(true);
                    setSlug(e.target.value.toLowerCase());
                  }}
                  value={value}
                />
                <span className="text-sm text-muted-foreground">.unlimitedsolutions.technology</span>
              </span>
            </label>
            <label className="flex flex-col gap-1 text-xs text-muted-foreground">
              Plan
              <select className={field} onChange={(e) => setPlan(e.target.value)} value={plan}>
                {plans.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}: {p.seats} people, {p.employees} employees
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1 text-xs text-muted-foreground">
              Client admin public key (optional; you can invite them by link instead)
              <input className={cn(field, "font-mono text-xs")} onChange={(e) => setAdmin(e.target.value)} placeholder="64 hex characters" value={admin} />
            </label>
            {run.isError ? <p className="text-xs text-destructive">{errorText(run.error)}</p> : null}
            <div className="flex justify-end gap-2">
              <Button onClick={onClose} size="sm" type="button" variant="ghost">
                Cancel
              </Button>
              <Button disabled={!valid || run.isPending} size="sm" type="submit">
                {run.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null} Create workspace
              </Button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
