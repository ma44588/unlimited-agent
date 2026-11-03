/**
 * Unlimited Agent — create a task: type, title, one description, attachments, priority, due, "ask me before
 * staging", then Create (keep it in the list) or Create & start (the developer picks it up at once).
 * Priority, due and the approval wish are written at the end of the description so every employee reads them.
 * Reviews (pull requests) keep the plain title + description form.
 */
import { useQuery } from "@tanstack/react-query";
import { Loader2, Paperclip, X } from "lucide-react";
import * as React from "react";

import { orgApi } from "@/features/unlimited/org/api";
import { OrgAvatar } from "@/features/unlimited/org/ui";
import { PROJECT_TASK_CATEGORIES, type ProjectTaskCategory } from "@/features/projects/projectTaskCategories";
import { uploadMediaBytes } from "@/shared/api/tauri";
import { cn } from "@/shared/lib/cn";
import { Button } from "@/shared/ui/button";
import { ChooserDialogContent } from "@/shared/ui/chooser-dialog-content";
import { Dialog } from "@/shared/ui/dialog";
import { Input } from "@/shared/ui/input";
import { Textarea } from "@/shared/ui/textarea";

const FIELD_SHELL_CLASS =
  "rounded-xl border border-input bg-muted/40 transition-colors hover:border-muted-foreground/40 focus-within:border-muted-foreground/50";
const FIELD_CONTROL_CLASS =
  "border-0 bg-transparent shadow-none outline-none ring-0 placeholder:text-muted-foreground/55 focus-visible:ring-0";

export type CreateProjectWorkItemDialogInput = {
  title: string;
  body: string;
  category?: ProjectTaskCategory;
  start?: boolean;
};

const PRIORITIES = ["Low", "Normal", "High", "Urgent"] as const;
type Priority = (typeof PRIORITIES)[number];
type Attachment = { key: string; name: string; state: "uploading" | "done" | "failed"; url?: string; image?: boolean };

function dueLabel(v: string): string {
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return v;
  return d.toLocaleString(undefined, { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
}

/** The description the employees read: what you wrote, the files, then priority / due / approval. */
export function composeTaskBody(text: string, files: Attachment[], priority: Priority, due: string, approval: boolean) {
  const parts = [text.trim()];
  const done = files.filter((f) => f.state === "done" && f.url);
  if (done.length) parts.push(done.map((f) => (f.image ? `![${f.name}](${f.url})` : `[${f.name}](${f.url})`)).join("\n"));
  const meta: string[] = [];
  if (priority !== "Normal") meta.push(`**Priority:** ${priority}`);
  if (due) meta.push(`**Due:** ${dueLabel(due)}`);
  if (approval) meta.push("**Approval:** show the result to the owner and wait for OK before publishing to staging.");
  if (meta.length) parts.push(`---\n${meta.join("  \n")}`);
  return parts.filter(Boolean).join("\n\n");
}

export function CreateProjectWorkItemDialog({
  bodyPlaceholder,
  children,
  description,
  isCreating,
  itemName,
  onCreate,
  onOpenChange,
  open,
  submitDisabled = false,
  title,
  titlePlaceholder,
}: {
  bodyPlaceholder: string;
  children?: React.ReactNode;
  description: string;
  isCreating: boolean;
  itemName: "issue" | "pull-request";
  onCreate: (input: CreateProjectWorkItemDialogInput) => Promise<void>;
  onOpenChange: (open: boolean) => void;
  open: boolean;
  submitDisabled?: boolean;
  title: string;
  titlePlaceholder: string;
}) {
  const isTask = itemName === "issue";
  const [workItemTitle, setWorkItemTitle] = React.useState("");
  const [body, setBody] = React.useState("");
  const [category, setCategory] = React.useState<ProjectTaskCategory>("issue");
  const [priority, setPriority] = React.useState<Priority>("Normal");
  const [due, setDue] = React.useState("");
  const [approval, setApproval] = React.useState(false);
  const [files, setFiles] = React.useState<Attachment[]>([]);
  const [dragging, setDragging] = React.useState(false);
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);
  const [starting, setStarting] = React.useState(false);
  const titleInputRef = React.useRef<HTMLInputElement>(null);
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const submitInFlightRef = React.useRef(false);
  const testIdPrefix = `create-${itemName}`;
  const itemLabel = isTask ? "task" : "review";
  const org = useQuery({ queryKey: ["unlimited", "org"], queryFn: () => orgApi.org(), enabled: open && isTask, retry: false, staleTime: 60_000 });
  const developer = org.data?.members.find((m) => m.id === "ai:developer");

  React.useEffect(() => {
    if (!open) return;
    setWorkItemTitle("");
    setBody("");
    setCategory("issue");
    setPriority("Normal");
    setDue("");
    setApproval(false);
    setFiles([]);
    setErrorMessage(null);
    const timerId = globalThis.setTimeout(() => titleInputRef.current?.focus(), 50);
    return () => globalThis.clearTimeout(timerId);
  }, [open]);

  const addFiles = (list: FileList | File[]) => {
    for (const file of Array.from(list)) {
      const key = `${file.name}-${file.size}-${Math.random().toString(36).slice(2, 7)}`;
      const image = file.type.startsWith("image/");
      setFiles((cur) => [...cur, { key, name: file.name || "screenshot.png", state: "uploading", image }]);
      void file
        .arrayBuffer()
        .then((buf) => uploadMediaBytes(Array.from(new Uint8Array(buf)), file.name || "screenshot.png"))
        .then((blob) => setFiles((cur) => cur.map((f) => (f.key === key ? { ...f, state: "done", url: blob.url } : f))))
        .catch(() => setFiles((cur) => cur.map((f) => (f.key === key ? { ...f, state: "failed" } : f))));
    }
  };
  const uploading = files.some((f) => f.state === "uploading");

  async function submit(start: boolean) {
    if (isCreating || submitDisabled || submitInFlightRef.current || uploading) return;
    const trimmedTitle = workItemTitle.trim();
    if (!trimmedTitle) return;
    submitInFlightRef.current = true;
    setStarting(start);
    setErrorMessage(null);
    try {
      await onCreate(
        isTask
          ? { title: trimmedTitle, body: composeTaskBody(body, files, priority, due, approval), category, start }
          : { title: trimmedTitle, body: body.trim() },
      );
      onOpenChange(false);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : `Failed to create ${itemLabel}.`);
    } finally {
      submitInFlightRef.current = false;
    }
  }

  const disabled = isCreating || submitDisabled || uploading || workItemTitle.trim().length === 0;

  return (
    <Dialog
      onOpenChange={(nextOpen) => {
        if (!nextOpen && isCreating) return;
        onOpenChange(nextOpen);
      }}
      open={open}
    >
      <ChooserDialogContent
        className={isTask ? "max-w-xl" : "max-w-lg"}
        contentClassName="pt-3"
        data-testid={`${testIdPrefix}-dialog`}
        description={description}
        footer={
          <div className="flex w-full justify-end gap-2">
            {isTask ? (
              <>
                <Button data-testid={`${testIdPrefix}-submit`} disabled={disabled} onClick={() => void submit(false)} type="button" variant="outline">
                  {isCreating && !starting ? "Creating…" : "Create"}
                </Button>
                <Button data-testid={`${testIdPrefix}-start`} disabled={disabled} onClick={() => void submit(true)} type="button">
                  {isCreating && starting ? <Loader2 className="animate-spin" /> : null}
                  Create &amp; start
                </Button>
              </>
            ) : (
              <Button data-testid={`${testIdPrefix}-submit`} disabled={disabled} form={`${testIdPrefix}-form`} type="submit">
                {isCreating ? "Creating…" : `Create ${itemLabel}`}
              </Button>
            )}
          </div>
        }
        footerClassName="border-t-0 pt-0"
        headerClassName="pb-2"
        title={title}
      >
        <form
          className="space-y-4"
          id={`${testIdPrefix}-form`}
          onKeyDown={(e) => {
            if (isTask && e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
              e.preventDefault();
              void submit(true);
            }
          }}
          onPaste={(e) => {
            if (isTask && e.clipboardData.files.length) {
              e.preventDefault();
              addFiles(e.clipboardData.files);
            }
          }}
          onSubmit={(event) => {
            event.preventDefault();
            void submit(false);
          }}
        >
          {children}
          {isTask ? (
            <div className="space-y-1.5">
              <span className="text-sm font-medium text-foreground">Type</span>
              <div className="flex w-fit flex-wrap gap-1 rounded-xl bg-muted/60 p-1" data-testid={`${testIdPrefix}-category`} role="radiogroup">
                {PROJECT_TASK_CATEGORIES.map((option) => (
                  <button
                    aria-checked={category === option.value}
                    className={cn(
                      "rounded-lg px-3 py-1.5 text-sm text-muted-foreground transition-colors",
                      category === option.value && "bg-background font-semibold text-foreground shadow-sm",
                    )}
                    disabled={isCreating}
                    key={option.value}
                    onClick={() => setCategory(option.value)}
                    role="radio"
                    type="button"
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>
          ) : null}
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-foreground" htmlFor={`${testIdPrefix}-title`}>
              Title
            </label>
            <div className={cn("flex min-h-11 items-center px-3", FIELD_SHELL_CLASS)}>
              <Input
                className={cn("h-8 px-0 font-medium", FIELD_CONTROL_CLASS)}
                data-testid={`${testIdPrefix}-title`}
                dir="auto"
                disabled={isCreating}
                id={`${testIdPrefix}-title`}
                maxLength={256}
                onChange={(event) => {
                  setWorkItemTitle(event.target.value);
                  setErrorMessage(null);
                }}
                placeholder={titlePlaceholder}
                ref={titleInputRef}
                value={workItemTitle}
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-foreground" htmlFor={`${testIdPrefix}-body`}>
              Description
              {isTask ? null : <span className="ml-1 text-xs font-normal text-muted-foreground/50">Optional</span>}
            </label>
            <div className={FIELD_SHELL_CLASS}>
              <Textarea
                className={cn("min-h-28 resize-y px-3 py-3", FIELD_CONTROL_CLASS)}
                data-testid={`${testIdPrefix}-body`}
                dir="auto"
                disabled={isCreating}
                id={`${testIdPrefix}-body`}
                onChange={(event) => {
                  setBody(event.target.value);
                  setErrorMessage(null);
                }}
                placeholder={isTask ? "What's wrong or what you need, in your own words" : bodyPlaceholder}
                value={body}
              />
            </div>
          </div>
          {isTask ? (
            <>
              <div className="space-y-1.5">
                <span className="text-sm font-medium text-foreground">
                  Attachments <span className="text-xs font-normal text-muted-foreground">· paste a screenshot (⌘V) or drop files</span>
                </span>
                <div
                  className={cn(
                    "flex flex-wrap items-center gap-2 rounded-xl border-[1.5px] border-dashed border-input px-3 py-2.5 text-sm text-muted-foreground",
                    dragging && "border-primary bg-primary/5",
                  )}
                  data-testid={`${testIdPrefix}-attachments`}
                  onDragLeave={() => setDragging(false)}
                  onDragOver={(e) => {
                    e.preventDefault();
                    setDragging(true);
                  }}
                  onDrop={(e) => {
                    e.preventDefault();
                    setDragging(false);
                    if (e.dataTransfer.files.length) addFiles(e.dataTransfer.files);
                  }}
                >
                  {files.map((f) => (
                    <span className={cn("flex items-center gap-1.5 rounded-lg bg-muted px-2 py-1 text-xs text-foreground", f.state === "failed" && "text-destructive")} key={f.key}>
                      {f.state === "uploading" ? <Loader2 className="h-3 w-3 animate-spin" /> : <Paperclip className="h-3 w-3" />}
                      <span className="max-w-40 truncate">{f.name}</span>
                      {f.state === "failed" ? " · failed" : null}
                      <button aria-label={`Remove ${f.name}`} onClick={() => setFiles((cur) => cur.filter((x) => x.key !== f.key))} type="button">
                        <X className="h-3 w-3" />
                      </button>
                    </span>
                  ))}
                  {files.length === 0 ? <span>No files yet</span> : null}
                  <button className="ms-auto font-medium text-primary hover:underline" onClick={() => fileInputRef.current?.click()} type="button">
                    + Add
                  </button>
                  <input
                    className="hidden"
                    multiple
                    onChange={(e) => {
                      if (e.target.files) addFiles(e.target.files);
                      e.target.value = "";
                    }}
                    ref={fileInputRef}
                    type="file"
                  />
                </div>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <span className="text-sm font-medium text-foreground">Priority</span>
                  <div className="flex flex-wrap gap-1.5" role="radiogroup">
                    {PRIORITIES.map((p) => (
                      <button
                        aria-checked={priority === p}
                        className={cn(
                          "rounded-full border px-3 py-1 text-xs text-muted-foreground",
                          priority === p &&
                            (p === "Urgent"
                              ? "border-red-300 bg-red-50 font-semibold text-red-700 dark:border-red-500/40 dark:bg-red-500/10 dark:text-red-300"
                              : p === "High"
                                ? "border-amber-300 bg-amber-50 font-semibold text-amber-800 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-200"
                                : "border-primary/40 bg-primary/10 font-semibold text-primary"),
                        )}
                        key={p}
                        onClick={() => setPriority(p)}
                        role="radio"
                        type="button"
                      >
                        {p}
                      </button>
                    ))}
                  </div>
                </div>
                <label className="block space-y-1.5">
                  <span className="text-sm font-medium text-foreground">
                    Due <span className="text-xs font-normal text-muted-foreground">optional</span>
                  </span>
                  <input
                    className="h-9 w-full rounded-xl border border-input bg-muted/40 px-3 text-sm outline-none focus:border-muted-foreground/50"
                    data-testid={`${testIdPrefix}-due`}
                    onChange={(e) => setDue(e.target.value)}
                    type="datetime-local"
                    value={due}
                  />
                </label>
              </div>
              <label className="flex cursor-pointer items-start gap-2.5 text-sm">
                <input checked={approval} className="mt-0.5 h-4 w-4 accent-[var(--primary)]" onChange={(e) => setApproval(e.target.checked)} type="checkbox" />
                <span>
                  Ask me before it goes to staging
                  <span className="block text-xs text-muted-foreground">You approve the result before it's published to the staging branch.</span>
                </span>
              </label>
              {developer ? (
                <div className="flex items-center gap-2.5 rounded-xl bg-primary/5 px-3 py-2 text-xs text-muted-foreground">
                  <OrgAvatar badge={false} person={developer} size={24} />
                  <span>
                    <b className="font-semibold text-foreground">Create &amp; start</b> sends it to {developer.name} now. He reads the database and the code,
                    posts the plan and waits for your OK.
                  </span>
                </div>
              ) : null}
            </>
          ) : null}
          {errorMessage ? <p className="text-sm text-destructive">{errorMessage}</p> : null}
        </form>
      </ChooserDialogContent>
    </Dialog>
  );
}
