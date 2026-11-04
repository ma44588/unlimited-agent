/**
 * Unlimited Agent — Tasks: every project's tasks on one page. What needs you (a plan to approve, a result to
 * review) comes first; the chosen task opens beside the list with its cycle and the decision buttons, so
 * approving a plan takes two clicks instead of five pages.
 */
import { useQuery } from "@tanstack/react-query";
import { ArrowUpRight, CheckCircle2, ListChecks, Plus, X } from "lucide-react";
import * as React from "react";

import { useAppNavigation } from "@/app/navigation/useAppNavigation";
import {
  type Project,
  type ProjectIssue,
  type Repository,
  useProjectIssuesQuery,
  useProjectsQuery,
} from "@/features/projects/hooks";
import { CreateProjectIssueDialog } from "@/features/projects/ui/CreateProjectIssueDialog";
import { orgApi, type OrgPerson } from "@/features/unlimited/org/api";
import { OrgAvatar } from "@/features/unlimited/org/ui";
import { cn } from "@/shared/lib/cn";

import { sinceLabel, STAGE_LABEL, stageFor, type TaskStage, useTaskStages } from "./taskDesk";
import { TaskCycleCard } from "./TaskCycleCard";

const PALETTE = ["#8b55c4", "#0ea5a4", "#e07a2f", "#3b82f6", "#e5484d", "#16a34a", "#d4a017", "#6366f1"];
const WEEK = 7 * 24 * 3600;

type Item = { project: Project; repo: Repository; issue: ProjectIssue; stage?: TaskStage; color: string };
const keyOf = (it: { repo: Repository; issue: ProjectIssue }) => `${it.repo.id}:${it.issue.id}`;
type Group = "problem" | "need" | "work" | "new" | "done";

function groupOf(it: Item): Group | null {
  const s = it.stage?.stage;
  if (s === "cancelled" || it.issue.status === "Closed") return null;
  if (it.stage?.problem) return "problem";
  if (s === "awaiting_approval" || s === "in_review" || it.stage?.asks?.length) return "need";
  if (s === "documented" || s === "done" || it.issue.status === "Done") {
    const at = it.stage?.since ?? it.issue.updatedAt;
    return Date.now() / 1000 - at < WEEK ? "done" : null;
  }
  if (s) return "work";
  return "new";
}

function priorityOf(issue: ProjectIssue): string | null {
  const m = /\*\*Priority:\*\*\s*(Urgent|High|Low)/i.exec(issue.content);
  return m ? m[1] : null;
}

function waitingSince(it: Item): number {
  return it.stage?.since ?? it.issue.updatedAt ?? it.issue.createdAt;
}

/** Loads one repository's tasks and stages and hands them up (hooks can't run in a loop). */
function RepoFeed({ repo, onData }: { repo: Repository; onData: (id: string, issues: ProjectIssue[], stages: ReturnType<typeof useTaskStages>["data"]) => void }) {
  const issues = useProjectIssuesQuery(repo);
  const stages = useTaskStages(repo);
  React.useEffect(() => {
    onData(repo.id, issues.data ?? [], stages.data);
  }, [repo.id, issues.data, stages.data, onData]);
  return null;
}

function Dot({ color }: { color: string }) {
  return <span className="inline-block h-2 w-2 shrink-0 rounded-[3px]" style={{ background: color }} />;
}

function StageBadge({ it }: { it: Item }) {
  const s = it.stage?.stage;
  const g = groupOf(it);
  const [cls, text] =
    it.stage?.asks?.length
      ? ["bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300", "Needs your OK"]
      : s === "awaiting_approval"
      ? ["bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300", "Approve plan"]
      : s === "in_review"
        ? ["bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300", "Review result"]
        : g === "done"
          ? ["bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300", "✓ Done"]
          : s
            ? ["bg-muted text-muted-foreground", `${s === "executing" && it.stage?.kind === "setup" ? "Setting up" : STAGE_LABEL[s]} · ${sinceLabel(it.stage?.since)}`]
            : ["bg-muted text-muted-foreground", "Not started"];
  return <span className={cn("whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-bold", cls)}>{text}</span>;
}

function Progress({ stage }: { stage?: TaskStage }) {
  const order = ["planning", "awaiting_approval", "executing", "executing", "executing", "in_review", "documenting", "documented"];
  const at = stage ? order.indexOf(stage.stage) + 1 : 0;
  return (
    <span className="flex gap-0.5">
      {Array.from({ length: 8 }, (_, i) => (
        <i className={cn("h-1 w-2.5 rounded-sm", i < at ? "bg-primary/70" : i === at ? "bg-amber-500" : "bg-border")} key={i} />
      ))}
    </span>
  );
}

function TaskRow({ it, person, selected, onClick }: { it: Item; person?: OrgPerson; selected: boolean; onClick: () => void }) {
  const g = groupOf(it);
  const pri = priorityOf(it.issue);
  const accent = g === "problem" ? "#e5484d" : it.stage?.stage === "awaiting_approval" || it.stage?.asks?.length ? "#f59e0b" : it.stage?.stage === "in_review" ? "#3b82f6" : "transparent";
  return (
    <button
      className={cn(
        "relative grid w-full grid-cols-[36px_1fr_auto] items-center gap-3 overflow-hidden rounded-2xl border bg-background py-2.5 pl-4 pr-3.5 text-left transition-shadow hover:shadow-sm",
        selected ? "border-primary/40 ring-4 ring-primary/10" : "border-border/70",
        g === "done" && "opacity-70",
      )}
      data-testid="tasks-row"
      onClick={onClick}
      type="button"
    >
      <span className="absolute inset-y-0 left-0 w-1" style={{ background: accent }} />
      {person ? <OrgAvatar badge={false} person={person} size={36} /> : <span className="h-9 w-9 rounded-full bg-muted" />}
      <span className="min-w-0">
        <span className="block truncate text-[13.5px] font-semibold text-foreground" dir="auto" style={{ textAlign: "left", unicodeBidi: "plaintext" }}>
          {it.issue.title}
        </span>
        <span className="mt-1 flex min-w-0 items-center gap-1.5 text-[11.5px] text-muted-foreground">
          <Dot color={it.color} />
          <span className="font-semibold text-foreground/80">{it.project.name}</span>
          {it.stage?.kind && it.stage.kind !== "code" ? (
            <span className="rounded-md bg-teal-50 px-1.5 text-[10.5px] font-bold text-teal-700 dark:bg-teal-500/10 dark:text-teal-300">
              {it.stage.kind === "both" ? "CODE + SETUP" : "SETUP"}
            </span>
          ) : null}
          {pri ? (
            <span className="rounded-md bg-red-50 px-1.5 text-[10.5px] font-bold uppercase text-red-700 dark:bg-red-500/10 dark:text-red-300">{pri}</span>
          ) : null}
          <span className="truncate">{person ? person.name : "Unassigned"}{it.stage?.round && it.stage.round > 1 ? ` · plan v${it.stage.round}` : ""}</span>
        </span>
      </span>
      <span className="flex flex-col items-end gap-1.5">
        <StageBadge it={it} />
        {g === "problem" ? (
          <span className="text-[11px] font-semibold text-red-600 dark:text-red-400">
            {it.stage?.problem === "build_failed" ? "Staging build failed" : `Stuck ${sinceLabel(waitingSince(it))}`}
          </span>
        ) : g === "need" ? (
          <span className="text-[11px] font-semibold text-amber-700 dark:text-amber-300">waiting {sinceLabel(waitingSince(it))}</span>
        ) : g === "work" ? (
          <Progress stage={it.stage} />
        ) : null}
      </span>
    </button>
  );
}

export function TasksScreen() {
  const projectsQuery = useProjectsQuery();
  const projects = React.useMemo(() => (projectsQuery.data ?? []).filter((p) => p.repositories.length > 0), [projectsQuery.data]);
  const org = useQuery({ queryKey: ["unlimited", "org"], queryFn: () => orgApi.org(), retry: false, staleTime: 60_000 });
  const { goProject } = useAppNavigation();
  const [feeds, setFeeds] = React.useState<Record<string, { issues: ProjectIssue[]; stages?: Parameters<typeof stageFor>[0] }>>({});
  const onData = React.useCallback((id: string, issues: ProjectIssue[], stages?: Parameters<typeof stageFor>[0]) => {
    setFeeds((cur) => (cur[id]?.issues === issues && cur[id]?.stages === stages ? cur : { ...cur, [id]: { issues, stages } }));
  }, []);
  const [filter, setFilter] = React.useState<string>("all");
  const [selected, setSelected] = React.useState<string | null>(null);
  const [creating, setCreating] = React.useState(false);

  const colorOf = React.useMemo(() => {
    const m: Record<string, string> = {};
    projects.forEach((p, i) => {
      m[p.id] = PALETTE[i % PALETTE.length];
    });
    return m;
  }, [projects]);

  const items = React.useMemo(() => {
    const out: Item[] = [];
    const seen = new Set<string>();
    for (const p of projects) {
      for (const r of p.repositories) {
        const f = feeds[r.id];
        if (!f) continue;
        for (const issue of f.issues) {
          // One repository can sit in more than one project; show each task once.
          const k = `${r.id}:${issue.id}`;
          if (seen.has(k)) continue;
          seen.add(k);
          out.push({ project: p, repo: r, issue, stage: f.stages ? stageFor(f.stages, issue.id) : undefined, color: colorOf[p.id] });
        }
      }
    }
    return out;
  }, [projects, feeds, colorOf]);

  const byPubkey = React.useMemo(() => {
    const m: Record<string, OrgPerson> = {};
    for (const p of org.data?.members ?? []) if (p.pubkey) m[p.pubkey.toLowerCase()] = p;
    return m;
  }, [org.data]);
  const personOf = (it: Item) => {
    const pk = it.issue.assignees[it.issue.assignees.length - 1];
    return pk ? byPubkey[pk.toLowerCase()] : undefined;
  };

  const visible = items.filter((it) => filter === "all" || it.project.id === filter);
  const grouped: Record<Group, Item[]> = { problem: [], need: [], work: [], new: [], done: [] };
  for (const it of visible) {
    const g = groupOf(it);
    if (g) grouped[g].push(it);
  }
  grouped.need.sort((a, b) => waitingSince(a) - waitingSince(b));
  grouped.work.sort((a, b) => waitingSince(b) - waitingSince(a));
  grouped.new.sort((a, b) => b.issue.createdAt - a.issue.createdAt);
  grouped.done.sort((a, b) => waitingSince(b) - waitingSince(a));
  grouped.problem.sort((a, b) => waitingSince(a) - waitingSince(b));
  const flat = [...grouped.problem, ...grouped.need, ...grouped.work, ...grouped.new, ...grouped.done];
  // The side panel opens only when a task is picked, and closes with ✕, Esc or a second click.
  const current = flat.find((it) => keyOf(it) === selected);
  const needCount = items.filter((it) => groupOf(it) === "need").length;
  const problemCount = items.filter((it) => groupOf(it) === "problem").length;
  const loading = projectsQuery.isLoading || projects.some((p) => p.repositories.some((r) => !feeds[r.id]));

  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLElement && /INPUT|TEXTAREA/.test(e.target.tagName)) return;
      if (e.key === "Escape" && current) {
        setSelected(null);
        return;
      }
      if (!current || (e.key !== "ArrowDown" && e.key !== "ArrowUp")) return;
      const i = flat.findIndex((it) => current && keyOf(it) === keyOf(current));
      const next = flat[Math.min(flat.length - 1, Math.max(0, i + (e.key === "ArrowDown" ? 1 : -1)))];
      if (next) {
        e.preventDefault();
        setSelected(keyOf(next));
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const section = (key: Group, label: string) =>
    grouped[key].length ? (
      <section key={key}>
        <h3
          className={cn(
            "mb-2 mt-4 px-0.5 text-[11.5px] font-bold tracking-wide",
            key === "problem" ? "text-red-600 dark:text-red-400" : key === "need" ? "text-amber-700 dark:text-amber-300" : "text-muted-foreground",
          )}
        >
          {key === "need" || key === "problem" ? "● " : ""}
          {label}
        </h3>
        <div className="space-y-2">
          {grouped[key].map((it) => (
            <TaskRow it={it} key={keyOf(it)} onClick={() => setSelected((s) => (s === keyOf(it) ? null : keyOf(it)))} person={personOf(it)} selected={!!current && keyOf(current) === keyOf(it)} />
          ))}
        </div>
      </section>
    ) : null;

  const person = current ? personOf(current) : undefined;
  return (
    <div className={cn("grid h-full min-h-0 w-full grid-cols-1", current && "lg:grid-cols-[minmax(0,1fr)_minmax(420px,520px)]")} data-testid="tasks-screen">
      {projects.flatMap((p) => p.repositories.map((r) => <RepoFeed key={r.id} onData={onData} repo={r} />))}
      <main className={cn("min-h-0 overflow-y-auto bg-muted/20 px-6 py-5", current && "border-r border-border/60")}>
        <div className={cn(!current && "mx-auto max-w-4xl")}>
        <header className="mb-4 flex items-end gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground">Tasks</h1>
            <p className="text-sm text-muted-foreground">All projects. What needs you comes first.</p>
          </div>
          <button
            className="ml-auto flex items-center gap-1.5 rounded-xl bg-foreground px-3.5 py-2 text-sm font-semibold text-background disabled:opacity-50"
            disabled={!projects.length}
            onClick={() => setCreating(true)}
            type="button"
          >
            <Plus className="h-4 w-4" /> New task
          </button>
        </header>
        <div className="mb-4 grid grid-cols-4 gap-2.5">
          {(
            [
              ["problem", problemCount, "failed or stuck"],
              ["need", needCount, "need you"],
              ["work", grouped.work.length, "in progress"],
              ["done", grouped.done.length, "done this week"],
            ] as const
          ).map(([k, n, label]) => (
            <div
              className={cn(
                "rounded-2xl border bg-background px-4 py-3",
                k === "need" && n > 0
                  ? "border-amber-300/60 bg-gradient-to-br from-amber-50 to-background dark:from-amber-500/10"
                  : k === "problem" && n > 0
                    ? "border-red-300/60 bg-gradient-to-br from-red-50 to-background dark:from-red-500/10"
                    : "border-border/70",
              )}
              data-testid={`tasks-stat-${k}`}
              key={k}
            >
              <b
                className={cn(
                  "block text-2xl tracking-tight",
                  k === "need" && n > 0 && "text-amber-600 dark:text-amber-300",
                  k === "problem" && n > 0 && "text-red-600 dark:text-red-400",
                )}
              >
                {n}
              </b>
              <span className="text-xs text-muted-foreground">{label}</span>
            </div>
          ))}
        </div>
        <div className="mb-1 flex flex-wrap gap-1.5">
          <button
            className={cn("rounded-full border px-3 py-1 text-xs", filter === "all" ? "border-primary/30 bg-primary/10 font-semibold text-primary" : "border-border/70 bg-background text-muted-foreground")}
            onClick={() => setFilter("all")}
            type="button"
          >
            All
          </button>
          {projects.map((p) => (
            <button
              className={cn(
                "flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs",
                filter === p.id ? "border-primary/30 bg-primary/10 font-semibold text-primary" : "border-border/70 bg-background text-muted-foreground",
              )}
              key={p.id}
              onClick={() => setFilter(p.id)}
              type="button"
            >
              <Dot color={colorOf[p.id]} />
              {p.name}
            </button>
          ))}
        </div>
        {section("problem", "FAILED OR STUCK")}
        {section("need", "NEEDS YOU")}
        {section("work", "IN PROGRESS")}
        {section("new", "NOT STARTED")}
        {section("done", "DONE THIS WEEK")}
        {!flat.length && !loading ? (
          <div className="mt-10 flex flex-col items-center gap-2 text-center text-sm text-muted-foreground">
            <CheckCircle2 className="h-8 w-8 text-emerald-500" />
            Nothing here yet. Create a task and the team starts on it.
          </div>
        ) : null}
        {loading && !flat.length ? <p className="mt-8 text-center text-sm text-muted-foreground">Loading tasks…</p> : null}
        </div>
      </main>
      {current ? (
      <aside className="hidden min-h-0 flex-col overflow-y-auto bg-background lg:flex" data-testid="tasks-detail">
          <>
            <div className="px-6 pt-5">
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Dot color={current.color} />
                <span className="font-semibold text-foreground/80">{current.project.name}</span>
                <span className="rounded-md bg-muted px-1.5 font-mono text-[11px]">#{current.issue.id.slice(0, 8)}</span>
                {priorityOf(current.issue) ? (
                  <span className="rounded-md bg-red-50 px-1.5 text-[10.5px] font-bold uppercase text-red-700 dark:bg-red-500/10 dark:text-red-300">{priorityOf(current.issue)}</span>
                ) : null}
                <button
                  className="ml-auto flex items-center gap-1 hover:text-foreground"
                  onClick={() => void goProject(current.project.id, { issueId: current.issue.id, repositoryId: current.repo.id })}
                  type="button"
                >
                  Open full page <ArrowUpRight className="h-3.5 w-3.5" />
                </button>
                <button
                  aria-label="Close"
                  className="rounded-md p-1 hover:bg-muted hover:text-foreground"
                  data-testid="tasks-detail-close"
                  onClick={() => setSelected(null)}
                  type="button"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              <h2 className="mt-2.5 text-xl font-bold leading-snug text-foreground" dir="auto">
                {current.issue.title}
              </h2>
              <div className="mt-3 flex items-center gap-2.5 rounded-xl border border-border/70 bg-muted/30 px-3 py-2.5">
                {person ? <OrgAvatar badge={false} person={person} size={32} /> : <ListChecks className="h-5 w-5 text-muted-foreground" />}
                <div className="min-w-0">
                  <b className="block text-sm text-foreground">{person?.name ?? "Not assigned yet"}</b>
                  <span className="block truncate text-xs text-muted-foreground">{person?.title ?? "Create & start sends a task to the developer"}</span>
                </div>
                {groupOf(current) === "need" ? (
                  <div className="ml-auto text-right">
                    <b className="text-sm text-amber-700 dark:text-amber-300">{sinceLabel(waitingSince(current))}</b>
                    <span className="block text-[11px] text-muted-foreground">waiting for you</span>
                  </div>
                ) : null}
              </div>
            </div>
            <div className="pt-3 [&_[data-testid=task-cycle-card]]:mx-6">
              <TaskCycleCard issue={current.issue} key={keyOf(current)} project={current.repo} />
            </div>
          </>
      </aside>
      ) : null}
      <CreateProjectIssueDialog
        initialProjectId={filter !== "all" ? filter : undefined}
        onCreated={(_p, r, issueId) => setSelected(`${r.id}:${issueId}`)}
        onOpenChange={setCreating}
        open={creating}
        projects={projects}
      />
    </div>
  );
}
