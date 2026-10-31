/**
 * "Odoo & GitHub" block in the project home right panel: connection state at a glance,
 * one click opens the full panel (same data as the repository tab).
 */
import { Database, Plug } from "lucide-react";
import * as React from "react";

import { cn } from "@/shared/lib/cn";
import { Button } from "@/shared/ui/button";
import { Dialog, DialogContent, DialogTitle } from "@/shared/ui/dialog";

import { type OdooProject, type ProjectStatus, odooApi } from "./api";
import { OdooProjectPanel } from "./OdooProjectPanel";

const ROW =
  "h-8 w-full justify-start gap-2 rounded-md px-2 py-1.5 text-left text-sm font-normal text-sidebar-foreground/80 transition-[background-color,color] hover:bg-sidebar-accent hover:text-sidebar-accent-foreground disabled:pointer-events-none disabled:opacity-50";

export function OdooContextSection({
  onAddRepository,
  projectName,
  repositoryId,
}: {
  onAddRepository?: () => void;
  projectName: string;
  repositoryId: string | null;
}) {
  const [linked, setLinked] = React.useState<OdooProject | null | undefined>(undefined);
  const [status, setStatus] = React.useState<ProjectStatus | null>(null);
  const [open, setOpen] = React.useState(false);

  const load = React.useCallback(() => {
    if (!repositoryId) return;
    odooApi
      .byBuzz(repositoryId)
      .then((p) => {
        setLinked(p);
        if (p) odooApi.status(p.id).then(setStatus).catch(() => setStatus(null));
      })
      .catch(() => setLinked(null));
  }, [repositoryId]);
  React.useEffect(load, [load]);

  const build = status && typeof status.build.detail === "object" ? status.build.detail : null;
  const approvals = status?.approvals.length ?? 0;
  const dot = !linked
    ? "bg-muted-foreground/40"
    : status?.session?.ok === false || (build && build.state !== "success" && build.state !== "pending")
      ? "bg-destructive"
      : approvals
        ? "bg-amber-500"
        : "bg-emerald-500";

  return (
    <section className="space-y-1" data-testid="project-home-context-odoo">
      <div className="flex h-8 items-center px-2">
        <h3 className="truncate text-xs font-medium text-sidebar-foreground/70">Odoo & GitHub</h3>
      </div>
      {!repositoryId ? (
        <Button className={ROW} onClick={onAddRepository} size="sm" type="button" variant="ghost">
          <Plug className="size-4" />
          <span className="flex-1 truncate">Add a repository first</span>
        </Button>
      ) : (
        <Button className={ROW} onClick={() => setOpen(true)} size="sm" type="button" variant="ghost">
          {linked ? <Database className="size-4" /> : <Plug className="size-4" />}
          <span className="min-w-0 flex-1 truncate">
            {linked === undefined ? "…" : linked ? `${linked.odoosh_project} · ${linked.branch}` : "Connect Odoo"}
          </span>
          {linked ? (
            <span className="flex items-center gap-1.5 text-xs opacity-70">
              {approvals ? `${approvals}` : build?.build_id ? `#${build.build_id}` : ""}
              <span className={cn("size-2 rounded-full", dot)} />
            </span>
          ) : null}
        </Button>
      )}
      {open && repositoryId ? (
        <Dialog
          onOpenChange={(v) => {
            setOpen(v);
            if (!v) load();
          }}
          open
        >
          <DialogContent className="flex max-h-[88vh] w-[1100px] max-w-[calc(100vw-2rem)] flex-col overflow-y-auto p-0 pt-4">
            <DialogTitle className="sr-only">Odoo & GitHub</DialogTitle>
            <OdooProjectPanel buzzProjectId={repositoryId} projectName={projectName} />
          </DialogContent>
        </Dialog>
      ) : null}
    </section>
  );
}
