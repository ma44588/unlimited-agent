/**
 * Unlimited Agent — approvals at the task level.
 * PlanPermissions: the sensitive steps the plan asks for (🔐 lines). Approving the plan allows exactly these.
 * TaskAsks: something the employee needs that was not in the plan; the owner answers it here, on the task.
 */
import { Check, KeyRound, Loader2, PauseCircle, PenLine, Play } from "lucide-react";
import * as React from "react";
import { toast } from "sonner";

import { odooApi } from "@/features/unlimited/odoo/api";
import { cn } from "@/shared/lib/cn";
import { Button } from "@/shared/ui/button";

import { sinceLabel, type TaskAsk, type TaskPerm } from "./taskDesk";

function Icon({ method }: { method: string }) {
  const run = method !== "write";
  return (
    <span
      className={cn(
        "grid h-6 w-6 shrink-0 place-items-center rounded-md",
        run ? "bg-sky-100 text-sky-700 dark:bg-sky-500/15" : "bg-amber-100 text-amber-700 dark:bg-amber-500/15",
      )}
    >
      {run ? <Play className="h-3 w-3" /> : <PenLine className="h-3 w-3" />}
    </span>
  );
}

export function PlanPermissions({ perms, awaiting }: { perms: TaskPerm[]; awaiting: boolean }) {
  if (!perms.length) return null;
  return (
    <div className="rounded-lg border border-border/70 bg-background p-3.5" data-testid="task-plan-permissions">
      <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
        <KeyRound className="h-3.5 w-3.5" />
        {awaiting ? `Approving this plan also allows · ${perms.length}` : "Allowed with the plan"}
      </p>
      <ul className="divide-y divide-border/60">
        {perms.map((p, i) => (
          <li className="flex items-start gap-2.5 py-2 text-sm" key={i}>
            {awaiting || !p.used_at ? (
              <Icon method={p.method} />
            ) : (
              <span className="grid h-6 w-6 shrink-0 place-items-center rounded-md bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15">
                <Check className="h-3.5 w-3.5" />
              </span>
            )}
            <span className="min-w-0 flex-1">
              <span className="block text-foreground" dir="auto" style={{ textAlign: "left", unicodeBidi: "plaintext" }}>
                {p.label}
              </span>
              <span className="block font-mono text-[11px] text-muted-foreground">
                {p.model} #{p.ids.join(",")} · {p.method}
                {!awaiting ? (p.used_at ? ` · done ${sinceLabel(p.used_at)} ago` : " · not yet") : ""}
              </span>
            </span>
            <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10.5px] font-bold text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300">
              staging
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function Code({ text, tone }: { text: string; tone: "old" | "new" }) {
  return (
    <pre
      className={cn(
        "max-h-56 overflow-auto whitespace-pre-wrap rounded-md p-2 font-mono text-[11px] leading-relaxed",
        tone === "old"
          ? "bg-red-50 text-red-900 dark:bg-red-500/10 dark:text-red-200"
          : "bg-emerald-50 text-emerald-900 dark:bg-emerald-500/10 dark:text-emerald-200",
      )}
      dir="ltr"
    >
      {text || "(empty)"}
    </pre>
  );
}

export function TaskAsks({
  asks,
  canDecide,
  dev,
  onAsk,
  onDecided,
}: {
  asks: TaskAsk[];
  canDecide: boolean;
  dev: string;
  onAsk: () => void;
  onDecided: () => void;
}) {
  const [busy, setBusy] = React.useState<string | null>(null);
  if (!asks.length) return null;

  async function decide(a: TaskAsk, approve: boolean) {
    setBusy(a.id);
    try {
      await odooApi.decide(a.id, approve ? "approve" : "reject");
      toast.success(approve ? `Allowed once. ${dev} carries on.` : `Rejected. ${dev} won't run it.`);
      onDecided();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not send.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="space-y-3" data-testid="task-asks">
      {asks.map((a) => (
        <div
          className="rounded-lg border border-amber-400/60 bg-gradient-to-b from-amber-50 to-background p-3.5 dark:from-amber-500/10"
          key={a.id}
        >
          <p className="flex items-center gap-1.5 text-[11.5px] font-bold uppercase tracking-wide text-amber-700 dark:text-amber-300">
            <PauseCircle className="h-3.5 w-3.5" /> {dev} stopped · not in the approved plan · {sinceLabel(a.at)}
          </p>
          <p className="mt-1.5 text-sm font-semibold text-foreground">{a.title}</p>
          {a.why ? (
            <p className="mt-1 text-[13px] text-muted-foreground" dir="auto" style={{ textAlign: "left", unicodeBidi: "plaintext" }}>
              Why: {a.why}
            </p>
          ) : null}
          {a.kind === "change_code" ? (
            <div className="mt-2 grid grid-cols-2 gap-2">
              <div>
                <p className="mb-1 text-[11px] font-semibold text-muted-foreground">Now (on staging)</p>
                <Code text={a.old ?? ""} tone="old" />
              </div>
              <div>
                <p className="mb-1 text-[11px] font-semibold text-muted-foreground">After</p>
                <Code text={a.new ?? ""} tone="new" />
              </div>
            </div>
          ) : null}
          {canDecide ? (
            <div className="mt-3 flex flex-wrap gap-2">
              <Button
                className="bg-blue-600 text-white hover:bg-blue-600/90"
                disabled={busy !== null}
                onClick={() => void decide(a, true)}
                size="sm"
              >
                {busy === a.id ? <Loader2 className="animate-spin" /> : <Check />} Allow once
              </Button>
              <Button
                className="text-destructive hover:text-destructive"
                disabled={busy !== null}
                onClick={() => void decide(a, false)}
                size="sm"
                variant="outline"
              >
                Reject
              </Button>
              <Button disabled={busy !== null} onClick={onAsk} size="sm" variant="ghost">
                <PenLine /> Ask {dev}
              </Button>
            </div>
          ) : null}
        </div>
      ))}
    </div>
  );
}
