/**
 * Unlimited Agent — files the server employees deliver (guides, PDFs, images in the shared OUTBOX folder).
 * A chip per file; clicking opens it inside the app: Markdown rendered, images and PDFs shown as they are.
 */
import { useQuery } from "@tanstack/react-query";
import { Copy, FileText, Image as ImageIcon, Loader2, Paperclip } from "lucide-react";
import * as React from "react";
import { toast } from "sonner";

import type { ProjectIssue } from "@/features/projects/hooks";
import { ProjectDetailMetaRow } from "@/features/projects/ui/ProjectDetailMeta";
import { ProjectRichContent } from "@/features/projects/ui/ProjectRichContent";
import { type AgentFile, odooApi } from "@/features/unlimited/odoo/api";
import { cn } from "@/shared/lib/cn";
import { Button } from "@/shared/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/shared/ui/dialog";

export function useAgentFiles(enabled = true) {
  return useQuery({
    queryKey: ["unlimited", "agent-files"],
    queryFn: () => odooApi.agentFiles(),
    enabled,
    staleTime: 30_000,
    refetchInterval: 60_000,
    retry: false,
  });
}

export function sizeLabel(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

function decodeText(b64: string): string {
  const bin = atob(b64);
  const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

export function AgentFileViewer({ name, onOpenChange }: { name: string | null; onOpenChange: (open: boolean) => void }) {
  const query = useQuery({
    queryKey: ["unlimited", "agent-file", name],
    queryFn: () => odooApi.agentFile(name!),
    enabled: Boolean(name),
    retry: false,
    staleTime: 60_000,
  });
  const file = query.data;
  const isText = file ? file.mime.startsWith("text/") : false;
  const text = React.useMemo(() => (file && isText ? decodeText(file.data) : ""), [file, isText]);

  return (
    <Dialog onOpenChange={onOpenChange} open={name !== null}>
      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <DialogTitle dir="ltr">{name}</DialogTitle>
          <DialogDescription>{file ? `${sizeLabel(file.size)} · from the employees’ files on the server` : " "}</DialogDescription>
        </DialogHeader>
        <div className="max-h-[70vh] overflow-y-auto rounded-lg border border-border/60 bg-background p-4">
          {query.isLoading ? (
            <p className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading the file…
            </p>
          ) : query.isError ? (
            <p className="text-sm text-destructive">{query.error instanceof Error ? query.error.message : "Could not open the file."}</p>
          ) : file && file.mime === "text/markdown" ? (
            <div dir="auto">
              <ProjectRichContent className="text-sm text-foreground/90" content={text} />
            </div>
          ) : file && isText ? (
            <pre className="whitespace-pre-wrap text-xs text-foreground/90" dir="auto">
              {text}
            </pre>
          ) : file && file.mime.startsWith("image/") ? (
            <img alt={file.name} className="mx-auto max-w-full" src={`data:${file.mime};base64,${file.data}`} />
          ) : file && file.mime === "application/pdf" ? (
            <iframe className="h-[65vh] w-full rounded" src={`data:application/pdf;base64,${file.data}`} title={file.name} />
          ) : file ? (
            <p className="text-sm text-muted-foreground">This file type can’t be shown in the app ({file.mime}).</p>
          ) : null}
        </div>
        {file && isText ? (
          <div className="flex justify-end">
            <Button
              onClick={() => {
                void navigator.clipboard.writeText(text).then(() => toast.success("Copied."));
              }}
              size="sm"
              variant="outline"
            >
              <Copy /> Copy
            </Button>
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

export function AgentFileChip({ file, onOpen }: { file: AgentFile; onOpen: (name: string) => void }) {
  const Icon = file.mime.startsWith("image/") ? ImageIcon : FileText;
  return (
    <button
      className={cn(
        "inline-flex max-w-full items-center gap-2 rounded-lg border border-border/70 bg-background px-2.5 py-1.5 text-start text-xs",
        "transition-colors hover:border-primary/40 hover:bg-muted/40",
      )}
      onClick={() => onOpen(file.name)}
      title={file.name}
      type="button"
    >
      <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />
      <span className="truncate font-medium text-foreground" dir="ltr">
        {file.name}
      </span>
      <span className="shrink-0 text-muted-foreground">{sizeLabel(file.size)}</span>
    </button>
  );
}

/** "Files" row in a task's details: every employee file the task mentions, each with a View button. */
export function TaskFilesRow({ issue }: { issue: ProjectIssue }) {
  const filesQuery = useAgentFiles();
  const [open, setOpen] = React.useState<string | null>(null);
  const joined = [issue.content ?? "", ...issue.comments.map((c) => c.content)].join("\n");
  const mentioned = (filesQuery.data ?? []).filter((f) => joined.includes(f.name));
  if (mentioned.length === 0) return null;
  return (
    <ProjectDetailMetaRow icon={Paperclip} label="Files">
      <div className="flex min-w-0 flex-col gap-1.5" data-testid="task-files">
        {mentioned.map((f) => {
          const Icon = f.mime.startsWith("image/") ? ImageIcon : FileText;
          return (
            <div className="flex min-w-0 items-center gap-2" key={f.name}>
              <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />
              <span className="truncate font-medium text-foreground">{f.name}</span>
              <span className="shrink-0 text-xs text-muted-foreground">{sizeLabel(f.size)}</span>
              <Button className="h-6 px-2.5 text-xs" onClick={() => setOpen(f.name)} size="sm" type="button">
                View
              </Button>
            </div>
          );
        })}
      </div>
      <AgentFileViewer name={open} onOpenChange={(o) => !o && setOpen(null)} />
    </ProjectDetailMetaRow>
  );
}
