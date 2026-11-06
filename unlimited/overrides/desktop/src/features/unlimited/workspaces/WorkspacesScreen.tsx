/**
 * Unlimited Agent — Workspaces (owner only): every client workspace on the platform, its plan and status,
 * who is in it, open invite links, and the controls to suspend, resume or archive it.
 */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Building2, Check, ChevronLeft, ChevronRight, Copy, Link2, Loader2, MessageCircle, Plus, RefreshCw, ShieldCheck, Trash2 } from "lucide-react";
import { openUrl } from "@tauri-apps/plugin-opener";
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
import { aiApi } from "@/features/unlimited/ai/api";
import { isDemo } from "@/features/unlimited/odoo/api";
import { orgApi } from "@/features/unlimited/org/api";
import { addRelayMember } from "@/shared/api/relayMembers";
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


/** The owner sees everything; a company admin manages people but can't make admins or new workspaces. */
function useIsOwner(): boolean {
  const q = useQuery({ queryKey: ["unlimited", "workspaces"], queryFn: () => workspacesApi.list(), retry: false });
  return (q.data as { level?: string } | undefined)?.level !== "admin";
}

export function WorkspacesScreen() {
  const isOwner = useIsOwner();
  const qc = useQueryClient();
  const list = useQuery({ queryKey: ["unlimited", "workspaces"], queryFn: () => workspacesApi.list(), retry: false });
  const [selected, setSelected] = React.useState<string | null>(null);
  const [creating, setCreating] = React.useState(false);
  const rows = list.data?.workspaces ?? [];
  const plans = list.data?.plans ?? [];
  const current = selected && rows.some((w) => w.slug === selected) ? selected : null;
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
        {current ? (
          <WorkspacePanel onBack={() => setSelected(null)} plans={plans} slug={current} />
        ) : (
        <>
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
            {isOwner ? (
              <Button className="h-7 gap-1.5 px-2.5 text-xs" onClick={() => setCreating(true)} size="sm" type="button">
                <Plus className="h-3.5 w-3.5" /> New workspace
              </Button>
            ) : null}
          </div>
        </div>

        {list.isLoading ? (
          <p className="flex items-center gap-2 py-16 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading workspaces…
          </p>
        ) : list.isError ? (
          <p className="py-16 text-sm text-muted-foreground">Workspaces are available to the platform owner only.</p>
        ) : (
          <nav aria-label="Workspaces" className="flex flex-col gap-2.5">
            {rows.map((w) => (
              <WorkspaceRow key={w.id} onSelect={() => setSelected(w.slug)} plan={plans.find((p) => p.id === w.plan_id)} w={w} />
            ))}
          </nav>
        )}
        </>
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

function Initials({ name, home }: { name: string; home?: boolean }) {
  const t = name.split(/\s+/).filter(Boolean).slice(0, 2).map((x) => x[0]?.toUpperCase()).join("");
  return (
    <span
      className={cn(
        "grid h-11 w-11 shrink-0 place-items-center rounded-xl text-sm font-bold text-white",
        home ? "bg-gradient-to-br from-[#3b1f55] to-[#b23a75]" : "bg-teal-700",
      )}
    >
      {home ? "∞" : t || "W"}
    </span>
  );
}

function Stat({ value, label, warn }: { value: React.ReactNode; label: string; warn?: boolean }) {
  return (
    <span className="flex flex-col items-end">
      <b className={cn("text-[15px] font-semibold", warn ? "text-amber-600" : "text-foreground")}>{value}</b>
      <span className="text-[11px] text-muted-foreground">{label}</span>
    </span>
  );
}

function useHomeEmployees(enabled: boolean) {
  return useQuery({ queryKey: ["unlimited", "ai"], queryFn: () => aiApi.view(), enabled, retry: false, staleTime: 60_000 });
}

function WorkspaceRow({ w, plan, onSelect }: { w: Workspace; plan?: Plan; onSelect: () => void }) {
  const ai = useHomeEmployees(!!w.is_home);
  const emp = w.is_home ? ai.data?.employees.length : undefined;
  return (
    <button
      className="group flex w-full items-center gap-4 rounded-2xl border border-border/60 bg-background px-4 py-3.5 text-start transition-colors hover:border-primary/40 hover:bg-muted/30"
      data-testid="workspace-row"
      onClick={onSelect}
      type="button"
    >
      <Initials home={!!w.is_home} name={w.name} />
      <span className="min-w-0 flex-1">
        <span className="flex flex-wrap items-center gap-2">
          <span className="truncate text-[15px] font-semibold text-foreground">{w.name}</span>
          <StatusBadge status={w.status} />
          {w.is_home ? <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-medium text-primary">Your workspace</span> : null}
        </span>
        <span className="block truncate text-xs text-muted-foreground">
          {w.host} · {w.plan_name ?? w.plan_id} · created {when(w.created_at)}
        </span>
      </span>
      <span className="hidden items-center gap-7 md:flex">
        <Stat label="People" value={plan ? `${w.members} / ${plan.seats}` : w.members} />
        {emp !== undefined ? <Stat label="AI employees" value={plan ? `${emp} / ${plan.employees}` : emp} warn={!!plan && emp > plan.employees} /> : null}
        <Stat label="Open invites" value={w.invites_open} />
      </span>
      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-border/70 text-muted-foreground transition-colors group-hover:text-foreground">
        <ChevronRight className="h-4 w-4" />
      </span>
    </button>
  );
}

type Tab = "overview" | "people" | "invites" | "employees" | "activity";

function WorkspacePanel({ slug, plans, onBack }: { slug: string; plans: Plan[]; onBack: () => void }) {
  const isOwner = useIsOwner();
  const qc = useQueryClient();
  const detail = useQuery({ queryKey: ["unlimited", "workspace", slug], queryFn: () => workspacesApi.get(slug), retry: false });
  const refresh = () => {
    void qc.invalidateQueries({ queryKey: ["unlimited", "workspace", slug] });
    void qc.invalidateQueries({ queryKey: ["unlimited", "workspaces"] });
  };
  const sync = useMutation({ mutationFn: () => workspacesApi.get(slug, true), onSuccess: refresh });
  const plan = useMutation({ mutationFn: (p: string) => workspacesApi.setPlan(slug, p), onSuccess: refresh });
  const [confirm, setConfirm] = React.useState<WorkspaceStatus | null>(null);
  const [tab, setTab] = React.useState<Tab>("overview");
  const ai = useHomeEmployees(!!detail.data?.is_home);

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

  const planRow = plans.find((p) => p.id === w.plan_id);
  const nowS = Date.now() / 1000;
  const openInvites = w.invites.filter(
    (x) => !x.revoked_at && ((x.status ?? "open") === "pending" || ((x.status ?? "open") === "open" && x.expires_at > nowS)),
  );
  const waiting = w.invites.filter((x) => x.status === "pending").length;
  const employees = w.is_home ? ai.data?.employees ?? [] : null;
  const tabs: { id: Tab; label: string }[] = [
    { id: "overview", label: "Overview" },
    { id: "people", label: `People · ${active.length}` },
    { id: "invites", label: `Invites · ${openInvites.length}` },
    ...(employees ? [{ id: "employees" as Tab, label: `AI employees · ${employees.length}` }] : []),
    { id: "activity", label: "Activity" },
  ];

  return (
    <div className="min-w-0" data-testid="workspace-detail">
      <div className="flex flex-wrap items-center gap-3">
        <button
          aria-label="Back to workspaces"
          className="grid h-9 w-9 place-items-center rounded-xl border border-border/70 text-muted-foreground hover:text-foreground"
          onClick={onBack}
          type="button"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <Initials home={!!w.is_home} name={w.name} />
        <div className="min-w-0">
          <h2 className="flex items-center gap-2 text-lg font-semibold text-foreground">
            {w.name} <StatusBadge status={w.status} />
          </h2>
          <p className="truncate text-sm text-muted-foreground">{w.host}</p>
        </div>
        <label className="ml-auto flex items-center gap-2 text-xs text-muted-foreground">
          Plan
          <select aria-label="Plan" className={field} disabled={plan.isPending || !isOwner} onChange={(e) => plan.mutate(e.target.value)} value={w.plan_id}>
            {plans.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}: {p.seats} people, {p.employees} employees
              </option>
            ))}
          </select>
        </label>
      </div>
      {plan.isError ? <p className="mt-2 text-xs text-destructive">{errorText(plan.error)}</p> : null}

      <div className="mt-4 mb-4 flex gap-1 overflow-x-auto border-b border-border/60" role="tablist">
        {tabs.map((t) => (
          <button
            aria-selected={tab === t.id}
            className={cn(
              "-mb-px whitespace-nowrap border-b-2 px-3.5 py-2 text-sm transition-colors",
              tab === t.id ? "border-foreground font-semibold text-foreground" : "border-transparent text-muted-foreground hover:text-foreground",
            )}
            key={t.id}
            onClick={() => setTab(t.id)}
            role="tab"
            type="button"
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "overview" ? (
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Box label="People" sub={seats ? undefined : "no seat limit"} value={seats ? `${active.length} of ${seats}` : String(active.length)} fill={seats ? active.length / seats : undefined} />
            {employees ? (
              <Box
                fill={planRow ? employees.length / planRow.employees : undefined}
                label="AI employees"
                value={planRow ? `${employees.length} of ${planRow.employees}` : String(employees.length)}
              />
            ) : (
              <Box label="AI employees allowed" value={planRow ? String(planRow.employees) : "—"} />
            )}
            <Box label="Open invites" sub={waiting ? `${waiting} waiting for you` : openInvites.length ? "see Invites" : "none waiting"} value={String(openInvites.length)} />
            <Box label="Created" sub={`${w.cell_name ?? "cell 1"} · status changed ${ago(w.status_changed_at)}`} value={when(w.created_at)} small />
          </div>
          {w.is_home ? (
            <p className="flex items-center gap-2 rounded-xl bg-muted/50 px-3.5 py-2.5 text-sm text-muted-foreground">
              <ShieldCheck className="h-4 w-4" /> This is your own workspace. It can't be suspended or archived from here.
            </p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {w.transitions.map((t) => (
                <Button className="h-8 text-xs" key={t} onClick={() => setConfirm(t)} size="sm" type="button" variant={ACTION[t].danger ? "destructive" : "outline"}>
                  {ACTION[t].label}
                </Button>
              ))}
            </div>
          )}
          <Panel title="Latest activity" action={<Button className="h-7 px-2 text-xs" onClick={() => setTab("activity")} size="sm" type="button" variant="ghost">See all</Button>}>
            <AuditList rows={w.audit.slice(0, 4)} />
          </Panel>
        </div>
      ) : null}

      {tab === "people" ? (
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
      ) : null}

      {tab === "invites" ? <InvitesPanel home={!!w.is_home} invites={w.invites} onChanged={refresh} slug={slug} status={w.status} /> : null}

      {tab === "employees" && employees ? (
        <Panel hint={planRow ? `${employees.length} of ${planRow.employees} on the ${planRow.name} plan` : undefined} title="AI employees">
          <ul className="divide-y divide-border/50">
            {employees.map((e) => (
              <li className="flex items-center justify-between gap-3 px-4 py-2.5 text-sm" key={e.slug}>
                <span className="min-w-0 truncate">
                  <span className="font-medium text-foreground">{e.name}</span>
                  <span className="text-muted-foreground"> · {e.title}</span>
                </span>
                <span className="shrink-0 text-xs text-muted-foreground">
                  {e.model} · {e.status || "—"}
                </span>
              </li>
            ))}
          </ul>
        </Panel>
      ) : null}

      {tab === "activity" ? (
        <Panel hint="The last 50 changes" title="Activity">
          <AuditList rows={w.audit} />
        </Panel>
      ) : null}

      {confirm ? <StatusDialog onClose={() => setConfirm(null)} onDone={refresh} target={confirm} w={w} /> : null}
    </div>
  );
}

function Box({ label, value, sub, fill, small }: { label: string; value: string; sub?: string; fill?: number; small?: boolean }) {
  return (
    <div className="rounded-xl border border-border/60 bg-background px-4 py-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={cn("mt-0.5 font-semibold text-foreground", small ? "text-[15px]" : "text-lg")}>{value}</p>
      {fill !== undefined ? (
        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted">
          <div className={cn("h-full rounded-full", fill > 1 ? "bg-amber-500" : "bg-emerald-500")} style={{ width: `${Math.max(2, Math.min(100, fill * 100))}%` }} />
        </div>
      ) : null}
      {sub ? <p className="mt-1 text-xs text-muted-foreground">{sub}</p> : null}
    </div>
  );
}

function AuditList({ rows }: { rows: { ts: number; actor: string; action: string; target: string }[] }) {
  if (!rows.length) return <p className="px-4 py-6 text-sm text-muted-foreground">No changes yet.</p>;
  return (
    <ul className="divide-y divide-border/50">
      {rows.map((a, i) => (
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
  );
}

function MembersTable({ slug, members, onChanged }: { slug: string; members: Member[]; onChanged: () => void }) {
  const isOwner = useIsOwner();
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
                    {isOwner || m.role === "admin" ? <option value="admin">Admin</option> : null}
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

const INVITE_STATUS: Record<string, { label: string; tone: string }> = {
  open: { label: "Not used yet", tone: "bg-muted text-muted-foreground" },
  pending: { label: "Wants to join", tone: "bg-amber-500/10 text-amber-700 dark:text-amber-300" },
  joined: { label: "Joined", tone: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300" },
  rejected: { label: "Declined", tone: "bg-rose-500/10 text-rose-700 dark:text-rose-300" },
};

function InvitesPanel({ slug, invites, status, onChanged, home }: {
  slug: string; invites: Invite[]; status: WorkspaceStatus; onChanged: () => void; home: boolean;
}) {
  const isOwner = useIsOwner();
  const [name, setName] = React.useState("");
  const [email, setEmail] = React.useState("");
  const [role, setRole] = React.useState<WorkspaceRole>("member");
  const [dept, setDept] = React.useState("");
  const [days, setDays] = React.useState(7);
  const [confirm, setConfirm] = React.useState(true);
  const [fresh, setFresh] = React.useState<(NewInvite & { name: string }) | null>(null);
  const [copied, setCopied] = React.useState(false);
  const closed = status === "suspended" || status === "archived";
  const org = useQuery({ queryKey: ["unlimited", "org"], queryFn: () => orgApi.org(), enabled: home, retry: false, staleTime: 60_000 });
  const depts = org.data?.departments ?? [];
  const deptName = (id?: string) => depts.find((d) => d.id === id)?.name ?? "";
  const make = useMutation({
    mutationFn: () => workspacesApi.invite(slug, { email, role, days, max_uses: 1, name, department: dept, confirm }),
    onSuccess: (r) => {
      setFresh({ ...r, name });
      setCopied(false);
      setEmail("");
      setName("");
      onChanged();
    },
  });
  const revoke = useMutation({ mutationFn: (id: string) => workspacesApi.revokeInvite(slug, id), onSuccess: onChanged });
  const decide = useMutation({
    mutationFn: async (v: { id: string; approve: boolean }) => {
      const inv = invites.find((x) => x.id === v.id);
      // Only the owner may grant admin on the relay, so your own app adds an admin (signed with your key) first.
      if (v.approve && inv?.role === "admin" && inv.joined_pubkey && !isDemo()) {
        await addRelayMember(inv.joined_pubkey, "admin");
        return workspacesApi.decideInvite(slug, v.id, true, true);
      }
      return workspacesApi.decideInvite(slug, v.id, v.approve);
    },
    onSuccess: onChanged,
  });
  const nowS = Date.now() / 1000;
  const shown = invites.filter((i) => {
    const st = i.status ?? "open";
    if (st === "pending") return true;
    if (st === "open") return !i.revoked_at && i.expires_at > nowS;
    return st === "joined" && (i.joined_at ?? 0) > nowS - 14 * 86400;
  });
  shown.sort((a, b) => Number((b.status ?? "") === "pending") - Number((a.status ?? "") === "pending"));
  const share = (url: string, who: string) => {
    const text = `${who ? `${who}, you're` : "You're"} invited to Unlimited Agent. Open this link: ${url}`;
    const wa = `https://wa.me/?text=${encodeURIComponent(text)}`;
    void openUrl(wa).catch(() => window.open(wa, "_blank", "noopener"));
  };

  return (
    <div className="space-y-4">
      <Panel hint="The link works for one person, once. They join with this role and department." title="New invite">
        <form
          className="grid gap-2 px-4 py-3 md:grid-cols-[1.1fr_1.3fr_0.8fr_0.9fr_0.8fr_0.9fr_auto] md:items-end"
          onSubmit={(e) => {
            e.preventDefault();
            make.mutate();
          }}
        >
          <label className="flex flex-col gap-1 text-xs text-muted-foreground">
            Name
            <input className={field} onChange={(e) => setName(e.target.value)} placeholder="Ahmed Samir" value={name} />
          </label>
          <label className="flex flex-col gap-1 text-xs text-muted-foreground">
            Email (they can sign in with it)
            <input className={field} onChange={(e) => setEmail(e.target.value)} placeholder="name@company.com" type="email" value={email} />
          </label>
          <label className="flex flex-col gap-1 text-xs text-muted-foreground">
            Role
            <select className={field} onChange={(e) => setRole(e.target.value as WorkspaceRole)} value={role}>
              <option value="member">Member</option>
              <option value="viewer">Viewer</option>
              {isOwner ? <option value="admin">Admin</option> : null}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-xs text-muted-foreground">
            Department
            <select className={field} disabled={!home || depts.length === 0} onChange={(e) => setDept(e.target.value)} value={dept}>
              <option value="">{home ? "None" : "—"}</option>
              {depts.map((d) => (
                <option key={d.id} value={d.id}>{d.name}</option>
              ))}
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
            Before joining
            <select className={field} onChange={(e) => setConfirm(e.target.value === "1")} value={confirm ? "1" : "0"}>
              <option value="1">I confirm</option>
              <option value="0">Join right away</option>
            </select>
          </label>
          <Button className="h-8 gap-1.5 text-xs" disabled={closed || make.isPending || (!name.trim() && !email.trim())} size="sm" type="submit">
            {make.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Link2 className="h-3.5 w-3.5" />} Create link
          </Button>
          {closed ? <p className="text-xs text-muted-foreground md:col-span-7">Resume the workspace to invite people.</p> : null}
          {make.isError ? <p className="text-xs text-destructive md:col-span-7">{errorText(make.error)}</p> : null}
        </form>

        {fresh ? (
          <div className="space-y-1.5 border-t border-border/50 bg-emerald-500/5 px-4 py-3" data-testid="invite-fresh">
            <p className="text-xs text-foreground">
              Send this to {fresh.name || "them"} now. For safety the link is shown only once.
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <code className="min-w-0 flex-1 truncate rounded-md border border-border/60 bg-background px-2 py-1.5 text-xs">{fresh.url}</code>
              <Button
                className="h-8 gap-1.5 text-xs"
                onClick={() => void navigator.clipboard.writeText(fresh.url).then(() => setCopied(true))}
                size="sm"
                type="button"
                variant="outline"
              >
                {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />} {copied ? "Copied" : "Copy"}
              </Button>
              <Button className="h-8 gap-1.5 text-xs" onClick={() => share(fresh.url, fresh.name)} size="sm" type="button" variant="outline">
                <MessageCircle className="h-3.5 w-3.5" /> WhatsApp
              </Button>
            </div>
          </div>
        ) : null}
      </Panel>

      <Panel hint="Waiting for you first, then open links, then people who joined in the last two weeks." title="Invites">
        {shown.length === 0 ? (
          <p className="px-4 py-5 text-sm text-muted-foreground">No open invites.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-muted-foreground">
                <th className="px-4 py-2 font-medium">Person</th>
                <th className="px-2 py-2 font-medium">Role</th>
                <th className="px-2 py-2 font-medium">Department</th>
                <th className="px-2 py-2 font-medium">Status</th>
                <th className="px-4 py-2" />
              </tr>
            </thead>
            <tbody className="divide-y divide-border/50">
              {shown.map((i) => {
                const st = i.status ?? "open";
                const tone = INVITE_STATUS[st] ?? INVITE_STATUS.open;
                return (
                  <tr data-testid="invite-row" key={i.id}>
                    <td className="px-4 py-2.5">
                      <p className="font-medium text-foreground">{i.joined_name || i.name || i.email || `Link ending ${i.code_hint}`}</p>
                      <p className="text-xs text-muted-foreground">{i.email || (i.kind === "direct" ? "invite link" : "old relay link")}</p>
                    </td>
                    <td className="px-2 py-2.5 text-xs">{i.role.charAt(0).toUpperCase() + i.role.slice(1)}</td>
                    <td className="px-2 py-2.5 text-xs">{deptName(i.department) || "—"}</td>
                    <td className="px-2 py-2.5">
                      <span className={cn("inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium", tone.tone)}>
                        {st === "pending"
                          ? `Wants to join · ${i.device || "a device"} · ${i.pair ?? ""}`
                          : st === "joined"
                            ? `Joined ${ago(i.joined_at ?? nowS)}${i.device ? ` · ${i.device}` : ""}`
                            : `${tone.label} · ${Math.max(0, Math.ceil((i.expires_at - nowS) / 86400))} days left`}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      {st === "pending" ? (
                        <span className="inline-flex gap-1.5">
                          <Button className="h-7 px-2.5 text-xs" disabled={decide.isPending} onClick={() => decide.mutate({ id: i.id, approve: true })} size="sm" type="button">
                            Confirm
                          </Button>
                          <Button className="h-7 px-2.5 text-xs" disabled={decide.isPending} onClick={() => decide.mutate({ id: i.id, approve: false })} size="sm" type="button" variant="outline">
                            Reject
                          </Button>
                        </span>
                      ) : st === "open" ? (
                        <Button className="h-7 px-2 text-xs" disabled={revoke.isPending} onClick={() => revoke.mutate(i.id)} size="sm" type="button" variant="ghost">
                          Revoke
                        </Button>
                      ) : null}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
        {revoke.isError ? <p className="px-4 pb-3 text-xs text-destructive">{errorText(revoke.error)}</p> : null}
        {decide.isError ? <p className="px-4 pb-3 text-xs text-destructive">{errorText(decide.error)}</p> : null}
      </Panel>
    </div>
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
