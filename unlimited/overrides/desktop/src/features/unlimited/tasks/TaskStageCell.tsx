/**
 * Unlimited Agent — compact stage pill for a task row: where the task is in the cycle and for how long.
 */
import type { Repository } from "@/features/projects/hooks";
import { cn } from "@/shared/lib/cn";
import { activeStepIndex, sinceLabel, STAGE_LABEL, STAGE_TONE, stageFor, TONE_CLASS, useTaskStages } from "./taskDesk";

export function TaskStageCell({ issueId, project }: { issueId: string; project: Repository }) {
  const { data } = useTaskStages(project);
  if (!data?.enabled) return null;
  const stage = stageFor(data, issueId);
  if (!stage) {
    return <span className="hidden w-36 shrink-0 md:block" data-testid="task-stage-cell" />;
  }
  const index = activeStepIndex(stage.stage);
  const step = index < 0 ? -1 : Math.min(index + 1, 8);
  return (
    <span
      className="hidden w-36 shrink-0 items-center justify-end gap-1.5 md:flex"
      data-testid="task-stage-cell"
      dir="rtl"
      title={`${STAGE_LABEL[stage.stage]} · ${sinceLabel(stage.since)}`}
    >
      <span className={cn("truncate rounded-full px-2 py-0.5 text-[11px] font-medium", TONE_CLASS[STAGE_TONE[stage.stage]])}>
        {STAGE_LABEL[stage.stage]}
      </span>
      {step >= 0 ? (
        <span className="shrink-0 text-[11px] tabular-nums text-muted-foreground/70">{step}/8</span>
      ) : null}
    </span>
  );
}
