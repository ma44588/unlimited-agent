/**
 * Unlimited Agent — per-stage details of a task: who worked on each stage, when it started,
 * how long it took and the tokens the server employee used in it.
 */
import { ChevronDown } from "lucide-react";
import * as React from "react";

import { cn } from "@/shared/lib/cn";
import { STAGE_LABEL, type TaskStepDetail, type TaskStepTokens } from "./taskDesk";

const WORKER: Record<TaskStepDetail["worker"], string> = {
  developer: "Developer",
  documentation: "Documentation",
  owner: "إنت",
};

function duration(seconds: number): string {
  if (seconds < 60) return `${seconds} ث`;
  const m = Math.round(seconds / 60);
  if (m < 60) return `${m} د`;
  return `${Math.floor(m / 60)} س ${m % 60} د`;
}

function clock(t: number): string {
  return new Date(t * 1000).toLocaleTimeString("ar-EG", { hour: "2-digit", minute: "2-digit" });
}

function k(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1000) return `${(n / 1000).toFixed(n >= 10_000 ? 0 : 1)}k`;
  return String(n);
}

/** Tokens the model processed: new input + cached context read/written + output. */
function total(t: TaskStepTokens): number {
  return t.input + t.cache_read + t.cache_write + t.output;
}

function TokensCell({ t }: { t?: TaskStepTokens }) {
  if (!t) return <span className="text-muted-foreground/60">—</span>;
  if (t.turns === 0) return <span className="text-muted-foreground/70">مش متسجل</span>;
  return (
    <span
      className="tabular-nums"
      dir="ltr"
      title={`input ${t.input.toLocaleString()} · cache read ${t.cache_read.toLocaleString()} · cache write ${t.cache_write.toLocaleString()} · output ${t.output.toLocaleString()} · ${t.turns} turns`}
    >
      {k(total(t))} <span className="text-muted-foreground">(out {k(t.output)})</span>
    </span>
  );
}

export function TaskStepDetails({ steps }: { steps: TaskStepDetail[] }) {
  const [open, setOpen] = React.useState(true);
  const rows = steps.filter((s) => !["documented", "cancelled", "done"].includes(s.stage));
  if (rows.length === 0) return null;
  const now = Date.now() / 1000;
  const seconds = (s: TaskStepDetail) => (s.end === null ? Math.max(0, Math.floor(now - s.start)) : s.seconds);
  const agentTime = rows.filter((s) => s.worker !== "owner").reduce((a, s) => a + seconds(s), 0);
  const ownerTime = rows.filter((s) => s.worker === "owner").reduce((a, s) => a + seconds(s), 0);
  const sum = rows.reduce(
    (a, s) => (s.tokens ? { all: a.all + total(s.tokens), out: a.out + s.tokens.output, turns: a.turns + s.tokens.turns } : a),
    { all: 0, out: 0, turns: 0 },
  );

  return (
    <div className="rounded-lg border border-border/60 bg-background/60" data-testid="task-step-details">
      <button
        className="flex w-full items-center justify-between gap-2 px-3 py-2 text-xs"
        onClick={() => setOpen((o) => !o)}
        type="button"
      >
        <span className="font-semibold text-foreground">تفاصيل المراحل والاستهلاك</span>
        <span className="flex items-center gap-3 text-muted-foreground">
          <span>شغل الموظفين: <b className="font-medium text-foreground">{duration(agentTime)}</b></span>
          <span>انتظارك: <b className="font-medium text-foreground">{duration(ownerTime)}</b></span>
          <span>
            التوكنز: <b className="font-medium text-foreground" dir="ltr">{sum.turns ? k(sum.all) : "—"}</b>
          </span>
          <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", open && "rotate-180")} />
        </span>
      </button>
      {open ? (
        <table className="w-full border-t border-border/60 text-xs">
          <thead>
            <tr className="text-muted-foreground">
              <th className="px-3 py-1.5 text-start font-medium">المرحلة</th>
              <th className="px-3 py-1.5 text-start font-medium">مين</th>
              <th className="px-3 py-1.5 text-start font-medium">بدأت</th>
              <th className="px-3 py-1.5 text-start font-medium">المدة</th>
              <th className="px-3 py-1.5 text-start font-medium">التوكنز</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((s, i) => (
              <tr className="border-t border-border/40" key={`${s.stage}-${s.start}-${i}`}>
                <td className="px-3 py-1.5 font-medium text-foreground">
                  {STAGE_LABEL[s.stage] ?? s.stage}
                  {s.end === null ? <span className="ms-1.5 text-amber-600 dark:text-amber-400">• شغالة</span> : null}
                </td>
                <td className="px-3 py-1.5 text-muted-foreground">{WORKER[s.worker]}</td>
                <td className="px-3 py-1.5 tabular-nums text-muted-foreground">{clock(s.start)}</td>
                <td className="px-3 py-1.5 tabular-nums">{duration(seconds(s))}</td>
                <td className="px-3 py-1.5">
                  <TokensCell t={s.tokens} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : null}
    </div>
  );
}
