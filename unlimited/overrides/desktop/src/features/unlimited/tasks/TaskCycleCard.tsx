/**
 * Unlimited Agent — the task cycle inside a project task: the eight steps, the plan or the
 * test result when it is waiting for the owner, and the decision buttons.
 */
import { Check, CircleSlash, Loader2, PenLine, Play, RotateCcw } from "lucide-react";
import * as React from "react";
import { toast } from "sonner";

import {
  type ProjectIssue,
  type Repository,
  useCreateProjectIssueCommentMutation,
} from "@/features/projects/hooks";
import { ProjectRichContent } from "@/features/projects/ui/ProjectRichContent";
import { useIdentityQuery } from "@/shared/api/hooks";
import { cn } from "@/shared/lib/cn";
import { normalizePubkey } from "@/shared/lib/pubkey";
import { Button } from "@/shared/ui/button";
import { Textarea } from "@/shared/ui/textarea";
import {
  activeStepIndex,
  sinceLabel,
  STAGE_LABEL,
  STAGE_TONE,
  stageFor,
  TASK_STEPS,
  type TaskStage,
  TONE_CLASS,
  useSetTaskStatusMutation,
  useTaskStages,
} from "./taskDesk";
import { TaskStepDetails } from "./TaskStepDetails";

function Stepper({ stage }: { stage: TaskStage | undefined }) {
  const active = activeStepIndex(stage?.stage);
  const executing = stage?.stage === "executing";
  return (
    <ol className="grid grid-cols-4 gap-x-2 gap-y-3 sm:grid-cols-8" data-testid="task-cycle-steps">
      {TASK_STEPS.map((step, i) => {
        const isActive = i === active || (executing && i >= 3 && i <= 5);
        const isDone = active > i && !(executing && i >= 3 && i <= 5);
        return (
          <li className="flex min-w-0 flex-col items-center gap-1.5 text-center" key={step.key}>
            <span
              aria-hidden="true"
              className={cn(
                "flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-semibold tabular-nums ring-1 ring-inset",
                isDone && "bg-emerald-500 text-white ring-emerald-500",
                isActive && step.who === "you" && "bg-sky-500/15 text-sky-700 ring-sky-500 dark:text-sky-300",
                isActive && step.who !== "you" && "bg-amber-500/15 text-amber-700 ring-amber-500 dark:text-amber-300",
                !isDone && !isActive && "bg-background text-muted-foreground ring-border",
              )}
            >
              {isDone ? <Check className="h-3 w-3" /> : i + 1}
            </span>
            <span
              className={cn(
                "w-full truncate text-[11px] leading-4",
                isActive ? "font-semibold text-foreground" : "text-muted-foreground",
              )}
              title={step.label}
            >
              {step.label}
            </span>
          </li>
        );
      })}
    </ol>
  );
}

export function TaskCycleCard({ issue, project }: { issue: ProjectIssue; project: Repository }) {
  const stagesQuery = useTaskStages(project);
  const identity = useIdentityQuery();
  const comment = useCreateProjectIssueCommentMutation(project);
  const setStatus = useSetTaskStatusMutation(project);
  const [mode, setMode] = React.useState<"idle" | "change">("idle");
  const [draft, setDraft] = React.useState("");

  const data = stagesQuery.data;
  if (!data?.enabled) return null;

  const stage = stageFor(data, issue.id);
  const viewer = identity.data?.pubkey ? normalizePubkey(identity.data.pubkey) : null;
  const canDecide =
    Boolean(data.demo) ||
    (viewer !== null &&
      (viewer === normalizePubkey(project.owner) || viewer === normalizePubkey(issue.author)));
  const developerAssigned = data.developer
    ? issue.assignees.some((p) => normalizePubkey(p) === normalizePubkey(data.developer!))
    : false;
  const awaiting = stage?.stage === "awaiting_approval";
  const reviewing = stage?.stage === "in_review";
  const focusId = awaiting ? stage?.plan_id : reviewing ? stage?.result_id : undefined;
  const focus =
    (focusId ? issue.comments.find((c) => c.id === focusId) : undefined) ??
    (data.demo && (awaiting || reviewing) ? issue.comments.at(-1) : undefined);
  const busy = comment.isPending || setStatus.isPending;

  async function post(content: string, success: string) {
    try {
      await comment.mutateAsync({ content, issue });
      toast.success(success);
      setMode("idle");
      setDraft("");
      void stagesQuery.refetch();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "تعذر الإرسال.");
    }
  }

  async function close(status: "done" | "closed") {
    try {
      await setStatus.mutateAsync({ issue, status });
      toast.success(status === "done" ? "اتقفل Done. Documentation هيكتب الملخص." : "التاسك اتلغى.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "تعذر تحديث التاسك.");
    }
  }

  return (
    <section
      className="mx-6 mb-4 mt-1 space-y-4 rounded-xl border border-border/70 bg-muted/25 p-4"
      data-testid="task-cycle-card"
      dir="rtl"
    >
      <header className="flex flex-wrap items-center justify-between gap-2">
        <h4 className="text-sm font-semibold text-foreground">دورة التاسك</h4>
        {stage ? (
          <span className="flex items-center gap-2 text-xs text-muted-foreground">
            {stage.round && stage.round > 1 && stage.stage !== "cancelled" ? (
              <span className="tabular-nums">نسخة الخطة {stage.round}</span>
            ) : null}
            <span className={cn("rounded-full px-2 py-0.5 text-xs font-medium", TONE_CLASS[STAGE_TONE[stage.stage]])}>
              {STAGE_LABEL[stage.stage]}
            </span>
            <span className="tabular-nums">{sinceLabel(stage.since)}</span>
          </span>
        ) : null}
      </header>

      {stage?.stage === "cancelled" ? (
        <p className="text-sm text-muted-foreground">التاسك اتلغى، ومفيش شغل عليه.</p>
      ) : (
        <Stepper stage={stage} />
      )}

      {!stage && !developerAssigned ? (
        <p className="text-sm text-muted-foreground">
          عيّن التاسك لـ <span className="font-medium text-foreground">Developer</span> من خانة Assignees علشان يبدأ يكتب الخطة.
        </p>
      ) : null}
      {!stage && developerAssigned ? (
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-3.5 w-3.5 animate-spin" /> Task Desk هيصحّي Developer خلال ثواني.
        </p>
      ) : null}
      {stage?.stage === "planning" || stage?.stage === "executing" || stage?.stage === "documenting" ? (
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
          {stage.stage === "planning"
            ? "Developer بيحلل الداتابيز والكود وطريقة الشغل وبيكتب الخطة."
            : stage.stage === "executing"
              ? "Developer بينفذ على stag ويتابع الـ build ويختبر على staging."
              : "Documentation بيكتب ملخص للفريق."}
        </p>
      ) : null}

      {(awaiting || reviewing) && focus ? (
        <div
          className={cn(
            "space-y-3 rounded-lg border bg-background p-4",
            awaiting ? "border-sky-500/40" : "border-violet-500/40",
          )}
          data-testid={awaiting ? "task-cycle-plan" : "task-cycle-result"}
        >
          <p className="text-xs font-semibold text-muted-foreground">
            {awaiting ? "الخطة اللي مستنية موافقتك" : "نتيجة التنفيذ والاختبار"}
          </p>
          <div className="max-h-[28rem] overflow-y-auto" dir="auto">
            <ProjectRichContent className="text-sm text-foreground/90" content={focus.content} tags={focus.tags} />
          </div>
        </div>
      ) : null}

      {(awaiting || reviewing) && canDecide ? (
        mode === "change" ? (
          <div className="space-y-2">
            <Textarea
              autoFocus
              id="task-cycle-change-request"
              onChange={(e) => setDraft(e.target.value)}
              placeholder={awaiting ? "اكتب التعديل اللي عايزه في الخطة…" : "اكتب الملاحظة اللي عايز Developer يصلحها…"}
              value={draft}
            />
            <div className="flex flex-wrap gap-2">
              <Button
                disabled={busy || draft.trim().length < 3}
                onClick={() => void post(draft.trim(), "اتبعت. Developer هيرجعلك بنسخة جديدة.")}
                size="sm"
              >
                <PenLine /> ابعت
              </Button>
              <Button disabled={busy} onClick={() => setMode("idle")} size="sm" variant="ghost">
                رجوع
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex flex-wrap gap-2" data-testid="task-cycle-actions">
            {awaiting ? (
              <>
                <Button
                  className="bg-sky-600 text-white hover:bg-sky-600/90"
                  disabled={busy}
                  onClick={() => void post("موافق، ابدأ", "اتوافق على الخطة. التنفيذ هيبدأ.")}
                  size="sm"
                >
                  <Play /> موافق، ابدأ
                </Button>
                <Button disabled={busy} onClick={() => setMode("change")} size="sm" variant="outline">
                  <PenLine /> اطلب تعديل
                </Button>
              </>
            ) : (
              <>
                <Button
                  className="bg-emerald-600 text-white hover:bg-emerald-600/90"
                  disabled={busy}
                  onClick={() => void close("done")}
                  size="sm"
                >
                  <Check /> تمام، اقفل Done
                </Button>
                <Button disabled={busy} onClick={() => setMode("change")} size="sm" variant="outline">
                  <RotateCcw /> رجّعه بملاحظة
                </Button>
              </>
            )}
            <Button
              className="text-destructive hover:text-destructive"
              disabled={busy}
              onClick={() => void close("closed")}
              size="sm"
              variant="ghost"
            >
              <CircleSlash /> إلغاء التاسك
            </Button>
          </div>
        )
      ) : null}

      {stage?.steps?.length ? <TaskStepDetails steps={stage.steps} /> : null}
    </section>
  );
}
