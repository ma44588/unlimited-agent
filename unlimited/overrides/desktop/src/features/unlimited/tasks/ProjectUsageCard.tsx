/**
 * Unlimited Agent — the whole project at a glance, above its task list: how much work the server employees
 * did (time and tokens) per task and per employee, and the files they delivered.
 */
import { useQuery } from "@tanstack/react-query";
import { BarChart3, ChevronDown } from "lucide-react";
import * as React from "react";

import type { ProjectIssue, Repository } from "@/features/projects/hooks";
import { odooApi } from "@/features/unlimited/odoo/api";
import { cn } from "@/shared/lib/cn";
import { AgentFileChip, AgentFileViewer, useAgentFiles } from "./AgentFiles";
import { STAGE_LABEL, STAGE_TONE, stageFor, type TaskStepDetail, TONE_CLASS, useTaskStages } from "./taskDesk";

function k(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1000) return `${(n / 1000).toFixed(n >= 10_000 ? 0 : 1)}k`;
  return String(n);
}

function duration(seconds: number): string {
  if (seconds < 60) return `${seconds} ث`;
  const m = Math.round(seconds / 60);
  if (m < 60) return `${m} د`;
  return `${Math.floor(m / 60)} س ${m % 60} د`;
}

function stepSeconds(s: TaskStepDetail, now: number): number {
  return s.end === null ? Math.max(0, Math.floor(now - s.start)) : s.seconds;
}

function stepTokens(s: TaskStepDetail): number {
  return s.tokens ? s.tokens.input + s.tokens.output + s.tokens.cache_read + s.tokens.cache_write : 0;
}

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="min-w-0 rounded-lg border border-border/60 bg-background/70 px-3 py-2">
      <p className="truncate text-[11px] text-muted-foreground">{label}</p>
      <p className="truncate text-base font-semibold tabular-nums text-foreground" dir="ltr">
        {value}
      </p>
      {hint ? <p className="truncate text-[11px] text-muted-foreground/80">{hint}</p> : null}
    </div>
  );
}

export function ProjectUsageCard({ issues, project }: { issues: ProjectIssue[]; project: Repository }) {
  const stagesQuery = useTaskStages(project);
  const enabled = Boolean(stagesQuery.data?.enabled);
  const usageQuery = useQuery({
    queryKey: ["unlimited", "employee-usage", 30],
    queryFn: () => odooApi.employeeUsage(30),
    enabled,
    staleTime: 60_000,
    refetchInterval: 120_000,
    retry: false,
  });
  const filesQuery = useAgentFiles(enabled);
  const [open, setOpen] = React.useState(false);
  const [viewing, setViewing] = React.useState<string | null>(null);
  if (!enabled || !stagesQuery.data) return null;

  const data = stagesQuery.data;
  const now = Date.now() / 1000;
  const rows = issues
    .map((issue) => {
      const stage = stageFor(data, issue.id);
      const steps = (stage?.steps ?? []).filter((s) => !["documented", "cancelled", "done"].includes(s.stage));
      const agent = steps.filter((s) => s.worker !== "owner");
      return {
        issue,
        stage,
        agentSeconds: agent.reduce((a, s) => a + stepSeconds(s, now), 0),
        ownerSeconds: steps.filter((s) => s.worker === "owner").reduce((a, s) => a + stepSeconds(s, now), 0),
        tokens: agent.reduce((a, s) => a + stepTokens(s), 0),
        counted: agent.some((s) => (s.tokens?.turns ?? 0) > 0),
      };
    })
    .filter((r) => r.stage);
  const agentSeconds = rows.reduce((a, r) => a + r.agentSeconds, 0);
  const ownerSeconds = rows.reduce((a, r) => a + r.ownerSeconds, 0);
  const taskTokens = rows.reduce((a, r) => a + r.tokens, 0);
  const employees = usageQuery.data?.employees ?? [];
  const allTokens = employees.reduce(
    (a, e) => a + e.total.input + e.total.output + e.total.cache_read + e.total.cache_write,
    0,
  );
  const files = filesQuery.data ?? [];
  const maxDay = Math.max(1, ...employees.flatMap((e) => e.days.map((d) => d.tokens)));

  return (
    <section className="mx-4 mb-3 mt-2 rounded-xl border border-border/70 bg-muted/25" data-testid="project-usage-card" dir="rtl">
      <button
        className="flex w-full flex-wrap items-center justify-between gap-2 px-4 py-3"
        onClick={() => setOpen((o) => !o)}
        type="button"
      >
        <span className="flex items-center gap-2 text-sm font-semibold text-foreground">
          <BarChart3 className="h-4 w-4 text-muted-foreground" /> استهلاك المشروع وملفاته
        </span>
        <span className="flex items-center gap-3 text-xs text-muted-foreground">
          <span>
            {rows.length} تاسك · شغل الموظفين <b className="font-medium text-foreground">{duration(agentSeconds)}</b>
          </span>
          <span>
            توكنز آخر 30 يوم{" "}
            <b className="font-medium text-foreground" dir="ltr">
              {usageQuery.data ? k(allTokens) : "…"}
            </b>
          </span>
          {files.length ? <span>{files.length} ملف</span> : null}
          <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", open && "rotate-180")} />
        </span>
      </button>

      {open ? (
        <div className="space-y-4 border-t border-border/60 p-4">
          <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
            <Stat hint="تخطيط + تنفيذ + توثيق" label="شغل الموظفين على التاسكات" value={duration(agentSeconds)} />
            <Stat hint="موافقات ومراجعات" label="وقت انتظارك" value={duration(ownerSeconds)} />
            <Stat hint="من وقت تفعيل العدّ" label="توكنز التاسكات" value={taskTokens ? k(taskTokens) : "—"} />
            <Stat hint="تاسكات + محادثات + اجتماعات" label="كل شغل الموظفين · 30 يوم" value={usageQuery.data ? k(allTokens) : "…"} />
          </div>

          <div className="overflow-hidden rounded-lg border border-border/60 bg-background/60">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-muted-foreground">
                  <th className="px-3 py-1.5 text-start font-medium">التاسك</th>
                  <th className="px-3 py-1.5 text-start font-medium">المرحلة</th>
                  <th className="px-3 py-1.5 text-start font-medium">شغل الموظفين</th>
                  <th className="px-3 py-1.5 text-start font-medium">انتظارك</th>
                  <th className="px-3 py-1.5 text-start font-medium">التوكنز</th>
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 ? (
                  <tr>
                    <td className="px-3 py-3 text-muted-foreground" colSpan={5}>
                      لسه مفيش تاسكات اشتغل عليها موظف.
                    </td>
                  </tr>
                ) : (
                  rows.map((r) => (
                    <tr className="border-t border-border/40" key={r.issue.id}>
                      <td className="max-w-[260px] truncate px-3 py-1.5 font-medium text-foreground" dir="auto" title={r.issue.title}>
                        {r.issue.title}
                      </td>
                      <td className="px-3 py-1.5">
                        <span className={cn("rounded-full px-2 py-0.5 text-[11px]", TONE_CLASS[STAGE_TONE[r.stage!.stage]])}>
                          {STAGE_LABEL[r.stage!.stage]}
                        </span>
                      </td>
                      <td className="px-3 py-1.5 tabular-nums">{duration(r.agentSeconds)}</td>
                      <td className="px-3 py-1.5 tabular-nums text-muted-foreground">{duration(r.ownerSeconds)}</td>
                      <td className="px-3 py-1.5 tabular-nums" dir="ltr">
                        {r.counted ? k(r.tokens) : <span className="text-muted-foreground/70">قبل تفعيل العدّ</span>}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <div className="space-y-2">
            <p className="text-xs font-semibold text-muted-foreground">كل موظف · آخر 30 يوم</p>
            <div className="grid gap-2 md:grid-cols-2">
              {employees.map((e) => {
                const total = e.total.input + e.total.output + e.total.cache_read + e.total.cache_write;
                return (
                  <div className="rounded-lg border border-border/60 bg-background/60 p-3" key={e.slug}>
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="text-sm font-medium text-foreground">{e.name}</span>
                      <span className="text-xs tabular-nums text-muted-foreground" dir="ltr">
                        {total ? `${k(total)} tokens · ${e.total.turns} turns` : "مفيش شغل متسجل"}
                      </span>
                    </div>
                    <div className="mt-2 flex h-10 items-end gap-0.5" dir="ltr">
                      {e.days.map((d) => (
                        <span
                          className="min-w-[4px] flex-1 rounded-sm bg-primary/60"
                          key={d.date}
                          style={{ height: `${Math.max(6, (d.tokens / maxDay) * 100)}%` }}
                          title={`${d.date}: ${k(d.tokens)} tokens · ${d.turns} turns`}
                        />
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
            <p className="text-[11px] text-muted-foreground/80">
              التوكنز = اللي الموديل قرأه وكتبه (ومنه الجزء المتخزّن مؤقتًا). العدّ شغال من 1 نوفمبر.
            </p>
          </div>

          <div className="space-y-2">
            <p className="text-xs font-semibold text-muted-foreground">ملفات الموظفين</p>
            {files.length ? (
              <div className="flex flex-wrap gap-2">
                {files.map((f) => (
                  <AgentFileChip file={f} key={f.name} onOpen={setViewing} />
                ))}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">لسه مفيش ملفات.</p>
            )}
          </div>
        </div>
      ) : null}
      <AgentFileViewer name={viewing} onOpenChange={(o) => !o && setViewing(null)} />
    </section>
  );
}
