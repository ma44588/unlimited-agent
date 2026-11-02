/**
 * Unlimited Agent — the server employee dialog. Same layout and fields as the app's own agent dialog
 * (avatar, name, description, instructions, model, effort, Advanced: respond-to, environment variables,
 * MCP servers), plus what only a server employee has (projects, skills, memory, run controls).
 * Every save goes to the server (connector → agentctl); nothing is created or run on this computer.
 */
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { openUrl } from "@tauri-apps/plugin-opener";
import { AtSign, Brain, Building2, Cpu, FileText, Loader2, Mic, Play, Plus, RotateCcw, Send, Server, ShieldCheck, SlidersHorizontal, Square, Trash2, UserRound, X } from "lucide-react";
import * as React from "react";
import { toast } from "sonner";

import { AgentCreationPreview } from "@/features/agents/ui/AgentCreationPreview";
import { AgentDefinitionDialogFooter } from "@/features/agents/ui/AgentDefinitionDialogFooter";
import { ChooserDialogContent } from "@/shared/ui/chooser-dialog-content";
import { Dialog } from "@/shared/ui/dialog";
import { AgentIdentityFields } from "@/features/agents/ui/AgentDescriptionField";
import { OdooAccountSection } from "@/features/unlimited/org/OdooAccountSection";
import {
  PERSONA_FIELD_CONTROL_CLASS,
  PERSONA_FIELD_SHELL_CLASS,
  PERSONA_LABEL_OPTIONAL_CLASS,
  type PersonaDropdownOption,
} from "@/features/agents/ui/agentConfigOptions";
import { EnvVarsEditor } from "@/features/agents/ui/EnvVarsEditor";
import { PersonaDropdownField } from "@/features/agents/ui/PersonaDropdownField";
import { CreateAgentRespondToField } from "@/features/agents/ui/RespondToField";
import {
  isDemo,
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

type Section = "profile" | "odoo" | "channels" | "voice" | "instructions" | "model" | "memory" | "advanced";

type Draft = ServerEmployeeInput & {
  person: string;
  title: string;
  department: string;
  email: string;
  voice: string;
};

const DEPARTMENT_OPTIONS: PersonaDropdownOption[] = [
  { value: "Development", label: "Development" },
  { value: "Implementation", label: "Implementation" },
  { value: "Analysis", label: "Analysis" },
  { value: "Marketing & Sales", label: "Marketing & Sales" },
  { value: "Opportunities", label: "Opportunities" },
];

const VOICE_OPTIONS: PersonaDropdownOption[] = [
  "Omar · Egyptian, calm", "Karim · Egyptian", "Mariam · Egyptian, warm", "Laila · Egyptian, clear",
  "Youssef · Gulf", "Faisal · Gulf, warm", "Nada · MSA", "Nour · MSA, brief",
].map((v) => ({ value: v, label: v }));

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
  person: "",
  title: "",
  department: "Development",
  email: "",
  voice: "",
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
    person: d.person || "",
    title: d.title || "",
    department: d.department || "Development",
    email: d.email?.address || "",
    voice: d.voice || "",
  };
}

function ChannelsField({ employee, details, draft, set, disabled }: {
  employee: ServerEmployee | null;
  details?: ServerEmployeeDetails;
  draft: Draft;
  set: <K extends keyof Draft>(key: K, value: Draft[K]) => void;
  disabled: boolean;
}) {
  const qc = useQueryClient();
  const [token, setToken] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [err, setErr] = React.useState<string | null>(null);
  const tg = details?.telegram;
  const dot = (ok: boolean) => <span className={cn("h-1.5 w-1.5 rounded-full", ok ? "bg-emerald-500" : "bg-muted-foreground/50")} />;
  async function call(input: { token: string } | { disconnect: true }) {
    if (!employee) return;
    setBusy(true);
    setErr(null);
    try {
      const r = await odooApi.serverAgentTelegram(employee.slug, input);
      setToken("");
      await qc.invalidateQueries({ queryKey: ["unlimited", "server-agent", employee.slug] });
      await qc.invalidateQueries({ queryKey: ["unlimited", "server-agents"] });
      if ("token" in input && r.pair_link) void openUrl(r.pair_link);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Could not connect.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="space-y-5">
      <section className={cn("space-y-3 px-4 py-4", PERSONA_FIELD_SHELL_CLASS)}>
        <div className="flex items-center gap-2 text-sm">
          <Send className="h-4 w-4 text-muted-foreground" />
          <span className="font-semibold text-foreground">Telegram</span>
          <span className="ms-auto inline-flex items-center gap-1.5 text-xs text-muted-foreground">
            {dot(!!tg?.paired)} {tg?.paired ? `${tg.bot} · connected` : tg ? `${tg.bot} · waiting for you` : "Not connected"}
          </span>
        </div>
        {!employee ? (
          <p className="text-xs text-muted-foreground">Create the employee first, then connect its Telegram bot here.</p>
        ) : tg?.paired ? (
          <>
            <p className="text-sm text-muted-foreground">
              Write to {tg.bot} on Telegram and {draft.person || draft.name} answers you there. It can also message you first
              (reports, alerts). Only your Telegram account can use it; everyone else is ignored.
            </p>
            <Button disabled={busy} onClick={() => void call({ disconnect: true })} size="sm" type="button" variant="ghost">
              Disconnect Telegram
            </Button>
          </>
        ) : tg ? (
          <>
            <p className="text-sm text-foreground">One last step: open the bot and press <b>Start</b>. That links it to your Telegram account.</p>
            <div className="flex gap-2">
              <Button onClick={() => tg.pair_link && void openUrl(tg.pair_link)} size="sm" type="button"><Send /> Open {tg.bot}</Button>
              <Button disabled={busy} onClick={() => void call({ disconnect: true })} size="sm" type="button" variant="ghost">Cancel</Button>
            </div>
          </>
        ) : (
          <ol className="space-y-2 text-sm text-foreground">
            <li>1. In Telegram open <b>@BotFather</b>, send <b>/newbot</b>, and give it this employee's name.</li>
            <li>2. Paste the token it gives you and press Connect. Telegram opens the bot; press <b>Start</b>.</li>
            <li className="flex gap-2 pt-1">
              <Input autoComplete="off" className="h-9 text-xs" disabled={disabled || busy} onChange={(e) => setToken(e.target.value)}
                placeholder="123456789:AA…" type="password" value={token} />
              <Button disabled={disabled || busy || !token.trim()} onClick={() => void call({ token: token.trim() })} size="sm" type="button">
                {busy ? <Loader2 className="animate-spin" /> : null} Connect
              </Button>
            </li>
          </ol>
        )}
        {err ? <p className="text-xs text-destructive">{err}</p> : null}
      </section>

      <section className={cn("space-y-3 px-4 py-4", PERSONA_FIELD_SHELL_CLASS)}>
        <div className="flex items-center gap-2 text-sm">
          <AtSign className="h-4 w-4 text-muted-foreground" />
          <span className="font-semibold text-foreground">Email</span>
          <span className="ms-auto inline-flex items-center gap-1.5 text-xs text-muted-foreground">
            {dot(!!details?.email?.ok)} {details?.email?.ok ? "Receiving" : draft.email ? "Waiting for the team mailbox" : "Not set"}
          </span>
        </div>
        <Input className="h-9 text-sm" dir="ltr" disabled={disabled} onChange={(e) => set("email", e.target.value)}
          placeholder="dev@unlimitedsolutions.technology" value={draft.email} />
        <ul className="space-y-1.5 text-xs text-muted-foreground">
          <li className="flex items-start gap-1.5"><ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            In Hostinger make this address an alias of the team mailbox (team@). Mail to it reaches this employee.</li>
          <li className="flex items-start gap-1.5"><ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            Emails to you go out directly; emails to anyone else wait for your approval in Outbox.</li>
        </ul>
      </section>
    </div>
  );
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
      toast.success(act === "delete" ? `${employee.name} was removed from the server.` : "Done.");
      await qc.invalidateQueries({ queryKey: ["unlimited", "server-agents"] });
      await qc.invalidateQueries({ queryKey: ["unlimited", "server-agent", employee.slug] });
      if (act === "delete") onDone();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not do that.");
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
  const [section, setSection] = React.useState<Section>("profile");
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
      setSection("profile");
      loadedFor.current = "new";
    } else if (editing && details && loadedFor.current !== employee.slug) {
      setDraft(fromDetails(details));
      setError(null);
      setSection("profile");
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
    const { voice, ...base } = draft;
    const payload: ServerEmployeeInput = {
      ...base,
      ...(isDemo() ? { voice } : {}),
      name: draft.name.trim(),
      role: draft.about.trim(),
      about: draft.about.trim(),
      mcp: draft.mcp.filter((m) => m.name.trim() || m.url.trim()),
    };
    try {
      if (editing) {
        await odooApi.updateServerAgent(employee.slug, payload);
        toast.success(`Saved. ${payload.name} is restarting on the server with the new settings.`);
      } else {
        await odooApi.createServerAgent(payload);
        toast.success(`${payload.name} was created on the server and is starting.`);
      }
      await qc.invalidateQueries({ queryKey: ["unlimited", "server-agents"] });
      await qc.invalidateQueries({ queryKey: ["unlimited", "server-agent"] });
      onOpenChange(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save.");
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

  const demo = isDemo();
  const sections: { id: Section; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
    { id: "profile", label: "Profile", icon: UserRound },
    ...(editing ? [{ id: "odoo" as Section, label: "Company Odoo", icon: Building2 }] : []),
    { id: "channels", label: "Telegram & email", icon: Send },
    ...(demo ? [{ id: "voice" as Section, label: "Voice", icon: Mic }] : []),
    { id: "instructions", label: "Instructions", icon: FileText },
    { id: "model", label: "Model & server", icon: Cpu },
    ...(editing ? [{ id: "memory" as Section, label: "Memory", icon: Brain }] : []),
    { id: "advanced", label: "Advanced", icon: SlidersHorizontal },
  ];
  const head = details?.person || draft.person || draft.name || "New employee";

  return (
    <Dialog
      onOpenChange={(next) => {
        if (!next && (pending || avatarPending)) return;
        onOpenChange(next);
      }}
      open={open}
    >
      <ChooserDialogContent
        className="h-[min(860px,calc(100vh-3rem))] w-[min(1180px,calc(100vw-2rem))] max-w-none border-0"
        contentClassName="flex min-h-0 flex-1 pt-3"
        data-testid="persona-dialog"
        description={
          editing
            ? "Runs on the Unlimited server. Changes are saved there and the employee restarts with them."
            : "Created and run on the Unlimited server, with its own key. Nothing runs on this computer."
        }
        footer={footer}
        footerClassName="border-t-0 pt-0"
        headerClassName="pb-2"
        title={editing ? `${head} · Profile` : "New server employee"}
      >
        {loading ? (
          <div className="flex items-center gap-2 py-10 text-sm text-muted-foreground">
            {detailsQuery.isError ? (
              "Could not load the settings from the server."
            ) : (
              <>
                <Loader2 className="h-4 w-4 animate-spin" /> Loading from the server…
              </>
            )}
          </div>
        ) : (
          <form className="grid min-h-0 w-full flex-1 gap-6 md:grid-cols-[230px_minmax(0,1fr)]" id="persona-dialog-form" onSubmit={submit}>
            <aside className="flex min-h-0 flex-col gap-4">
              <AgentCreationPreview
                avatarUrl={draft.avatar || null}
                disabled={pending || avatarPending}
                label={draft.name || "New employee"}
                onClearAvatar={() => set("avatar", "")}
                onSelectAvatar={(url) => set("avatar", url)}
                onUploadPendingChange={setAvatarPending}
              />
              <div className="min-w-0 px-1">
                <p className="truncate text-sm font-semibold text-foreground">{head}</p>
                <p className="truncate text-xs text-muted-foreground">{draft.title || draft.about || "Server employee"}</p>
              </div>
              <nav aria-label="Employee sections" className="flex flex-col gap-0.5">
                {sections.map((sec) => {
                  const Icon = sec.icon;
                  return (
                    <button
                      className={cn(
                        "flex items-center gap-2.5 rounded-lg px-3 py-2 text-start text-sm transition-colors",
                        section === sec.id ? "bg-muted font-medium text-foreground" : "text-muted-foreground hover:bg-muted/50 hover:text-foreground",
                      )}
                      data-testid={`employee-section-${sec.id}`}
                      key={sec.id}
                      onClick={() => setSection(sec.id)}
                      type="button"
                    >
                      <Icon className="h-4 w-4" /> {sec.label}
                    </button>
                  );
                })}
              </nav>
            </aside>

            <div className="min-h-0 space-y-5 overflow-y-auto pb-6 pe-1">
              {section === "profile" ? (
                <>
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
                  {true ? (
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div className="space-y-1.5">
                        <Label htmlFor="server-employee-person" optional>Full name</Label>
                        <div className={PERSONA_FIELD_SHELL_CLASS}>
                          <Input className={cn("h-10 px-3", PERSONA_FIELD_CONTROL_CLASS)} dir="auto" disabled={pending} id="server-employee-person"
                            onChange={(e) => set("person", e.target.value)} placeholder="Omar Hassan" value={draft.person} />
                        </div>
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor="server-employee-title">Job title</Label>
                        <div className={PERSONA_FIELD_SHELL_CLASS}>
                          <Input className={cn("h-10 px-3", PERSONA_FIELD_CONTROL_CLASS)} dir="auto" disabled={pending} id="server-employee-title"
                            onChange={(e) => set("title", e.target.value)} placeholder="Senior Odoo Developer" value={draft.title} />
                        </div>
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor="server-employee-department">Department</Label>
                        <PersonaDropdownField disabled={pending} id="server-employee-department" onValueChange={(v) => set("department", v)}
                          options={DEPARTMENT_OPTIONS} placeholder="Choose a department" value={draft.department} />
                      </div>
                    </div>
                  ) : null}
                </>
              ) : null}

              {section === "odoo" ? (
                <OdooAccountSection memberId={`ai:${employee?.slug ?? ""}`} name={details?.person || draft.person || draft.name || employee?.slug || ""} />
              ) : null}

              {section === "channels" ? <ChannelsField details={details} disabled={pending} draft={draft} employee={employee} set={set} /> : null}

              {section === "voice" ? (
                <div className="space-y-1.5">
                  <Label htmlFor="server-employee-voice">Voice in calls</Label>
                  <div className="flex max-w-md gap-2">
                    <div className="min-w-0 flex-1">
                      <PersonaDropdownField disabled={pending} id="server-employee-voice" onValueChange={(v) => set("voice", v)}
                        options={VOICE_OPTIONS} placeholder="Choose a voice" value={draft.voice} />
                    </div>
                    <Button className="h-10" disabled={!draft.voice} size="sm" type="button" variant="outline"><Play /> Play</Button>
                  </div>
                  <p className="text-xs text-muted-foreground">The employee keeps this voice in every call. Call settings are in Settings, Voice.</p>
                </div>
              ) : null}

              {section === "instructions" ? (
                <div className="space-y-1.5">
                  <Label htmlFor="server-employee-instructions">Agent instructions</Label>
                  <div className={PERSONA_FIELD_SHELL_CLASS}>
                    <Textarea
                      className={cn("min-h-[55vh] resize-y px-3 py-3 leading-6", PERSONA_FIELD_CONTROL_CLASS)}
                      dir="auto"
                      disabled={pending}
                      id="server-employee-instructions"
                      onChange={(e) => set("instructions", e.target.value)}
                      placeholder="Describe what this employee should do. Company rules (Arabic first, memory, task workflow) are added automatically."
                      value={draft.instructions}
                    />
                  </div>
                </div>
              ) : null}

              {section === "model" ? (
                <>
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
                      <PersonaDropdownField disabled={pending} id="server-employee-model" onValueChange={(v) => set("model", v as Draft["model"])}
                        options={MODEL_OPTIONS} placeholder="Choose a model" value={draft.model} />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="server-employee-effort">Effort</Label>
                      <PersonaDropdownField disabled={pending} id="server-employee-effort" onValueChange={(v) => set("thinking", Number(v))}
                        options={EFFORT_OPTIONS} placeholder="Thinking effort" value={String(draft.thinking)} />
                    </div>
                  </div>
                </>
              ) : null}

              {(section === "model" || section === "memory") && editing ? (
                <ServerControls details={details} employee={employee} onDone={() => onOpenChange(false)} />
              ) : null}

              {section === "advanced" ? (
                <>
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
                    <Checklist allLabel="All projects" empty="No projects on the server yet." items={options?.projects_available ?? []}
                      onChange={(v) => set("projects", v.length ? v : ["*"])} selected={draft.projects} />
                  </div>
                  <div className="space-y-1.5">
                    <Label optional>Skills</Label>
                    <Checklist empty="No skills in the server library yet." items={options?.skills_available ?? []}
                      onChange={(v) => set("skills", v)} selected={draft.skills} />
                  </div>
                  <EnvVarsEditor disabled={pending} helperText="Saved on the server for this employee only." onChange={(v) => set("env", v)} value={draft.env} />
                  <McpServersEditor disabled={pending} onChange={(v) => set("mcp", v)} value={draft.mcp} />
                </>
              ) : null}

              {error ? <p className="text-sm text-destructive">{error}</p> : null}
            </div>
          </form>
        )}
      </ChooserDialogContent>
    </Dialog>
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
