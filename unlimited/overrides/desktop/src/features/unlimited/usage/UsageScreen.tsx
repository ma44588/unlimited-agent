/**
 * Unlimited Agent — Usage: how much the server employees worked (time and tokens) across projects and tasks,
 * filtered by project, employee and period, with each task's steps and the files the employees delivered.
 */
import { useQuery } from "@tanstack/react-query";
import { BarChart3, ChevronDown, ChevronRight, Loader2 } from "lucide-react";
import * as React from "react";

import { PersonaDropdownField } from "@/features/agents/ui/PersonaDropdownField";
import { odooApi, type UsageOverview, type UsageStep } from "@/features/unlimited/odoo/api";
import { AgentFileChip, AgentFileViewer, useAgentFiles } from "@/features/unlimited/tasks/AgentFiles";
import { STAGE_LABEL, STAGE_TONE, type TaskStageKey, TONE_CLASS } from "@/features/unlimited/tasks/taskDesk";
import { cn } from "@/shared/lib/cn";

const PERIODS = [
  { days: 1, label: "Today" },
  { days: 7, label: "7 days" },
  { days: 30, label: "30 days" },
] as const;
const COLORS = ["bg-violet-500", "bg-sky-500", "bg-emerald-500", "bg-amber-500", "bg-rose-500", "bg-fuchsia-500"];
const DONE = new Set(["documented", "done", "cancelled"]);
const STEP_NAME: Record<string, string> = {
  planning: "Plan",
  awaiting_approval: "Your approval",
  executing: "Build + test",
  in_review: "Your review",
  documenting: "Team summary",
};

function k(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1000) return `${(n / 1000).toFixed(n >= 10_000 ? 0 : 1)}k`;
  return String(Math.round(n));
}

function duration(seconds: number): string {
  if (seconds < 60) return `${Math.round(seconds)} s`;
  const m = Math.round(seconds / 60);
  if (m < 60) return `${m} m`;
  return `${Math.floor(m / 60)} h ${m % 60} m`;
}

function clock(t: number): string {
  return new Date(t * 1000).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

function dayKey(t: number): string {
  return new Date(t * 1000).toISOString().slice(0, 10);
}

function stepTokens(s: UsageStep): number {
  return s.tokens ? s.tokens.input + s.tokens.output + s.tokens.cache_read + s.tokens.cache_write : 0;
}

function stepSeconds(s: UsageStep, now: number): number {
  return s.end === null && !DONE.has(s.stage) ? Math.max(0, now - s.start) : s.seconds;
}

type Row = {
  id: string;
  title: string;
  project: string;
  stage: string;
  steps: UsageStep[];
  agentSeconds: number;
  ownerSeconds: number;
  tokens: number;
  counted: boolean;
};

function compute(data: UsageOverview, project: string, employee: string, days: number) {
  const now = data.now;
  const since = now - days * 86400;
  const rows: Row[] = data.tasks
    .filter((t) => (project === "all" || t.project === project) && t.last >= since)
    .filter((t) => employee === "all" || t.steps.some((s) => s.slug === employee))
    .map((t) => {
      const steps = t.steps.filter((s) => !DONE.has(s.stage));
      const agent = steps.filter((s) => s.worker !== "owner" && (employee === "all" || s.slug === employee));
      return {
        id: t.id,
        title: t.title,
        project: t.project,
        stage: t.stage,
        steps,
        agentSeconds: agent.reduce((a, s) => a + stepSeconds(s, now), 0),
        ownerSeconds: steps.filter((s) => s.worker === "owner").reduce((a, s) => a + stepSeconds(s, now), 0),
        tokens: agent.reduce((a, s) => a + stepTokens(s), 0),
        counted: agent.some((s) => (s.tokens?.turns ?? 0) > 0),
      };
    });

  const employees = data.employees.filter((e) => employee === "all" || e.slug === employee);
  const sinceDay = dayKey(since + 1);
  const employeeTotal = (slug: string) =>
    (data.employees.find((e) => e.slug === slug)?.days ?? [])
      .filter((d) => d.date >= sinceDay)
      .reduce((a, d) => a + d.tokens, 0);

  // Tokens by employee: all their work when no project is chosen; only that project's task steps otherwise.
  const byEmployee = employees.map((e) => ({
    slug: e.slug,
    name: e.name,
    tokens:
      project === "all"
        ? employeeTotal(e.slug)
        : rows.reduce((a, r) => a + r.steps.filter((s) => s.slug === e.slug).reduce((b, s) => b + stepTokens(s), 0), 0),
  }));
  const taskTokensBy = (pid: string) =>
    data.tasks
      .filter((t) => t.project === pid && t.last >= since)
      .reduce(
        (a, t) => a + t.steps.filter((s) => employee === "all" || s.slug === employee).reduce((b, s) => b + stepTokens(s), 0),
        0,
      );
  const byProject = data.projects
    .filter((p) => project === "all" || p.id === project)
    .map((p) => ({ id: p.id, name: p.name, tokens: taskTokensBy(p.id) }));
  const allTaskTokens = byProject.reduce((a, p) => a + p.tokens, 0);
  const totalTokens =
    project === "all" ? byEmployee.reduce((a, e) => a + e.tokens, 0) : rows.reduce((a, r) => a + r.tokens, 0);
  const chats = project === "all" ? Math.max(0, totalTokens - allTaskTokens) : 0;

  // Daily bars per employee.
  const dates: string[] = [];
  for (let i = days - 1; i >= 0; i -= 1) dates.push(dayKey(now - i * 86400));
  const series = employees.map((e) => {
    const map = new Map<string, number>();
    if (project === "all") {
      for (const d of e.days) map.set(d.date, d.tokens);
    } else {
      for (const r of rows)
        for (const s of r.steps)
          if (s.slug === e.slug) map.set(dayKey(s.start), (map.get(dayKey(s.start)) ?? 0) + stepTokens(s));
    }
    return { slug: e.slug, name: e.name, values: dates.map((d) => map.get(d) ?? 0) };
  });

  return {
    rows,
    byEmployee,
    byProject,
    chats,
    totalTokens,
    agentSeconds: rows.reduce((a, r) => a + r.agentSeconds, 0),
    ownerSeconds: rows.reduce((a, r) => a + r.ownerSeconds, 0),
    done: rows.filter((r) => DONE.has(r.stage)).length,
    dates,
    series,
  };
}

function Kpi({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <div className="min-w-0 rounded-xl border border-border/60 bg-background px-4 py-3">
      <p className="truncate text-xs text-muted-foreground">{label}</p>
      <p className="mt-0.5 truncate text-2xl font-semibold tabular-nums text-foreground">{value}</p>
      <p className="truncate text-[11px] text-muted-foreground/80">{hint}</p>
    </div>
  );
}

function Card({ title, hint, children }: { title: string; hint?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="overflow-hidden rounded-xl border border-border/60 bg-background">
      <header className="flex items-center justify-between gap-2 border-b border-border/60 px-4 py-2.5">
        <h3 className="text-sm font-semibold text-foreground">{title}</h3>
        {hint ? <span className="text-xs text-muted-foreground">{hint}</span> : null}
      </header>
      {children}
    </section>
  );
}

function StageBadge({ stage }: { stage: string }) {
  const key = stage as TaskStageKey;
  return (
    <span className={cn("whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-medium", TONE_CLASS[STAGE_TONE[key]])}>
      {STAGE_LABEL[key] ?? stage}
    </span>
  );
}

export function UsageScreen() {
  const [days, setDays] = React.useState<number>(30);
  const [project, setProject] = React.useState("all");
  const [employee, setEmployee] = React.useState("all");
  const [openRows, setOpenRows] = React.useState<Set<string>>(() => new Set());
  const [viewing, setViewing] = React.useState<string | null>(null);
  const query = useQuery({
    queryKey: ["unlimited", "usage-overview", days],
    queryFn: () => odooApi.usageOverview(Math.max(days, 1)),
    staleTime: 30_000,
    refetchInterval: 60_000,
    retry: false,
  });
  const filesQuery = useAgentFiles();
  const data = query.data;
  const view = React.useMemo(
    () => (data ? compute(data, project, employee, days) : null),
    [data, project, employee, days],
  );
  const colorOf = (slug: string) =>
    COLORS[Math.max(0, (data?.employees ?? []).findIndex((e) => e.slug === slug)) % COLORS.length];
  const projectName = (id: string) => data?.projects.find((p) => p.id === id)?.name ?? id;
  const maxDay = view
    ? Math.max(1, ...view.dates.map((_, i) => view.series.reduce((a, s) => a + s.values[i], 0)))
    : 1;
  const maxRow = view ? Math.max(1, ...view.rows.map((r) => r.tokens)) : 1;
  const periodLabel = PERIODS.find((p) => p.days === days)?.label ?? `${days} days`;
  const toggleRow = (id: string) =>
    setOpenRows((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  return (
    <div className="flex h-full min-h-0 w-full" data-testid="usage-screen">
      <main className="min-w-0 flex-1 overflow-y-auto px-6 py-5">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-xl bg-muted/45 px-4 py-3">
          <h1 className="flex items-center gap-2 text-base font-semibold text-foreground">
            <BarChart3 className="h-4 w-4 text-muted-foreground" /> Usage
          </h1>
          <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
            <span className="rounded-full border border-border/70 bg-background px-2.5 py-1">
              Project <b className="font-semibold text-foreground">{project === "all" ? "All" : projectName(project)}</b>
            </span>
            <span className="rounded-full border border-border/70 bg-background px-2.5 py-1">
              Employee{" "}
              <b className="font-semibold text-foreground">
                {employee === "all" ? "All" : (data?.employees.find((e) => e.slug === employee)?.name ?? employee)}
              </b>
            </span>
            <span className="rounded-full border border-border/70 bg-background px-2.5 py-1">
              Period <b className="font-semibold text-foreground">{periodLabel}</b>
            </span>
          </div>
        </div>

        {query.isLoading ? (
          <p className="flex items-center gap-2 py-16 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading usage from the server…
          </p>
        ) : query.isError || !view || !data ? (
          <p className="py-16 text-sm text-muted-foreground">Usage is available to the workspace owner only.</p>
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
              <Kpi hint="read + written by the model" label="Tokens" value={view.totalTokens ? k(view.totalTokens) : "—"} />
              <Kpi hint="plan + build + test + summary" label="Employee work time" value={duration(view.agentSeconds)} />
              <Kpi hint="approvals and reviews" label="Waiting for you" value={duration(view.ownerSeconds)} />
              <Kpi
                hint={`${view.done} done · ${view.rows.length - view.done} in progress`}
                label="Tasks"
                value={String(view.rows.length)}
              />
            </div>

            <Card
              hint={
                <span className="flex flex-wrap items-center gap-3">
                  {view.series.map((s) => (
                    <span className="inline-flex items-center gap-1.5" key={s.slug}>
                      <i className={cn("inline-block h-2.5 w-2.5 rounded-sm", colorOf(s.slug))} />
                      {s.name}
                    </span>
                  ))}
                </span>
              }
              title="Tokens per day"
            >
              <div className="flex h-36 items-end gap-1 px-4 pt-4">
                {view.dates.map((d, i) => {
                  const total = view.series.reduce((a, s) => a + s.values[i], 0);
                  return (
                    <div className="flex h-full min-w-0 flex-1 flex-col justify-end gap-px" key={d} title={`${d}: ${k(total)} tokens`}>
                      {view.series.map((s) =>
                        s.values[i] ? (
                          <i
                            className={cn("block rounded-[3px]", colorOf(s.slug))}
                            key={s.slug}
                            style={{ height: `${Math.max(3, (s.values[i] / maxDay) * 100)}%` }}
                          />
                        ) : null,
                      )}
                    </div>
                  );
                })}
              </div>
              <div className="flex gap-1 px-4 pb-3 pt-1.5 text-[10px] text-muted-foreground">
                {view.dates.map((d, i) => (
                  <span className="min-w-0 flex-1 overflow-visible whitespace-nowrap text-center" key={d}>
                    {view.dates.length <= 10 || i % 5 === 0 || i === view.dates.length - 1
                      ? new Date(`${d}T12:00:00Z`).toLocaleDateString("en-US", { month: "short", day: "numeric" })
                      : ""}
                  </span>
                ))}
              </div>
            </Card>

            <Card hint="Click a task to see each step" title="Tasks">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-muted/30 text-xs text-muted-foreground">
                    <th className="px-4 py-2 text-start font-medium">Task</th>
                    <th className="px-4 py-2 text-start font-medium">Project</th>
                    <th className="px-4 py-2 text-start font-medium">Stage</th>
                    <th className="px-4 py-2 text-start font-medium">Employee time</th>
                    <th className="px-4 py-2 text-start font-medium">Waiting</th>
                    <th className="px-4 py-2 text-start font-medium">Tokens</th>
                  </tr>
                </thead>
                <tbody>
                  {view.rows.length === 0 ? (
                    <tr>
                      <td className="px-4 py-6 text-center text-sm text-muted-foreground" colSpan={6}>
                        No tasks in this period.
                      </td>
                    </tr>
                  ) : (
                    view.rows.map((r) => {
                      const open = openRows.has(r.id);
                      return (
                        <React.Fragment key={r.id}>
                          <tr className="cursor-pointer border-t border-border/50 hover:bg-muted/25" onClick={() => toggleRow(r.id)}>
                            <td className="max-w-[320px] px-4 py-2.5">
                              <span className="flex min-w-0 items-center gap-1.5 font-medium text-foreground">
                                {open ? (
                                  <ChevronDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                                ) : (
                                  <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                                )}
                                <span className="truncate" dir="auto" title={r.title}>
                                  {r.title}
                                </span>
                              </span>
                            </td>
                            <td className="px-4 py-2.5 text-muted-foreground">{projectName(r.project)}</td>
                            <td className="px-4 py-2.5">
                              <StageBadge stage={r.stage} />
                            </td>
                            <td className="px-4 py-2.5 tabular-nums">{duration(r.agentSeconds)}</td>
                            <td className="px-4 py-2.5 tabular-nums text-muted-foreground">{duration(r.ownerSeconds)}</td>
                            <td className="px-4 py-2.5 tabular-nums">
                              {r.counted ? (
                                <span className="flex items-center gap-2">
                                  {k(r.tokens)}
                                  <span className="hidden h-1.5 w-24 overflow-hidden rounded-full bg-muted md:inline-block">
                                    <i className="block h-full bg-violet-500" style={{ width: `${(r.tokens / maxRow) * 100}%` }} />
                                  </span>
                                </span>
                              ) : (
                                <span className="text-xs text-muted-foreground/70">not counted</span>
                              )}
                            </td>
                          </tr>
                          {open
                            ? r.steps.map((s, i) => (
                                <tr className="bg-muted/20 text-xs text-muted-foreground" key={`${r.id}-${i}`}>
                                  <td className="py-1.5 pe-4 ps-10">
                                    {STEP_NAME[s.stage] ?? s.stage}
                                    {s.worker !== "owner" && s.employee ? ` · ${s.employee}` : ""}
                                    {s.end === null ? (
                                      <span className="ms-1.5 text-amber-600 dark:text-amber-400">• running</span>
                                    ) : null}
                                  </td>
                                  <td className="px-4 py-1.5" />
                                  <td className="px-4 py-1.5 tabular-nums">{clock(s.start)}</td>
                                  <td className="px-4 py-1.5 tabular-nums">
                                    {s.worker !== "owner" ? duration(stepSeconds(s, data.now)) : ""}
                                  </td>
                                  <td className="px-4 py-1.5 tabular-nums">
                                    {s.worker === "owner" ? duration(stepSeconds(s, data.now)) : ""}
                                  </td>
                                  <td className="px-4 py-1.5 tabular-nums">
                                    {s.worker === "owner" ? "—" : (s.tokens?.turns ?? 0) > 0 ? k(stepTokens(s)) : "not counted"}
                                  </td>
                                </tr>
                              ))
                            : null}
                        </React.Fragment>
                      );
                    })
                  )}
                </tbody>
              </table>
            </Card>

            <Card hint="Open inside the app" title="Files from employees">
              {(filesQuery.data ?? []).length ? (
                <div className="flex flex-wrap gap-2 p-4">
                  {(filesQuery.data ?? []).map((f) => (
                    <AgentFileChip file={f} key={f.name} onOpen={setViewing} />
                  ))}
                </div>
              ) : (
                <p className="p-4 text-sm text-muted-foreground">No files yet.</p>
              )}
            </Card>
          </div>
        )}
      </main>

      <aside className="w-72 shrink-0 space-y-4 overflow-y-auto border-l border-border/60 px-4 py-5" data-testid="usage-filters">
        <h2 className="text-sm font-medium text-muted-foreground">Usage</h2>
        <div className="space-y-1.5">
          <label className="text-xs text-muted-foreground" htmlFor="usage-project">
            Project
          </label>
          <PersonaDropdownField
            id="usage-project"
            onValueChange={setProject}
            options={[
              { value: "all", label: "All projects" },
              ...(data?.projects ?? []).map((p) => ({ value: p.id, label: p.name })),
            ]}
            placeholder="All projects"
            value={project}
          />
        </div>
        <div className="space-y-1.5">
          <label className="text-xs text-muted-foreground" htmlFor="usage-employee">
            Employee
          </label>
          <PersonaDropdownField
            id="usage-employee"
            onValueChange={setEmployee}
            options={[
              { value: "all", label: "All employees" },
              ...(data?.employees ?? []).map((e) => ({ value: e.slug, label: e.name })),
            ]}
            placeholder="All employees"
            value={employee}
          />
        </div>
        <div className="space-y-1.5">
          <span className="text-xs text-muted-foreground">Period</span>
          <div className="flex rounded-lg bg-muted/60 p-0.5">
            {PERIODS.map((p) => (
              <button
                className={cn(
                  "flex-1 rounded-md py-1 text-xs transition-colors",
                  days === p.days ? "bg-background font-semibold text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
                )}
                key={p.days}
                onClick={() => setDays(p.days)}
                type="button"
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>

        {view ? (
          <>
            <div className="space-y-1">
              <p className="pt-2 text-xs text-muted-foreground">By employee</p>
              {view.byEmployee.map((e) => (
                <div className="flex items-center justify-between border-b border-border/50 py-2 text-sm" key={e.slug}>
                  <span className="flex items-center gap-2">
                    <i className={cn("inline-block h-2.5 w-2.5 rounded-full", colorOf(e.slug))} />
                    {e.name}
                  </span>
                  <b className="tabular-nums">{e.tokens ? k(e.tokens) : "—"}</b>
                </div>
              ))}
            </div>
            <div className="space-y-1">
              <p className="pt-2 text-xs text-muted-foreground">By project</p>
              {view.byProject.map((p) => (
                <div className="flex items-center justify-between border-b border-border/50 py-2 text-sm" key={p.id}>
                  <span className="truncate">{p.name}</span>
                  <b className="tabular-nums">{p.tokens ? k(p.tokens) : "—"}</b>
                </div>
              ))}
              {project === "all" ? (
                <div className="flex items-center justify-between border-b border-border/50 py-2 text-sm">
                  <span className="text-muted-foreground">Chats, not in a task</span>
                  <b className="tabular-nums">{view.chats ? k(view.chats) : "—"}</b>
                </div>
              ) : null}
            </div>
            <p className="text-[11px] leading-4 text-muted-foreground/80">
              Tokens are what the model read and wrote, including cached context. Counting started on Nov 1, 2026; older
              work shows time only.
            </p>
          </>
        ) : null}
      </aside>
      <AgentFileViewer name={viewing} onOpenChange={(o) => !o && setViewing(null)} />
    </div>
  );
}
