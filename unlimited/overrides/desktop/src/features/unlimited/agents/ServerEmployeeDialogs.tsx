/**
 * Unlimited Agent — create a server employee, and its settings (instructions, model, skills, projects,
 * memory, run controls). Every change goes to the server (connector → agentctl); nothing runs locally.
 */
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Play, RotateCcw, Square, Trash2 } from "lucide-react";
import * as React from "react";
import { toast } from "sonner";

import {
  odooApi,
  type ServerEmployee,
  type ServerEmployeeInput,
} from "@/features/unlimited/odoo/api";
import { cn } from "@/shared/lib/cn";
import { Button } from "@/shared/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/shared/ui/dialog";
import { Input } from "@/shared/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/shared/ui/tabs";
import { Textarea } from "@/shared/ui/textarea";

const THINKING = [
  { value: 0, label: "بدون" },
  { value: 4000, label: "متوسط" },
  { value: 12000, label: "عالي" },
  { value: 24000, label: "أقصى" },
];

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <span className="block text-sm font-medium text-foreground">{label}</span>
      {children}
      {hint ? <span className="block text-xs text-muted-foreground">{hint}</span> : null}
    </div>
  );
}

function Choice<T extends string | number>({
  options,
  value,
  onChange,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <div className="inline-flex rounded-lg border border-border/70 bg-muted/30 p-0.5">
      {options.map((o) => (
        <button
          className={cn(
            "rounded-md px-3 py-1 text-sm transition-colors",
            value === o.value ? "bg-background font-medium text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
          )}
          key={String(o.value)}
          onClick={() => onChange(o.value)}
          type="button"
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

function Checklist({
  items,
  selected,
  onChange,
  empty,
  label = (x: string) => x,
}: {
  items: string[];
  selected: string[];
  onChange: (next: string[]) => void;
  empty: string;
  label?: (x: string) => string;
}) {
  if (items.length === 0) return <p className="text-sm text-muted-foreground">{empty}</p>;
  return (
    <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
      {items.map((item) => {
        const on = selected.includes(item);
        return (
          <label
            className={cn(
              "flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-sm",
              on ? "border-primary/50 bg-primary/5" : "border-border/70 hover:bg-muted/40",
            )}
            key={item}
          >
            <input
              checked={on}
              className="h-4 w-4"
              onChange={() => onChange(on ? selected.filter((s) => s !== item) : [...selected, item])}
              type="checkbox"
            />
            <span className="truncate">{label(item)}</span>
          </label>
        );
      })}
    </div>
  );
}

const projectLabel = (p: string) => (p === "*" ? "كل المشاريع" : p);

/** "All projects" is exclusive: picking it clears the others, picking a project clears it. */
function nextProjects(prev: string[], next: string[]): string[] {
  if (next.includes("*") && !prev.includes("*")) return ["*"];
  const specific = next.filter((p) => p !== "*");
  return specific.length ? specific : ["*"];
}

function useMeta(enabled: boolean) {
  // Skills and projects for a brand-new employee come from an existing one's details.
  return useQuery({
    queryKey: ["unlimited", "server-agent-meta"],
    queryFn: async () => {
      const rows = await odooApi.serverAgents();
      const first = rows[0];
      return first ? odooApi.serverAgent(first.slug) : null;
    },
    enabled,
    staleTime: 60_000,
    retry: false,
  });
}

const EMPTY: ServerEmployeeInput = {
  name: "",
  role: "",
  instructions: "",
  model: "opus",
  thinking: 12000,
  skills: [],
  projects: ["*"],
};

export function NewServerEmployeeDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const queryClient = useQueryClient();
  const meta = useMeta(open);
  const [form, setForm] = React.useState<ServerEmployeeInput>(EMPTY);
  const [busy, setBusy] = React.useState(false);
  React.useEffect(() => {
    if (open) setForm(EMPTY);
  }, [open]);
  const set = <K extends keyof ServerEmployeeInput>(k: K, v: ServerEmployeeInput[K]) => setForm((f) => ({ ...f, [k]: v }));
  const valid = /^[A-Za-z][A-Za-z0-9 -]{1,29}$/.test(form.name.trim()) && form.role.trim().length > 2;

  async function submit() {
    setBusy(true);
    try {
      await odooApi.createServerAgent({ ...form, name: form.name.trim() });
      toast.success(`${form.name.trim()} اتعمل على السيرفر وشغال.`);
      void queryClient.invalidateQueries({ queryKey: ["unlimited", "server-agents"] });
      onOpenChange(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "تعذر إنشاء الموظف.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog onOpenChange={(o) => !busy && onOpenChange(o)} open={open}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>New server employee</DialogTitle>
          <DialogDescription dir="rtl">
            الموظف هيتعمل ويشتغل على سيرفر الشركة، بهوية ومفتاح خاصين بيه على السيرفر. مفيش أي حاجة على جهازك.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4" dir="rtl">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field hint="بالإنجليزي، مثلًا Sales" label="الاسم">
              <Input dir="ltr" id="new-employee-name" onChange={(e) => set("name", e.target.value)} placeholder="Sales" value={form.name} />
            </Field>
            <Field hint="سطر واحد بيظهر تحت اسمه" label="الدور">
              <Input
                id="new-employee-role"
                onChange={(e) => set("role", e.target.value)}
                placeholder="مبيعات: متابعة العملاء وعروض الأسعار"
                value={form.role}
              />
            </Field>
          </div>
          <Field hint="اكتب شغلته، وحدوده، وطريقة رده. القواعد العامة للشركة (العربي، الذاكرة) بتتضاف لوحدها." label="التعليمات">
            <Textarea
              className="min-h-40"
              id="new-employee-instructions"
              onChange={(e) => set("instructions", e.target.value)}
              value={form.instructions}
            />
          </Field>
          <div className="flex flex-wrap gap-6">
            <Field label="الموديل">
              <Choice
                onChange={(v) => set("model", v)}
                options={[
                  { value: "opus" as const, label: "Opus" },
                  { value: "sonnet" as const, label: "Sonnet" },
                ]}
                value={form.model}
              />
            </Field>
            <Field label="مستوى التفكير">
              <Choice onChange={(v) => set("thinking", v)} options={THINKING} value={form.thinking} />
            </Field>
          </div>
          <Field label="المشاريع">
            <Checklist
              empty="مفيش مشاريع متربطة."
              items={["*", ...(meta.data?.projects_available ?? [])]}
              label={projectLabel}
              onChange={(next) => set("projects", nextProjects(form.projects, next))}
              selected={form.projects}
            />
          </Field>
          <Field label="المهارات (Skills)">
            <Checklist
              empty="مفيش مهارات في المكتبة."
              items={meta.data?.skills_available ?? []}
              onChange={(next) => set("skills", next)}
              selected={form.skills}
            />
          </Field>
        </div>
        <DialogFooter>
          <Button disabled={busy} onClick={() => onOpenChange(false)} variant="ghost">
            Cancel
          </Button>
          <Button disabled={busy || !valid} onClick={() => void submit()}>
            {busy ? <Loader2 className="animate-spin" /> : null}
            {busy ? "بيتعمل على السيرفر…" : "Create employee"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function nearestThinking(v: number | undefined): number {
  const x = v ?? 0;
  return THINKING.reduce((best, t) => (Math.abs(t.value - x) < Math.abs(best - x) ? t.value : best), 0);
}

export function ServerEmployeeSettingsDialog({
  employee,
  onOpenChange,
}: {
  employee: ServerEmployee | null;
  onOpenChange: (o: boolean) => void;
}) {
  const queryClient = useQueryClient();
  const details = useQuery({
    queryKey: ["unlimited", "server-agent", employee?.slug ?? "none"],
    queryFn: () => odooApi.serverAgent(employee!.slug),
    enabled: Boolean(employee),
    retry: false,
  });
  const [draft, setDraft] = React.useState<Partial<ServerEmployeeInput>>({});
  const [busy, setBusy] = React.useState<string | null>(null);
  React.useEffect(() => setDraft({}), [employee?.slug]);
  const d = details.data;
  const dirty = Object.keys(draft).length > 0;
  const role = draft.role ?? d?.role ?? "";
  const instructions = draft.instructions ?? d?.instructions ?? "";
  const model = draft.model ?? d?.model ?? "opus";
  const thinking = nearestThinking(draft.thinking ?? d?.thinking);
  const skills = draft.skills ?? d?.skills ?? [];
  const projects = draft.projects ?? d?.projects ?? ["*"];

  async function run(label: string, fn: () => Promise<unknown>, success: string) {
    setBusy(label);
    try {
      await fn();
      toast.success(success);
      setDraft({});
      void queryClient.invalidateQueries({ queryKey: ["unlimited", "server-agents"] });
      void details.refetch();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "تعذر تنفيذ الطلب.");
    } finally {
      setBusy(null);
    }
  }

  const slug = employee?.slug ?? "";
  const doAction = (what: "start" | "stop" | "restart", msg: string) =>
    void run(what, () => odooApi.serverAgentAction(slug, { do: what }), msg);

  return (
    <Dialog onOpenChange={(o) => !busy && onOpenChange(o)} open={Boolean(employee)}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>{employee?.name} · Settings</DialogTitle>
          <DialogDescription dir="rtl">{employee?.role || "موظف على السيرفر"}</DialogDescription>
        </DialogHeader>
        {!d ? (
          <div className="flex items-center gap-2 py-10 text-sm text-muted-foreground" dir="rtl">
            {details.isError ? "تعذر تحميل الإعدادات من السيرفر." : (
              <>
                <Loader2 className="h-4 w-4 animate-spin" /> بيحمّل الإعدادات من السيرفر…
              </>
            )}
          </div>
        ) : (
          <Tabs defaultValue="instructions" dir="rtl">
            <TabsList>
              <TabsTrigger value="instructions">التعليمات</TabsTrigger>
              <TabsTrigger value="model">الموديل</TabsTrigger>
              <TabsTrigger value="skills">المهارات</TabsTrigger>
              <TabsTrigger value="projects">المشاريع</TabsTrigger>
              <TabsTrigger value="memory">الذاكرة</TabsTrigger>
              <TabsTrigger value="control">التشغيل</TabsTrigger>
            </TabsList>
            <TabsContent className="space-y-3 pt-3" value="instructions">
              <Field label="الدور">
                <Input id="employee-role" onChange={(e) => setDraft((x) => ({ ...x, role: e.target.value }))} value={role} />
              </Field>
              <Field hint="ده النص الكامل اللي الموظف شغال بيه. التعديل بيتطبق بعد الحفظ." label="التعليمات">
                <Textarea
                  className="min-h-[22rem] font-mono text-xs leading-5"
                  dir="auto"
                  id="employee-instructions"
                  onChange={(e) => setDraft((x) => ({ ...x, instructions: e.target.value }))}
                  value={instructions}
                />
              </Field>
            </TabsContent>
            <TabsContent className="space-y-4 pt-3" value="model">
              <Field hint="Opus أذكى وأبطأ، Sonnet أسرع وأخف." label="الموديل">
                <Choice
                  onChange={(v) => setDraft((x) => ({ ...x, model: v }))}
                  options={[
                    { value: "opus" as const, label: "Opus" },
                    { value: "sonnet" as const, label: "Sonnet" },
                  ]}
                  value={model}
                />
              </Field>
              <Field hint="تفكير أكتر = خطط وقرارات أدق، ووقت أطول." label="مستوى التفكير">
                <Choice onChange={(v) => setDraft((x) => ({ ...x, thinking: v }))} options={THINKING} value={thinking} />
              </Field>
            </TabsContent>
            <TabsContent className="pt-3" value="skills">
              <Checklist
                empty="مفيش مهارات في المكتبة."
                items={d.skills_available}
                onChange={(next) => setDraft((x) => ({ ...x, skills: next }))}
                selected={skills}
              />
            </TabsContent>
            <TabsContent className="pt-3" value="projects">
              <Checklist
                empty="مفيش مشاريع متربطة."
                items={["*", ...d.projects_available]}
                label={projectLabel}
                onChange={(next) => setDraft((x) => ({ ...x, projects: nextProjects(projects, next) }))}
                selected={projects}
              />
            </TabsContent>
            <TabsContent className="space-y-2 pt-3" value="memory">
              {d.memory.length === 0 ? (
                <p className="text-sm text-muted-foreground">لسه مفيش حاجة في ذاكرته.</p>
              ) : (
                d.memory.map((m) => (
                  <div className="rounded-lg border border-border/70 p-3" key={m.file}>
                    <div className="flex items-center justify-between gap-2">
                      <span className="truncate font-mono text-xs text-foreground" dir="ltr">
                        {m.file}
                      </span>
                      <Button
                        className="text-destructive hover:text-destructive"
                        disabled={busy !== null}
                        onClick={() =>
                          void run("mem", () => odooApi.serverAgentAction(slug, { do: "memory_delete", file: m.file }), "اتمسح من الذاكرة.")
                        }
                        size="xs"
                        variant="ghost"
                      >
                        <Trash2 /> امسح
                      </Button>
                    </div>
                    <p className="mt-1 line-clamp-4 whitespace-pre-wrap text-xs text-muted-foreground" dir="auto">
                      {m.preview}
                    </p>
                  </div>
                ))
              )}
            </TabsContent>
            <TabsContent className="space-y-3 pt-3" value="control">
              <p className="text-sm">
                الحالة:{" "}
                <span
                  className={cn(
                    "font-medium",
                    d.status === "running" ? "text-emerald-600 dark:text-emerald-400" : "text-amber-600 dark:text-amber-400",
                  )}
                >
                  {d.status === "running" ? "شغال" : d.status === "exited" ? "واقف" : d.status}
                </span>
              </p>
              <div className="flex flex-wrap gap-2">
                <Button disabled={busy !== null} onClick={() => doAction("start", "اشتغل.")} size="sm" variant="outline">
                  <Play /> تشغيل
                </Button>
                <Button disabled={busy !== null} onClick={() => doAction("restart", "اتعمله إعادة تشغيل.")} size="sm" variant="outline">
                  <RotateCcw /> إعادة تشغيل
                </Button>
                <Button disabled={busy !== null} onClick={() => doAction("stop", "وقف.")} size="sm" variant="outline">
                  <Square /> إيقاف
                </Button>
                {!d.builtin ? (
                  <Button
                    disabled={busy !== null}
                    onClick={() =>
                      void run(
                        "delete",
                        async () => {
                          await odooApi.serverAgentAction(slug, { do: "delete" });
                          onOpenChange(false);
                        },
                        "الموظف اتشال. ملفاته محفوظة في الأرشيف على السيرفر.",
                      )
                    }
                    size="sm"
                    variant="destructive"
                  >
                    <Trash2 /> حذف الموظف
                  </Button>
                ) : null}
              </div>
              {d.builtin ? <p className="text-xs text-muted-foreground">ده موظف أساسي، ينفع توقفه بس مايتمسحش.</p> : null}
            </TabsContent>
          </Tabs>
        )}
        <DialogFooter>
          <Button disabled={busy !== null} onClick={() => onOpenChange(false)} variant="ghost">
            Close
          </Button>
          <Button disabled={!dirty || busy !== null} onClick={() => void run("save", () => odooApi.updateServerAgent(slug, draft), "اتحفظ، والموظف اتعمله إعادة تشغيل.")}>
            {busy === "save" ? <Loader2 className="animate-spin" /> : null}
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
