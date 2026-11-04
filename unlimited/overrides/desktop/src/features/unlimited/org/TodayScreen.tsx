/**
 * Unlimited Agent — Today: the day's plan at a glance (progress from the company Odoo), what waits for you
 * (plans to approve, tool approvals, emails), and each team's people with their tasks. Plans are approved
 * here by whoever the org says approves them, not only the owner.
 */
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { ArrowRightLeft, ChevronRight, Info, Link2, Loader2, Network, Sun } from "lucide-react";
import * as React from "react";

import { cn } from "@/shared/lib/cn";
import { Button } from "@/shared/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/shared/ui/dialog";

import { odooApi } from "../odoo/api";
import { type DeployLine, firstName, orgApi, type PlanDetail, type PlanRow, type TeamDay, type Today } from "./api";
import { Bar, Card, errorText, hm, hours, OrgAvatar, Pill, Ring } from "./ui";

const WEEKDAY = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

function greeting(): string {
  const h = new Date().getHours();
  return h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening";
}

export function TodayScreen() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const today = useQuery({ queryKey: ["unlimited", "today"], queryFn: () => orgApi.today(), refetchInterval: 60_000, retry: false });
  const overview = useQuery({ queryKey: ["unlimited", "overview"], queryFn: () => odooApi.overview(), retry: false, staleTime: 30_000 });
  const outbox = useQuery({ queryKey: ["unlimited", "outbox"], queryFn: () => odooApi.outbox(), retry: false, staleTime: 30_000 });
  const [plan, setPlan] = React.useState<string | null>(null);
  const t = today.data;
  const now = new Date();
  const refresh = () => void qc.invalidateQueries({ queryKey: ["unlimited", "today"] });

  return (
    <div className="flex h-full min-h-0 w-full" data-testid="today-screen">
      <main className="min-w-0 flex-1 overflow-y-auto px-6 py-5">
        <header className="mb-4">
          <p className="text-xs text-muted-foreground">
            {WEEKDAY[now.getDay()]} {now.getDate()} {now.toLocaleString("en-US", { month: "long" })}
          </p>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            {greeting()}
            {t ? `, ${firstName(t.me)}` : ""}
          </h1>
        </header>

        {today.isLoading ? (
          <p className="flex items-center gap-2 py-16 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading today…
          </p>
        ) : today.isError || !t ? (
          <Card className="px-5 py-6 text-sm text-muted-foreground">Today could not load: {errorText(today.error)}</Card>
        ) : (
          <div className="grid gap-4 xl:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]">
            <div className="min-w-0 space-y-4">
              <Hero t={t} />
              {!t.odoo && t.me.id === "owner" ? (
                <Setup
                  action="Open the org page"
                  icon={<Link2 className="h-4 w-4 text-primary" />}
                  onClick={() => void navigate({ to: "/team" as never })}
                  text="Employees read their tasks from it every morning and update it as they work. Connect it from Team > Plan settings."
                  title="Connect your company Odoo"
                />
              ) : t.odoo && !t.has_teams && t.me.id === "owner" ? (
                <Setup
                  action="Open the org chart"
                  icon={<Network className="h-4 w-4 text-primary" />}
                  onClick={() => void navigate({ to: "/team" as never })}
                  text="Pick a lead and who reports to them. The lead drafts a plan every morning and a person you choose approves it."
                  title="Set up your team"
                />
              ) : null}
              <Needs
                approvals={overview.data?.approvals ?? 0}
                emails={outbox.data?.length ?? 0}
                onOpenPlan={setPlan}
                onOpenProjects={() => void navigate({ to: "/projects" })}
                t={t}
              />
            </div>
            <div className="min-w-0 space-y-4">
              {(t.deploys ?? [])
                .filter((d) => !t.teams.some((team) => teamHasDeploy(team, d)))
                .map((d) => (
                  <DeployStrip d={d} key={d.project} />
                ))}
              {t.teams.map((team) => (
                <TeamCard deploys={(t.deploys ?? []).filter((d) => teamHasDeploy(team, d))} key={team.plan} onOpenPlan={() => setPlan(team.plan)} team={team} />
              ))}
              {t.teams.length === 0 && t.odoo && t.has_teams ? (
                <Card className="px-5 py-8 text-center text-sm text-muted-foreground">
                  No plan yet today. Leads draft at {t.settings.plan_at} on workdays.
                </Card>
              ) : null}
            </div>
          </div>
        )}
      </main>
      {plan ? (
        <PlanDialog
          escalate={t?.settings.escalate_minutes ?? 30}
          id={plan}
          onClose={(changed) => {
            setPlan(null);
            if (changed) refresh();
          }}
        />
      ) : null}
    </div>
  );
}

function Hero({ t }: { t: Today }) {
  const approved = t.teams.find((x) => x.status === "approved" && x.decided_by);
  const pending = t.teams.find((x) => x.status === "pending");
  const pill = approved
    ? `Approved by ${firstName(approved.decided_by)} at ${hm(approved.decided_at)}`
    : pending
      ? `Waiting for ${firstName(pending.approver) || "approval"}`
      : t.odoo
        ? "No plan yet"
        : "Odoo not connected";
  const s = t.summary;
  return (
    <section className="flex items-center gap-5 rounded-2xl bg-gradient-to-br from-[#4A1F6A] to-[#7A2556] px-5 py-5 text-white shadow-sm">
      <Ring percent={s.percent} />
      <div className="min-w-0">
        <h2 className="text-lg font-bold">{s.tasks ? `Today's plan: ${s.tasks} task${s.tasks === 1 ? "" : "s"}` : "Today's plan"}</h2>
        <p className="mt-0.5 text-sm text-white/75">
          {s.tasks
            ? `${s.done} done, ${s.open} in progress, ${s.blocked} blocked`
            : pending
              ? "A plan is waiting for approval"
              : "Tasks show here once a plan is approved"}
        </p>
        <span className="mt-2.5 inline-block rounded-md bg-white/15 px-2.5 py-1 text-xs font-bold">{pill}</span>
      </div>
    </section>
  );
}

function Setup({ icon, title, text, action, onClick }: { icon: React.ReactNode; title: string; text: string; action: string; onClick: () => void }) {
  return (
    <Card className="flex flex-wrap items-center gap-4 px-5 py-4">
      <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10">{icon}</span>
      <div className="min-w-0 flex-1">
        <h3 className="text-sm font-semibold text-foreground">{title}</h3>
        <p className="text-xs text-muted-foreground">{text}</p>
      </div>
      <Button className="h-8 text-xs" onClick={onClick} size="sm" type="button">
        {action}
      </Button>
    </Card>
  );
}

function Needs({
  t,
  approvals,
  emails,
  onOpenPlan,
  onOpenProjects,
}: {
  t: Today;
  approvals: number;
  emails: number;
  onOpenPlan: (id: string) => void;
  onOpenProjects: () => void;
}) {
  const total = t.needs_you.length + approvals + emails;
  if (total === 0) {
    return (
      <Card className="flex items-center gap-3 px-5 py-4 text-sm text-foreground">
        <Sun className="h-4 w-4 text-emerald-600" /> All clear. Nothing waits for you.
      </Card>
    );
  }
  return (
    <section>
      <h3 className="mb-2 px-1 text-xs font-semibold text-muted-foreground">Needs you ({total})</h3>
      <div className="space-y-2.5">
        {t.needs_you.map((n) => (
          <button
            className="flex w-full items-center gap-3 rounded-2xl border border-primary/30 bg-background px-4 py-3.5 text-start transition-colors hover:bg-muted/40"
            key={n.id}
            onClick={() => onOpenPlan(n.id)}
            type="button"
          >
            <OrgAvatar person={n.lead} />
            <span className="min-w-0 flex-1">
              <Pill tone="accent">Plan to approve</Pill>
              <span className="mt-1 block text-sm font-semibold text-foreground">
                {firstName(n.lead)}'s team: {n.tasks} tasks for {n.people} people
              </span>
            </span>
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          </button>
        ))}
        {approvals ? (
          <button
            className="flex w-full items-center gap-3 rounded-2xl border border-border/60 bg-background px-4 py-3 text-start text-sm hover:bg-muted/40"
            onClick={onOpenProjects}
            type="button"
          >
            <Pill tone="warn">Needs you</Pill>
            <span className="flex-1 text-foreground">
              {approvals === 1 ? "1 action waits" : `${approvals} actions wait`} for your approval in Projects
            </span>
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          </button>
        ) : null}
        {emails ? (
          <Card className="flex items-center gap-3 px-4 py-3 text-sm">
            <Pill tone="warn">Outbox</Pill>
            <span className="flex-1 text-foreground">
              {emails === 1 ? "1 email waits" : `${emails} emails wait`} for you in the Outbox
            </span>
          </Card>
        ) : null}
      </div>
    </section>
  );
}

function teamHasDeploy(team: TeamDay, d: DeployLine): boolean {
  return team.members.some((r) => r.deploy?.project === d.project && (r.deploy.state === "building" || r.deploy.state === "waiting"));
}

/** One line per staging branch while someone publishes: Odoo.sh rebuilding (by whom) and how many wait. */
function DeployStrip({ d }: { d: DeployLine }) {
  return (
    <div className="mb-2 flex items-start gap-2.5 rounded-xl bg-blue-50 px-3.5 py-2.5 text-sm dark:bg-blue-500/10" data-testid="deploy-strip">
      <span className={cn("mt-1.5 h-2 w-2 shrink-0 rounded-full", d.building ? "animate-pulse bg-blue-600" : "bg-muted-foreground/50")} />
      <span className="min-w-0">
        <b className="font-semibold text-foreground">{d.branch}</b>{" "}
        <span className="text-muted-foreground">
          {d.building ? `Odoo.sh is rebuilding${d.by ? ` (${d.by})` : ""}` : "Idle"}
          {d.waiting ? ` · ${d.waiting} waiting to publish` : ""}
        </span>
      </span>
    </div>
  );
}

function minutesSince(iso: string): number {
  return Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60_000));
}

function DeployChip({ dep }: { dep: NonNullable<PlanRow["deploy"]> }) {
  const time = new Date(dep.since).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  const [cls, text] =
    dep.state === "building"
      ? ["bg-blue-50 text-blue-700 dark:bg-blue-500/10 dark:text-blue-300", `Rebuilding ${dep.branch} · ${minutesSince(dep.since)} min`]
      : dep.state === "waiting"
        ? ["bg-muted text-muted-foreground", "Waiting to publish"]
        : dep.state === "live"
          ? ["bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300", `Live on staging ${time}`]
          : ["bg-red-50 text-red-700 dark:bg-red-500/10 dark:text-red-300", `Build failed ${time}`];
  return (
    <span className={cn("inline-flex shrink-0 items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-semibold", cls)} data-testid="deploy-chip">
      {dep.state === "building" ? <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-current" /> : null}
      {text}
    </span>
  );
}

function TeamCard({ team, deploys, onOpenPlan }: { team: TeamDay; deploys: DeployLine[]; onOpenPlan: () => void }) {
  const navigate = useNavigate();
  const rows = team.members.filter((r) => r.total > 0 || team.status !== "pending");
  return (
    <section>
      <div className="mb-2 flex items-center justify-between gap-2 px-1">
        <h3 className="text-xs font-semibold text-muted-foreground">{team.title ?? (team.lead ? `${firstName(team.lead)}'s team` : "Team")}</h3>
        {team.title ? (
          <button className="text-xs font-semibold text-primary hover:underline" onClick={() => void navigate({ to: "/tasks" as never })} type="button">
            Open Tasks
          </button>
        ) : (
          <button className="text-xs font-semibold text-primary hover:underline" onClick={onOpenPlan} type="button">
            {team.status === "pending" ? "Waiting for approval" : team.status === "rejected" ? "Sent back" : "View plan"}
          </button>
        )}
      </div>
      {deploys.map((d) => (
        <DeployStrip d={d} key={d.project} />
      ))}
      <Card className="divide-y divide-border/60 px-4">
        {rows.map((r) => (
          <PersonRow key={r.member.id} r={r} />
        ))}
        {rows.length === 0 ? <p className="py-4 text-sm text-muted-foreground">No tasks in this plan.</p> : null}
      </Card>
      {team.notes.map((n) => (
        <p className="mt-1.5 px-1 text-xs text-muted-foreground" key={n}>
          {n}
        </p>
      ))}
    </section>
  );
}

function PersonRow({ r }: { r: PlanRow }) {
  const allDone = r.total > 0 && r.done === r.total;
  const blocked = r.tasks.find((x) => x.status === "blocked");
  return (
    <div className="flex items-center gap-3 py-3">
      <OrgAvatar person={r.member} size={36} />
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2">
          <span className="truncate text-sm font-semibold text-foreground">
            {firstName(r.member)}, {r.total} task{r.total === 1 ? "" : "s"}
          </span>
          {r.hours ? <span className="text-xs text-muted-foreground">{hours(r.hours)}</span> : null}
        </div>
        <Bar className="my-1.5" value={r.total ? r.done / r.total : 0} />
        {r.deploy && !(blocked && !allDone) ? (
          <p className="flex min-w-0 items-center gap-2 text-xs text-muted-foreground">
            <DeployChip dep={r.deploy} />
            <span className="truncate">
              {r.deploy.state === "building" ? `Published: ${r.deploy.task}` : r.deploy.state === "waiting" ? r.deploy.task : r.now ? `Now: ${r.now}` : r.deploy.task}
            </span>
          </p>
        ) : (
          <p className={cn("truncate text-xs", blocked && !allDone ? "text-amber-600" : "text-muted-foreground")}>
            {allDone ? "All done" : blocked ? `Blocked: ${blocked.name}` : r.now ? `Now: ${r.now}` : "No tasks"}
          </p>
        )}
      </div>
    </div>
  );
}

// ------------------------------------------------------------------ plan dialog
export function PlanDialog({ id, escalate, onClose }: { id: string; escalate: number; onClose: (changed: boolean) => void }) {
  const plan = useQuery({ queryKey: ["unlimited", "plan", id], queryFn: () => orgApi.plan(id), retry: false });
  const [moves, setMoves] = React.useState<Record<number, string>>({});
  const [note, setNote] = React.useState("");
  const [sendingBack, setSendingBack] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState("");
  const p = plan.data;

  const decide = async (approve: boolean) => {
    setBusy(true);
    setError("");
    try {
      await orgApi.decide(id, approve, note, Object.entries(moves).map(([task, to]) => ({ task: Number(task), to })));
      onClose(true);
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog onOpenChange={(v) => !v && onClose(false)} open>
      <DialogContent className="flex max-h-[88vh] w-[720px] max-w-[calc(100vw-2rem)] flex-col gap-0 overflow-hidden p-0">
        <div className="border-b border-border/60 px-6 py-4">
          <DialogTitle className="text-lg font-semibold">{p ? `Plan for ${WEEKDAY[new Date(p.date).getDay()]}` : "Plan"}</DialogTitle>
          <DialogDescription className="text-sm text-muted-foreground">
            {p ? `${firstName(p.lead_member)} drafted it at ${hm(p.created_at)} from the company Odoo` : "Loading…"}
          </DialogDescription>
        </div>
        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-6 py-4">
          {!p ? (
            plan.isError ? (
              <p className="text-sm text-destructive">{errorText(plan.error)}</p>
            ) : (
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            )
          ) : (
            <PlanBody escalate={escalate} moves={moves} p={p} setMoves={setMoves} />
          )}
          {sendingBack ? (
            <label className="flex flex-col gap-1 text-xs text-muted-foreground">
              What should change?
              <textarea
                className="min-h-[72px] rounded-md border border-border/70 bg-background px-3 py-2 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring"
                onChange={(e) => setNote(e.target.value)}
                value={note}
              />
            </label>
          ) : null}
          {error ? <p className="rounded-lg bg-destructive/10 px-3 py-2 text-xs text-destructive">{error}</p> : null}
        </div>
        {p?.status === "pending" ? (
          <div className="flex justify-end gap-2 border-t border-border/60 px-6 py-3">
            {sendingBack ? (
              <>
                <Button disabled={busy} onClick={() => setSendingBack(false)} size="sm" type="button" variant="ghost">
                  Cancel
                </Button>
                <Button disabled={busy} onClick={() => void decide(false)} size="sm" type="button" variant="outline">
                  Send back
                </Button>
              </>
            ) : (
              <>
                <Button disabled={busy} onClick={() => setSendingBack(true)} size="sm" type="button" variant="outline">
                  Send back
                </Button>
                <Button disabled={busy} onClick={() => void decide(true)} size="sm" type="button">
                  {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null} Approve plan
                </Button>
              </>
            )}
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

function PlanBody({
  p,
  escalate,
  moves,
  setMoves,
}: {
  p: PlanDetail;
  escalate: number;
  moves: Record<number, string>;
  setMoves: React.Dispatch<React.SetStateAction<Record<number, string>>>;
}) {
  const pending = p.status === "pending";
  const total = p.rows.reduce((a, r) => a + r.tasks.length, 0);
  const tasksOf = (memberId: string) =>
    p.rows.flatMap((r) => r.tasks.filter((t) => (moves[t.id] ?? r.member.id) === memberId).map((t) => ({ t, from: r.member.id })));
  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        <OrgAvatar person={p.lead_member} size={34} />
        <span className="text-sm text-foreground">
          {total} Odoo tasks for {p.rows.length} people
        </span>
        <span className="flex-1" />
        <Pill tone="accent">Approver: {firstName(p.approver_member)}</Pill>
        {pending && p.approver !== "owner" ? <Pill>Goes up if no answer in {escalate} min</Pill> : null}
        {!pending ? <Pill tone={p.status === "approved" ? "ok" : "warn"}>{p.status === "approved" ? "Approved" : "Sent back"}</Pill> : null}
      </div>
      <Card className="divide-y divide-border/60 px-4">
        {p.rows.map((r) => {
          const mine = tasksOf(r.member.id);
          const h = mine.reduce((a, x) => a + x.t.hours, 0);
          return (
            <div className="flex gap-3 py-3" key={r.member.id}>
              <OrgAvatar person={r.member} size={32} />
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold text-foreground">{r.member.name}</span>
                  {h ? <span className="text-xs text-muted-foreground">{hours(h)}</span> : null}
                </div>
                {mine.length === 0 ? <p className="text-xs text-muted-foreground">Free today</p> : null}
                {mine.map(({ t, from }) => (
                  <div className="mt-1 flex items-center gap-2 text-xs" key={t.id}>
                    <span className={cn("min-w-0 flex-1 truncate", moves[t.id] ? "text-primary" : "text-muted-foreground")}>
                      {t.url ? (
                        <a className="hover:underline" href={t.url} rel="noreferrer" target="_blank">
                          {t.ref}
                        </a>
                      ) : (
                        t.ref
                      )}{" "}
                      {t.name}
                      {moves[t.id] ? " (moved)" : ""}
                    </span>
                    {pending ? (
                      <label className="flex items-center gap-1 text-muted-foreground">
                        <ArrowRightLeft className="h-3 w-3" />
                        <select
                          aria-label={`Move ${t.name}`}
                          className="h-6 rounded border border-border/70 bg-background px-1 text-[11px] text-foreground"
                          onChange={(e) => {
                            const to = e.target.value;
                            setMoves((m) => {
                              const next = { ...m };
                              if (to === from) delete next[t.id];
                              else next[t.id] = to;
                              return next;
                            });
                          }}
                          value={moves[t.id] ?? from}
                        >
                          {p.team.map((m) => (
                            <option key={m.id} value={m.id}>
                              {m.name}
                            </option>
                          ))}
                        </select>
                      </label>
                    ) : null}
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </Card>
      {(p.notes ?? []).map((n) => (
        <p className="flex items-start gap-2 rounded-lg bg-amber-500/10 px-3 py-2 text-xs text-amber-800 dark:text-amber-200" key={n}>
          <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" /> {n}
        </p>
      ))}
    </>
  );
}
