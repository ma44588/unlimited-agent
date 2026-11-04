/**
 * Unlimited Agent — Task Desk data for project tasks.
 *
 * Stages come from the server's Task Desk (owner-signed admin API). Decisions are ordinary
 * signed events: an approval or a change request is a task comment (the Task Desk reads it),
 * Done/Cancel is a NIP-34 status event signed by the owner.
 */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import type { ProjectIssue, Repository } from "@/features/projects/hooks";
import { relayClient } from "@/shared/api/relayClient";
import { signRelayEvent } from "@/shared/api/tauri";
import { KIND_GIT_STATUS_CLOSED, KIND_GIT_STATUS_MERGED } from "@/shared/constants/kinds";
import { odooApi } from "@/features/unlimited/odoo/api";

export type TaskStageKey =
  | "planning"
  | "awaiting_approval"
  | "executing"
  | "in_review"
  | "documenting"
  | "documented"
  | "done"
  | "cancelled";

export type TaskStepTokens = { input: number; output: number; cache_read: number; cache_write: number; turns: number };

/** One finished or running stage: when it started, how long it took, who worked on it and the tokens used. */
export type TaskStepDetail = {
  stage: TaskStageKey;
  start: number;
  end: number | null;
  seconds: number;
  worker: "developer" | "documentation" | "owner";
  tokens?: TaskStepTokens;
};

export type TaskStage = {
  stage: TaskStageKey;
  steps?: TaskStepDetail[];
  since: number;
  round?: number;
  history?: [number, string][];
  plan_id?: string;
  result_id?: string;
  /** Set by the server when the task is in trouble: its staging build failed, or a step ran far too long. */
  problem?: "build_failed" | "stuck" | null;
  /** Sensitive steps listed in the plan (🔐 lines); approving the plan allows exactly these. */
  perms?: TaskPerm[];
  /** Requests outside the plan that wait for the owner, answered on the task. */
  asks?: TaskAsk[];
};

export type TaskPerm = { model: string; ids: number[]; method: string; label: string; used_at?: number | null };
export type TaskAsk = {
  id: string;
  at: number;
  title: string;
  kind: "change_code" | "change" | "run" | "delete" | "call";
  why?: string;
  old?: string;
  new?: string;
};

export type TaskStages = {
  enabled: boolean;
  demo?: boolean;
  developer?: string;
  documentation?: string;
  stages: Record<string, TaskStage>;
};

const DEMO_ORDER: TaskStageKey[] = ["awaiting_approval", "executing", "in_review", "planning", "documented"];

/** The stage of one task. In the browser design preview, demo tasks are spread over the cycle. */
export function stageFor(data: TaskStages, issueId: string): TaskStage | undefined {
  if (!data.demo) return data.stages[issueId];
  const n = [...issueId].reduce((a, c) => (a * 31 + c.charCodeAt(0)) >>> 0, 7);
  const stage = DEMO_ORDER[n % DEMO_ORDER.length];
  const since = Math.floor(Date.now() / 1000) - ((n % 50) + 2) * 60;
  const t = (k: number, i: number, o: number) => ({ input: k, output: o, cache_read: i, cache_write: Math.round(i / 9), turns: 12 });
  const steps: TaskStepDetail[] = [
    { stage: "planning", start: since - 1500, end: since - 1350, seconds: 150, worker: "developer", tokens: t(820, 182000, 6400) },
    { stage: "awaiting_approval", start: since - 1350, end: since - 1260, seconds: 90, worker: "owner" },
    { stage: "executing", start: since - 1260, end: since - 730, seconds: 530, worker: "developer", tokens: t(2400, 1310000, 21800) },
    { stage: "in_review", start: since - 730, end: since, seconds: 730, worker: "owner" },
  ];
  const problem = stage === "executing" && n % 3 === 0 ? (n % 2 ? "build_failed" : "stuck") : null;
  const perms: TaskPerm[] = [
    { model: "ir.cron", ids: [85], method: "write", label: "تعديل كود Automatic Absence Work Entries", used_at: since - 600 },
    { model: "ir.cron", ids: [85], method: "method_direct_trigger", label: "تشغيله مرة للتجربة", used_at: since - 400 },
    { model: "ir.actions.server", ids: [1495], method: "run", label: "إعادة حساب قسايم أكتوبر (93 قسيمة)", used_at: null },
  ];
  const asks: TaskAsk[] =
    stage === "executing" && n % 3 === 1
      ? [
          {
            id: "demo-ask",
            at: since + 60,
            title: "Change the code of server action “Payslip: send by email”",
            kind: "change_code",
            why: "إيميل القسيمة لسه بيعرض سطر الغياب القديم، عاوز أشيله من كود القالب.",
            old: "line = slip.get_line('ABS')\nbody += f\"Absence: {line}\"",
            new: "body += render_lines(slip, exclude=['ABS_OLD'])",
          },
        ]
      : [];
  return { stage, since, round: 1, steps, problem: asks.length ? null : problem, perms, asks };
}

/** The eight steps of the cycle, in order. */
export const TASK_STEPS: { key: string; label: string; who: "you" | "agent" | "auto" }[] = [
  { key: "request", label: "Request", who: "you" },
  { key: "planning", label: "Plan", who: "agent" },
  { key: "awaiting_approval", label: "Your approval", who: "you" },
  { key: "executing", label: "Build", who: "agent" },
  { key: "build", label: "Deploy", who: "auto" },
  { key: "testing", label: "Test", who: "agent" },
  { key: "in_review", label: "Your review", who: "you" },
  { key: "documenting", label: "Team summary", who: "agent" },
];

/** Index of the active step (0-based); executing covers code, build and tests (steps 3-5). */
export function activeStepIndex(stage: TaskStageKey | undefined): number {
  switch (stage) {
    case undefined:
      return 0;
    case "planning":
      return 1;
    case "awaiting_approval":
      return 2;
    case "executing":
      return 3;
    case "in_review":
      return 6;
    case "documenting":
      return 7;
    case "documented":
    case "done":
      return 8;
    default:
      return -1;
  }
}

export const STAGE_LABEL: Record<TaskStageKey, string> = {
  planning: "Planning",
  awaiting_approval: "Your approval",
  executing: "Building",
  in_review: "Your review",
  documenting: "Team summary",
  documented: "Documented",
  done: "Done",
  cancelled: "Cancelled",
};

export type StageTone = "you" | "work" | "review" | "done" | "muted";

/** Visual tone per stage (semantic colours, separate from the brand accent). */
export const STAGE_TONE: Record<TaskStageKey, StageTone> = {
  planning: "work",
  awaiting_approval: "you",
  executing: "work",
  in_review: "review",
  documenting: "work",
  documented: "done",
  done: "done",
  cancelled: "muted",
};

export const TONE_CLASS: Record<StageTone, string> = {
  you: "bg-sky-500/10 text-sky-700 ring-1 ring-inset ring-sky-500/25 dark:text-sky-300",
  work: "bg-amber-500/10 text-amber-700 ring-1 ring-inset ring-amber-500/25 dark:text-amber-300",
  review: "bg-violet-500/10 text-violet-700 ring-1 ring-inset ring-violet-500/25 dark:text-violet-300",
  done: "bg-emerald-500/10 text-emerald-700 ring-1 ring-inset ring-emerald-500/25 dark:text-emerald-300",
  muted: "bg-muted text-muted-foreground ring-1 ring-inset ring-border/60",
};

export function useTaskStages(project: Repository | null | undefined) {
  return useQuery({
    queryKey: ["unlimited", "task-stages", project?.id ?? "none"],
    queryFn: () => odooApi.taskStages(project!.id),
    enabled: Boolean(project?.id),
    refetchInterval: 15_000,
    staleTime: 10_000,
    retry: false,
  });
}

/** Short Arabic duration since a unix timestamp. */
export function sinceLabel(since: number | undefined, now = Date.now() / 1000): string {
  if (!since) return "";
  const s = Math.max(0, Math.floor(now - since));
  if (s < 60) return "now";
  const m = Math.floor(s / 60);
  if (m < 60) return `${m} m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} h`;
  return `${Math.floor(h / 24)} d`;
}

export function invalidateTaskQueries(
  queryClient: ReturnType<typeof useQueryClient>,
  project: Repository,
) {
  void queryClient.invalidateQueries({ queryKey: ["project", project.id, "issues"] });
  void queryClient.invalidateQueries({ queryKey: ["projects", "work-items"] });
  void queryClient.invalidateQueries({ queryKey: ["projects", "activity-summaries"] });
  void queryClient.invalidateQueries({ queryKey: ["unlimited", "task-stages", project.id] });
}

/** Close a task as Done (1631) or Cancelled (1632). Only the task author / repo owner is trusted. */
export function useSetTaskStatusMutation(project: Repository) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ issue, status }: { issue: ProjectIssue; status: "done" | "closed" }) => {
      const recipients = new Set([project.owner.toLowerCase(), issue.author.toLowerCase()]);
      const event = await signRelayEvent({
        kind: status === "done" ? KIND_GIT_STATUS_MERGED : KIND_GIT_STATUS_CLOSED,
        content: "",
        tags: [
          ["e", issue.id, "", "root"],
          ["a", project.repoAddress],
          ...[...recipients].map((p) => ["p", p]),
        ],
      });
      await relayClient.publishEvent(event, "Timed out updating task.", "Failed to update task.");
    },
    onSuccess: () => invalidateTaskQueries(queryClient, project),
  });
}
