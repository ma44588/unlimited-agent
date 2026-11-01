/**
 * Unlimited Agent — the server employee dialog. Same layout and fields as the app's own agent dialog
 * (avatar, name, description, instructions, model, effort, Advanced: respond-to, environment variables,
 * MCP servers), plus what only a server employee has (projects, skills, memory, run controls).
 * Every save goes to the server (connector → agentctl); nothing is created or run on this computer.
 */
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ChevronDown, Loader2, Play, Plus, RotateCcw, Server, Square, Trash2, X } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import * as React from "react";
import { toast } from "sonner";

import { AgentCreationPreview } from "@/features/agents/ui/AgentCreationPreview";
import { AgentDefinitionDialogFooter } from "@/features/agents/ui/AgentDefinitionDialogFooter";
import { AgentDefinitionDialogShell } from "@/features/agents/ui/AgentDefinitionDialogShell";
import { AgentIdentityFields } from "@/features/agents/ui/AgentDescriptionField";
import {
  ADVANCED_FIELDS_MOTION_TRANSITION,
  PERSONA_FIELD_CONTROL_CLASS,
  PERSONA_FIELD_SHELL_CLASS,
  PERSONA_LABEL_OPTIONAL_CLASS,
  type PersonaDropdownOption,
} from "@/features/agents/ui/agentConfigOptions";
import { EnvVarsEditor } from "@/features/agents/ui/EnvVarsEditor";
import { PersonaDropdownField } from "@/features/agents/ui/PersonaDropdownField";
import { CreateAgentRespondToField } from "@/features/agents/ui/RespondToField";
import {
  odooApi,
  type ServerEmployee,
  type ServerEmployeeDetails,
  type ServerEmployeeInput,
  type ServerMcpServer,
} from "@/features/unlimited/odoo/api";
import { cn } from "@/shared/lib/cn";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { Textarea } from "@/shared/ui/textarea";

const MODEL_OPTIONS: PersonaDropdownOption[] = [
  { value: "opus", label: "Claude Opus", description: "Strongest; best for development and planning" },
  { value: "sonnet", label: "Claude Sonnet", description: "Fast and capable for most work" },
  { value: "haiku", label: "Claude Haiku", description: "Fastest; simple, short tasks" },
];

const EFFORT_OPTIONS: PersonaDropdownOption[] = [
  { value: "0", label: "Off" },
  { value: "4000", label: "Medium" },
  { value: "12000", label: "High" },
  { value: "24000", label: "Max" },
];

type Draft = ServerEmployeeInput;

const EMPTY: Draft = {
  name: "",
  role: "",
  about: "",
  avatar: "",
  instructions: "",
  model: "opus",
  thinking: 12000,
  skills: [],
  projects: ["*"],
  respond_to: "owner-only",
  allow: [],
  env: {},
  mcp: [],
};

function fromDetails(d: ServerEmployeeDetails): Draft {
  return {
    name: d.name,
    role: d.role,
    about: d.about || d.role || "",
    avatar: d.avatar || "",
    instructions: d.instructions,
    model: d.model,
    thinking: d.thinking,
    skills: d.skills,
    projects: d.projects?.length ? d.projects : ["*"],
    respond_to: d.respond_to || "owner-only",
    allow: d.allow || [],
    env: d.env || {},
    mcp: d.mcp || [],
  };
}

function Label({ htmlFor, children, optional }: { htmlFor?: string; children: React.ReactNode; optional?: boolean }) {
  return (
    <label className="text-sm font-medium text-foreground" htmlFor={htmlFor}>
      {children}
      {optional ? <span className={PERSONA_LABEL_OPTIONAL_CLASS}>Optional</span> : null}
    </label>
  );
}

function Checklist({
  items,
  selected,
  onChange,
  allLabel,
  empty,
}: {
  items: string[];
  selected: string[];
  onChange: (next: string[]) => void;
  allLabel?: string;
  empty: string;
}) {
  const all = allLabel ? selected.includes("*") : false;
  if (items.length === 0 && !allLabel) return <p className="text-xs text-muted-foreground">{empty}</p>;
  const row = (key: string, label: string, checked: boolean, toggle: () => void) => (
    <label className="flex cursor-pointer items-center gap-2.5 px-3 py-2 text-sm text-foreground" key={key}>
      <input checked={checked} className="h-4 w-4 accent-primary" onChange={toggle} type="checkbox" />
      {label}
    </label>
  );
  return (
    <div className={cn("divide-y divide-border/50", PERSONA_FIELD_SHELL_CLASS)}>
      {allLabel ? row("*", allLabel, all, () => onChange(all ? [] : ["*"])) : null}
      {items.map((it) =>
        row(it, it, all || selected.includes(it), () => {
          const base = selected.filter((x) => x !== "*");
          onChange(base.includes(it) ? base.filter((x) => x !== it) : [...base, it]);
        }),
      )}
    </div>
  );
}

function McpServersEditor({ value, onChange, disabled }: { value: ServerMcpServer[]; onChange: (v: ServerMcpServer[]) => void; disabled?: boolean }) {
  const update = (i: number, patch: Partial<ServerMcpServer>) => onChange(value.map((m, j) => (j === i ? { ...m, ...patch } : m)));
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-foreground">MCP servers</span>
        <Button
          disabled={disabled}
          onClick={() => onChange([...value, { name: "", url: "", headers: {} }])}
          size="sm"
          type="button"
          variant="ghost"
        >
          <Plus /> Add server
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">
        The Unlimited Odoo connector is always connected. Add HTTP MCP servers this employee should also use.
      </p>
      {value.map((m, i) => {
        const auth = m.headers.Authorization ?? "";
        return (
          <div className={cn("grid gap-2 p-3 sm:grid-cols-[140px_minmax(0,1fr)_auto]", PERSONA_FIELD_SHELL_CLASS)} key={i}>
            <Input
              aria-label="MCP server name"
              className={cn("h-8", PERSONA_FIELD_CONTROL_CLASS)}
              disabled={disabled}
              onChange={(e) => update(i, { name: e.target.value })}
              placeholder="name"
              value={m.name}
            />
            <Input
              aria-label="MCP server URL"
              className={cn("h-8", PERSONA_FIELD_CONTROL_CLASS)}
              disabled={disabled}
              onChange={(e) => update(i, { url: e.target.value })}
              placeholder="https://example.com/mcp"
              value={m.url}
            />
            <Button
              aria-label="Remove MCP server"
              disabled={disabled}
              onClick={() => onChange(value.filter((_, j) => j !== i))}
              size="icon"
              type="button"
              variant="ghost"
            >
              <X />
            </Button>
            <Input
              aria-label="Authorization header"
              className={cn("h-8 sm:col-span-3", PERSONA_FIELD_CONTROL_CLASS)}
              disabled={disabled}
              onChange={(e) => {
                const headers = { ...m.headers };
                if (e.target.value) headers.Authorization = e.target.value;
                else delete headers.Authorization;
                update(i, { headers });
              }}
              placeholder="Authorization header (optional), e.g. Bearer …"
              type="password"
              value={auth}
            />
          </div>
        );
      })}
    </div>
  );
}

function ServerControls({ employee, details, onDone }: { employee: ServerEmployee; details?: ServerEmployeeDetails; onDone: () => void }) {
  const qc = useQueryClient();
  const [busy, setBusy] = React.useState<string | null>(null);
  async function run(act: "start" | "stop" | "restart" | "delete" | "memory_delete", file?: string) {
    setBusy(act + (file ?? ""));
    try {
      await odooApi.serverAgentAction(employee.slug, { do: act, file });
      toast.success(act === "delete" ? `${employee.name} اتشال من السيرفر.` : "تم.");
      await qc.invalidateQueries({ queryKey: ["unlimited", "server-agents"] });
      await qc.invalidateQueries({ queryKey: ["unlimited", "server-agent", employee.slug] });
      if (act === "delete") onDone();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "تعذر التنفيذ.");
    } finally {
      setBusy(null);
    }
  }
  const running = employee.status === "running";
  return (
    <div className="space-y-4">
      <div className={cn("flex flex-wrap items-center gap-2 px-3 py-2.5", PERSONA_FIELD_SHELL_CLASS)}>
        <Server className="h-4 w-4 text-muted-foreground" />
        <span className="text-sm text-foreground">Unlimited server</span>
        <span
          className={cn(
            "rounded-full px-2 py-0.5 text-xs",
            running ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300" : "bg-amber-500/10 text-amber-700 dark:text-amber-300",
          )}
        >
          {running ? "Running" : employee.status}
        </span>
        <span className="ms-auto flex gap-1">
          {running ? (
            <Button disabled={busy !== null} onClick={() => void run("stop")} size="sm" type="button" variant="ghost">
              <Square /> Stop
            </Button>
          ) : (
            <Button disabled={busy !== null} onClick={() => void run("start")} size="sm" type="button" variant="ghost">
              <Play /> Start
            </Button>
          )}
          <Button disabled={busy !== null} onClick={() => void run("restart")} size="sm" type="button" variant="ghost">
            <RotateCcw /> Restart
          </Button>
        </span>
      </div>

      <div className="space-y-1.5">
        <Label>Memory</Label>
        {details?.memory?.length ? (
          <div className={cn("max-h-56 divide-y divide-border/50 overflow-y-auto", PERSONA_FIELD_SHELL_CLASS)}>
            {details.memory.map((m) => (
              <div className="flex items-start gap-2 px-3 py-2" key={m.file}>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-foreground" dir="ltr">
                    {m.file}
                  </p>
                  <p className="line-clamp-2 whitespace-pre-wrap text-xs text-muted-foreground" dir="auto">
                    {m.preview}
                  </p>
                </div>
                <Button
                  aria-label={`Delete ${m.file}`}
                  disabled={busy !== null}
                  onClick={() => void run("memory_delete", m.file)}
                  size="icon"
                  type="button"
                  variant="ghost"
                >
                  <Trash2 />
                </Button>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">No memory yet. The employee writes what it learns here after each task.</p>
        )}
      </div>

      {!employee.builtin ? (
        <Button
          className="text-destructive hover:text-destructive"
          disabled={busy !== null}
          onClick={() => {
            if (window.confirm(`Delete ${employee.name} from the server?`)) void run("delete");
          }}
          size="sm"
          type="button"
          variant="ghost"
        >
          <Trash2 /> Delete employee
        </Button>
      ) : null}
    </div>
  );
}

function ServerEmployeeDialog({
  open,
  onOpenChange,
  employee,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  employee: ServerEmployee | null;
}) {
  const editing = employee !== null;
  const qc = useQueryClient();
  const detailsQuery = useQuery({
    queryKey: ["unlimited", "server-agent", employee?.slug],
    queryFn: () => odooApi.serverAgent(employee!.slug),
    enabled: open && editing,
    retry: false,
  });
  // A new employee still needs the lists of skills and projects that exist on the server.
  const optionsQuery = useQuery({
    queryKey: ["unlimited", "server-agent-options"],
    queryFn: () => odooApi.serverAgent("developer"),
    enabled: open && !editing,
    retry: false,
    staleTime: 60_000,
  });
  const details = detailsQuery.data;
  const options = details ?? optionsQuery.data;

  const [draft, setDraft] = React.useState<Draft>(EMPTY);
  const [showAdvanced, setShowAdvanced] = React.useState(false);
  const [pending, setPending] = React.useState(false);
  const [avatarPending, setAvatarPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const loadedFor = React.useRef<string | null>(null);

  React.useEffect(() => {
    if (!open) {
      loadedFor.current = null;
      return;
    }
    if (!editing && loadedFor.current !== "new") {
      setDraft(EMPTY);
      setError(null);
      setShowAdvanced(false);
      loadedFor.current = "new";
    } else if (editing && details && loadedFor.current !== employee.slug) {
      setDraft(fromDetails(details));
      setError(null);
      setShowAdvanced(false);
      loadedFor.current = employee.slug;
    }
  }, [open, editing, details, employee]);

  const set = <K extends keyof Draft>(key: K, value: Draft[K]) => setDraft((d) => ({ ...d, [key]: value }));
  const loading = editing && !details;
  const nameOk = /^[A-Za-z][A-Za-z0-9 -]{1,30}$/.test(draft.name.trim());
  const canSubmit =
    !pending && !avatarPending && !loading && nameOk && (editing || draft.instructions.trim().length > 0);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!canSubmit) return;
    setPending(true);
    setError(null);
    const payload: Draft = {
      ...draft,
      name: draft.name.trim(),
      role: draft.about.trim(),
      about: draft.about.trim(),
      mcp: draft.mcp.filter((m) => m.name.trim() || m.url.trim()),
    };
    try {
      if (editing) {
        await odooApi.updateServerAgent(employee.slug, payload);
        toast.success(`اتحفظ. ${payload.name} بيعيد التشغيل على السيرفر بالإعدادات الجديدة.`);
      } else {
        await odooApi.createServerAgent(payload);
        toast.success(`${payload.name} اتعمل على السيرفر وبدأ يشتغل.`);
      }
      await qc.invalidateQueries({ queryKey: ["unlimited", "server-agents"] });
      await qc.invalidateQueries({ queryKey: ["unlimited", "server-agent"] });
      onOpenChange(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "تعذر الحفظ.");
    } finally {
      setPending(false);
    }
  }

  const footer = (
    <AgentDefinitionDialogFooter
      canSubmit={canSubmit}
      isAvatarUploadPending={avatarPending}
      isPending={pending}
      onCancel={() => onOpenChange(false)}
      publishesCatalogUpdates={false}
      submitLabel={editing ? "Save" : "Create on server"}
    />
  );

  return (
    <AgentDefinitionDialogShell
      description={
        editing
          ? "This employee runs on the Unlimited server. Changes are saved there and the employee restarts with them."
          : "The new employee is created and runs on the Unlimited server, with its own key. Nothing runs on this computer."
      }
      embedded={false}
      footer={footer}
      onOpenChange={(next) => {
        if (!next && (pending || avatarPending)) return;
        onOpenChange(next);
      }}
      open={open}
      title={editing ? `${employee.name} · Settings` : "New server employee"}
    >
      {loading ? (
        <div className="flex items-center gap-2 py-10 text-sm text-muted-foreground">
          {detailsQuery.isError ? (
            "تعذر تحميل الإعدادات من السيرفر."
          ) : (
            <>
              <Loader2 className="h-4 w-4 animate-spin" /> Loading from the server…
            </>
          )}
        </div>
      ) : (
        <form className="grid gap-5 lg:grid-cols-[220px_minmax(0,1fr)]" id="persona-dialog-form" onSubmit={submit}>
          <AgentCreationPreview
            avatarUrl={draft.avatar || null}
            disabled={pending || avatarPending}
            label={draft.name || "New employee"}
            onClearAvatar={() => set("avatar", "")}
            onSelectAvatar={(url) => set("avatar", url)}
            onUploadPendingChange={setAvatarPending}
          />

          <div className="space-y-5">
            <AgentIdentityFields
              description={draft.about}
              disabled={pending}
              displayName={draft.name}
              onDescriptionChange={(v) => set("about", v)}
              onDisplayNameChange={(v) => set("name", v)}
            />
            {!nameOk && draft.name ? (
              <p className="-mt-3 text-xs text-destructive">Use an English name: letters, digits, spaces or “-”.</p>
            ) : null}

            <div className="space-y-1.5">
              <Label htmlFor="server-employee-instructions">Agent instructions</Label>
              <div className={PERSONA_FIELD_SHELL_CLASS}>
                <Textarea
                  className={cn("min-h-40 resize-y px-3 py-3 leading-5", PERSONA_FIELD_CONTROL_CLASS)}
                  dir="auto"
                  disabled={pending}
                  id="server-employee-instructions"
                  onChange={(e) => set("instructions", e.target.value)}
                  placeholder="Describe what this employee should do. Company rules (Arabic first, memory, task workflow) are added automatically."
                  value={draft.instructions}
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Runs on</Label>
              <div className={cn("flex items-center gap-2 px-3 py-2.5 text-sm", PERSONA_FIELD_SHELL_CLASS)}>
                <Server className="h-4 w-4 text-muted-foreground" />
                <span className="text-foreground">Unlimited server</span>
                <span className="text-muted-foreground">· Claude Code · always on</span>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="server-employee-model">Model</Label>
                <PersonaDropdownField
                  disabled={pending}
                  id="server-employee-model"
                  onValueChange={(v) => set("model", v as Draft["model"])}
                  options={MODEL_OPTIONS}
                  placeholder="Choose a model"
                  value={draft.model}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="server-employee-effort">Effort</Label>
                <PersonaDropdownField
                  disabled={pending}
                  id="server-employee-effort"
                  onValueChange={(v) => set("thinking", Number(v))}
                  options={EFFORT_OPTIONS}
                  placeholder="Thinking effort"
                  value={String(draft.thinking)}
                />
              </div>
            </div>

            <div className="space-y-3">
              <button
                aria-expanded={showAdvanced}
                className="inline-flex h-9 items-center gap-1.5 text-sm font-medium text-foreground transition-colors hover:text-foreground/80 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring"
                onClick={() => setShowAdvanced((v) => !v)}
                type="button"
              >
                <span>Advanced</span>
                <ChevronDown
                  className={cn(
                    "h-4 w-4 text-muted-foreground transition-transform duration-150 ease-out",
                    showAdvanced && "rotate-180",
                  )}
                />
              </button>
              <AnimatePresence initial={false}>
                {showAdvanced ? (
                  <motion.div
                    animate={{ height: "auto", opacity: 1, scale: 1 }}
                    className="origin-top space-y-5 overflow-hidden"
                    exit={{ height: 0, opacity: 0, scale: 0.98 }}
                    initial={{ height: 0, opacity: 0, scale: 0.98 }}
                    key="server-employee-advanced"
                    transition={ADVANCED_FIELDS_MOTION_TRANSITION}
                  >
                    <CreateAgentRespondToField
                      allowlist={draft.allow}
                      disabled={pending}
                      mode={draft.respond_to}
                      onAllowlistChange={(v) => set("allow", v)}
                      onModeChange={(v) => set("respond_to", v)}
                      runLocation="remote"
                      variant="persona"
                    />

                    <div className="space-y-1.5">
                      <Label>Projects</Label>
                      <Checklist
                        allLabel="All projects"
                        empty="No projects on the server yet."
                        items={options?.projects_available ?? []}
                        onChange={(v) => set("projects", v.length ? v : ["*"])}
                        selected={draft.projects}
                      />
                    </div>

                    <div className="space-y-1.5">
                      <Label optional>Skills</Label>
                      <Checklist
                        empty="No skills in the server library yet."
                        items={options?.skills_available ?? []}
                        onChange={(v) => set("skills", v)}
                        selected={draft.skills}
                      />
                    </div>

                    <EnvVarsEditor
                      disabled={pending}
                      helperText="Saved on the server for this employee only."
                      onChange={(v) => set("env", v)}
                      value={draft.env}
                    />

                    <McpServersEditor disabled={pending} onChange={(v) => set("mcp", v)} value={draft.mcp} />
                  </motion.div>
                ) : null}
              </AnimatePresence>
            </div>

            {editing ? <ServerControls details={details} employee={employee} onDone={() => onOpenChange(false)} /> : null}

            {error ? <p className="text-sm text-destructive">{error}</p> : null}
          </div>
        </form>
      )}
    </AgentDefinitionDialogShell>
  );
}

export function NewServerEmployeeDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  return <ServerEmployeeDialog employee={null} onOpenChange={onOpenChange} open={open} />;
}

export function ServerEmployeeSettingsDialog({
  employee,
  onOpenChange,
}: {
  employee: ServerEmployee | null;
  onOpenChange: (open: boolean) => void;
}) {
  return <ServerEmployeeDialog employee={employee} onOpenChange={onOpenChange} open={employee !== null} />;
}
