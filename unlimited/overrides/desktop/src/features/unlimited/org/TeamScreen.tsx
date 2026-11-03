/**
 * Unlimited Agent — Team: the org chart (people and AI employees, who reports to whom, who approves what),
 * each person's day from the company Odoo, the team's workload, and the plan settings (company Odoo link,
 * projects, daily times). Changes are saved on the connector (/admin/org).
 */
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { CalendarClock, Camera, Check, Loader2, Network, Pencil, Plus, Settings2, Trash2, Users } from "lucide-react";
import * as React from "react";

import { cn } from "@/shared/lib/cn";
import { Button } from "@/shared/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/shared/ui/dialog";

import { connectionsApi } from "../connections/api";
import {
  ACTION_LABEL,
  below,
  type Department,
  firstName,
  type Org,
  type OrgAction,
  orgApi,
  type OrgPerson,
  rowFor,
  type Today,
} from "./api";
import { Bar, Card, dayState, errorText, hours, OrgAvatar, Pill } from "./ui";

const field =
  "h-9 w-full rounded-md border border-border/70 bg-background px-3 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring";
const TABS = [
  { id: "chart", label: "Org chart", icon: Network },
  { id: "load", label: "Workload", icon: Users },
  { id: "settings", label: "Plan settings", icon: Settings2 },
] as const;
type Tab = (typeof TABS)[number]["id"];

export function TeamScreen() {
  const qc = useQueryClient();
  const org = useQuery({ queryKey: ["unlimited", "org"], queryFn: () => orgApi.org(), retry: false });
  const today = useQuery({ queryKey: ["unlimited", "today"], queryFn: () => orgApi.today(), retry: false, refetchInterval: 60_000 });
  const [tab, setTab] = React.useState<Tab>("chart");
  const [selected, setSelected] = React.useState<string | null>(null);
  const [dept, setDept] = React.useState<string | null>(null);
  const openPerson = (id: string) => {
    setDept(null);
    setSelected(id);
  };
  const openDept = (id: string) => {
    setSelected(null);
    setDept(id);
  };
  const [adding, setAdding] = React.useState(false);
  const refresh = () => {
    void qc.invalidateQueries({ queryKey: ["unlimited", "org"] });
    void qc.invalidateQueries({ queryKey: ["unlimited", "today"] });
  };
  const o = org.data;

  return (
    <div className="flex h-full min-h-0 w-full" data-testid="team-screen">
      <main className="min-w-0 flex-1 overflow-y-auto px-6 py-5">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-xl bg-muted/45 px-4 py-3">
          <div>
            <h1 className="flex items-center gap-2 text-base font-semibold text-foreground">
              <Network className="h-4 w-4 text-muted-foreground" /> Team
            </h1>
            <p className="text-xs text-muted-foreground">Who reports to whom, who approves what, and everyone's day</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <nav aria-label="Team views" className="flex gap-1 rounded-lg border border-border/60 bg-background p-0.5" role="tablist">
              {TABS.map((x) => (
                <button
                  aria-selected={tab === x.id}
                  className={cn(
                    "flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-semibold transition-colors",
                    tab === x.id ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted",
                  )}
                  key={x.id}
                  onClick={() => setTab(x.id)}
                  role="tab"
                  type="button"
                >
                  <x.icon className="h-3.5 w-3.5" /> {x.label}
                </button>
              ))}
            </nav>
            <Button className="h-8 gap-1.5 text-xs" onClick={() => setAdding(true)} size="sm" type="button">
              <Plus className="h-3.5 w-3.5" /> Add a person
            </Button>
          </div>
        </div>

        {org.isLoading ? (
          <p className="flex items-center gap-2 py-16 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading the team…
          </p>
        ) : org.isError || !o ? (
          <Card className="px-5 py-6 text-sm text-muted-foreground">The team is available to the workspace owner: {errorText(org.error)}</Card>
        ) : tab === "settings" ? (
          <PlanSettings onChanged={refresh} org={o} />
        ) : (
          <div className={cn("grid gap-4", (selected || dept) && "xl:grid-cols-[minmax(0,1fr)_400px]")}>
            {tab === "chart" ? (
              <OrgChart onEditDept={openDept} onOpen={openPerson} org={o} selected={selected} today={today.data} />
            ) : (
              <Workload onOpen={openPerson} org={o} today={today.data} />
            )}
            {selected ? <PersonPanel id={selected} key={selected} onChanged={refresh} onClose={() => setSelected(null)} org={o} /> : null}
            {dept ? <DeptPanel id={dept} key={dept} onChanged={refresh} onClose={() => setDept(null)} org={o} /> : null}
          </div>
        )}
      </main>
      {adding && o ? (
        <AddPerson
          onClose={(added) => {
            setAdding(false);
            if (added) refresh();
          }}
          org={o}
        />
      ) : null}
    </div>
  );
}

// ------------------------------------------------------------------ org chart (CEO -> departments -> head -> people)
function Node({ p, onOpen, active, size = 46 }: { p: OrgPerson; onOpen: (id: string) => void; active: boolean; size?: number }) {
  return (
    <button
      className={cn(
        "flex w-36 flex-col items-center gap-1 rounded-xl px-1 py-2 text-center transition-colors hover:bg-muted/50",
        active && "bg-primary/10 ring-1 ring-primary/30",
      )}
      onClick={() => onOpen(p.id)}
      type="button"
    >
      <OrgAvatar badge={p.owner ? "You" : undefined} person={p} size={size} />
      <span className="mt-1 w-full truncate text-sm font-bold text-foreground">{p.name}</span>
      <span className="line-clamp-2 text-[11px] leading-tight text-muted-foreground">{p.title || (p.kind === "ai" ? "AI employee" : "Teammate")}</span>
    </button>
  );
}

const vline = <span className="mx-auto my-1 block h-4 w-0.5 bg-primary/25" />;

function PersonRow({
  m,
  today,
  onOpen,
  selected,
  head,
}: {
  m: OrgPerson;
  today?: Today;
  onOpen: (id: string) => void;
  selected: string | null;
  head?: boolean;
}) {
  const r = rowFor(today, m.id);
  const [label, tone] = dayState(r);
  return (
    <button
      className={cn(
        "flex w-full items-center gap-3 rounded-lg px-2 py-1.5 text-start hover:bg-muted/50",
        selected === m.id && "bg-primary/10",
        head && "py-2",
      )}
      onClick={() => onOpen(m.id)}
      type="button"
    >
      <OrgAvatar person={m} size={head ? 42 : 34} />
      <span className="min-w-0 flex-1">
        <span className={cn("block truncate font-semibold text-foreground", head ? "text-[15px]" : "text-sm")}>
          {m.name}
          {head ? <span className="ms-2 rounded-md bg-primary/10 px-1.5 py-0.5 text-[10px] font-bold text-primary">Head</span> : null}
        </span>
        <span className="block truncate text-xs text-muted-foreground">
          {m.title || (m.kind === "ai" ? "AI employee" : "Teammate")}
          {m.kind === "ai" && r ? ` · ${r.total} task${r.total === 1 ? "" : "s"} today` : ""}
        </span>
      </span>
      {m.kind === "ai" ? <Pill tone={tone}>{label}</Pill> : null}
    </button>
  );
}

function DeptCard({
  d,
  org,
  today,
  onOpen,
  onEdit,
  selected,
  depth,
}: {
  d: Department;
  org: Org;
  today?: Today;
  onOpen: (id: string) => void;
  onEdit: (id: string) => void;
  selected: string | null;
  depth: number;
}) {
  const depts = org.departments ?? [];
  const head = org.members.find((m) => m.id === d.head);
  const people = org.members.filter((m) => m.dept === d.id && m.id !== d.head && !m.owner);
  const kids = depts.filter((x) => x.parent === d.id);
  const total = people.length + (head ? 1 : 0);
  return (
    <section className={cn("min-w-0 rounded-xl border border-border/60", depth === 0 ? "bg-background px-3 py-3" : "bg-muted/25 px-2.5 py-2")}>
      <header className="mb-1.5 flex items-center justify-between gap-2 px-1">
        <h3 className={cn("truncate font-bold text-foreground", depth === 0 ? "text-sm" : "text-[13px]")}>
          {d.name} <span className="font-medium text-muted-foreground">· {total + kids.reduce((n, k) => n + countIn(org, k.id), 0)}</span>
        </h3>
        <button
          className="flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] font-semibold text-muted-foreground hover:bg-muted hover:text-foreground"
          onClick={() => onEdit(d.id)}
          type="button"
        >
          <Pencil className="h-3 w-3" /> Edit
        </button>
      </header>
      {head ? (
        <PersonRow head m={head} onOpen={onOpen} selected={selected} today={today} />
      ) : (
        <p className="px-2 py-1.5 text-xs text-muted-foreground">No head yet. Click Edit to choose one.</p>
      )}
      {people.length ? (
        <div className="ms-6 border-s-2 border-primary/20 ps-2">
          {people.map((m) => (
            <PersonRow key={m.id} m={m} onOpen={onOpen} selected={selected} today={today} />
          ))}
        </div>
      ) : null}
      {kids.length ? (
        <div className={cn("mt-2 grid gap-2", depth === 0 && kids.length > 1 && "2xl:grid-cols-2")}>
          {kids.map((k) => (
            <DeptCard d={k} depth={depth + 1} key={k.id} onEdit={onEdit} onOpen={onOpen} org={org} selected={selected} today={today} />
          ))}
        </div>
      ) : null}
    </section>
  );
}

function countIn(org: Org, id: string): number {
  const own = org.members.filter((m) => m.dept === id && !m.owner).length;
  return own + (org.departments ?? []).filter((x) => x.parent === id).reduce((n, k) => n + countIn(org, k.id), 0);
}

function OrgChart({
  org,
  today,
  onOpen,
  onEditDept,
  selected,
}: {
  org: Org;
  today?: Today;
  onOpen: (id: string) => void;
  onEditDept: (id: string) => void;
  selected: string | null;
}) {
  const owner = org.members.find((m) => m.owner) ?? org.members[0]!;
  const depts = org.departments ?? [];
  const top = depts.filter((d) => !d.parent || !depts.some((x) => x.id === d.parent));
  const loose = org.members.filter((m) => !m.owner && !depts.some((d) => d.id === m.dept));
  return (
    <Card className="min-w-0 px-4 py-5">
      <div className="flex flex-col items-center">
        <Node active={selected === owner.id} onOpen={onOpen} p={owner} size={58} />
        {top.length ? (
          <>
            {vline}
            {top.length > 1 ? (
              <span className="block h-3 w-1/2 max-w-full rounded-t-md border-x-2 border-t-2 border-primary/25" />
            ) : null}
          </>
        ) : null}
      </div>
      <div className={cn("grid gap-4", top.length > 1 && "lg:grid-cols-2", top.length > 2 && "2xl:grid-cols-3")}>
        {top.map((d) => (
          <DeptCard d={d} depth={0} key={d.id} onEdit={onEditDept} onOpen={onOpen} org={org} selected={selected} today={today} />
        ))}
      </div>
      {loose.length ? (
        <section className="mt-4 rounded-xl border border-dashed border-border/70 px-3 py-3">
          <h3 className="mb-1 px-1 text-sm font-bold text-foreground">Not in a department</h3>
          {loose.map((m) => (
            <PersonRow key={m.id} m={m} onOpen={onOpen} selected={selected} today={today} />
          ))}
        </section>
      ) : null}
      <div className="mt-4 flex flex-wrap items-center justify-center gap-3 text-xs text-muted-foreground">
        <span>Click anyone to set their department, manager, approvers and photo.</span>
        <Button className="h-7 gap-1 text-xs" onClick={() => onEditDept("new")} size="sm" type="button" variant="outline">
          <Plus className="h-3 w-3" /> Add a department
        </Button>
      </div>
    </Card>
  );
}

// ------------------------------------------------------------------ department editor
function DeptPanel({ id, org, onClose, onChanged }: { id: string; org: Org; onClose: () => void; onChanged: () => void }) {
  const depts = org.departments ?? [];
  const d = depts.find((x) => x.id === id);
  const [f, setF] = React.useState({ name: d?.name ?? "", head: d?.head ?? "", parent: d?.parent ?? "", apply: true });
  const [members, setMembers] = React.useState<string[]>(() => org.members.filter((m) => d && m.dept === d.id).map((m) => m.id));
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState("");
  const banned = new Set<string>();
  const mark = (x: string) => {
    banned.add(x);
    depts.filter((k) => k.parent === x).forEach((k) => mark(k.id));
  };
  if (d) mark(d.id);
  const save = async () => {
    setBusy(true);
    setError("");
    try {
      await orgApi.department({ ...(d ? { id: d.id } : {}), name: f.name.trim(), head: f.head, parent: f.parent, members, apply: f.apply });
      onChanged();
      onClose();
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  };
  const remove = async () => {
    if (!d) return;
    setBusy(true);
    try {
      await orgApi.department({ id: d.id, action: "remove" });
      onChanged();
      onClose();
    } catch (e) {
      setError(errorText(e));
      setBusy(false);
    }
  };
  return (
    <aside className="min-w-0 space-y-3">
      <Card className="space-y-3 px-4 py-4">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-bold text-foreground">{d ? `Department: ${d.name}` : "New department"}</h2>
          <button className="text-xs text-muted-foreground hover:text-foreground" onClick={onClose} type="button">
            Close
          </button>
        </div>
        <label className="flex flex-col gap-1 text-xs text-muted-foreground">
          Name
          <input className={field} onChange={(e) => setF({ ...f, name: e.target.value })} placeholder="Development" value={f.name} />
        </label>
        <label className="flex flex-col gap-1 text-xs text-muted-foreground">
          Under
          <select className={field} onChange={(e) => setF({ ...f, parent: e.target.value })} value={f.parent}>
            <option value="">The CEO (top level)</option>
            {depts
              .filter((x) => !banned.has(x.id))
              .map((x) => (
                <option key={x.id} value={x.id}>
                  {x.name}
                </option>
              ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs text-muted-foreground">
          Head (manager of this department)
          <select className={field} onChange={(e) => setF({ ...f, head: e.target.value })} value={f.head}>
            <option value="">No head yet</option>
            {org.members
              .filter((m) => !m.owner)
              .map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                  {m.title ? ` · ${m.title}` : ""}
                </option>
              ))}
          </select>
        </label>
        <div className="space-y-1 text-xs text-muted-foreground">
          People in this department
          <div className="max-h-56 space-y-0.5 overflow-y-auto rounded-lg border border-border/60 p-1.5">
            {org.members
              .filter((m) => !m.owner)
              .map((m) => {
                const on = members.includes(m.id) || m.id === f.head;
                const other = !on && m.dept ? depts.find((x) => x.id === m.dept)?.name : "";
                return (
                  <label className="flex cursor-pointer items-center gap-2 rounded-md px-1.5 py-1 hover:bg-muted/50" key={m.id}>
                    <input
                      checked={on}
                      disabled={m.id === f.head}
                      onChange={() => setMembers(on ? members.filter((x) => x !== m.id) : [...members, m.id])}
                      type="checkbox"
                    />
                    <OrgAvatar badge={false} person={m} size={22} />
                    <span className="min-w-0 flex-1 truncate text-foreground">{m.name}</span>
                    {other ? <span className="text-[10px]">now in {other}</span> : null}
                  </label>
                );
              })}
          </div>
        </div>
        <label className="flex items-start gap-2 text-xs text-muted-foreground">
          <input checked={f.apply} className="mt-0.5" onChange={(e) => setF({ ...f, apply: e.target.checked })} type="checkbox" />
          <span>Update reporting lines: the head reports to the head above (or you), and everyone here reports to the head.</span>
        </label>
        {error ? <p className="rounded-lg bg-destructive/10 px-3 py-2 text-xs text-destructive">{error}</p> : null}
        <div className="flex items-center justify-between gap-2">
          {d ? (
            <Button className="h-8 gap-1.5 text-xs text-destructive" disabled={busy} onClick={() => void remove()} size="sm" type="button" variant="ghost">
              <Trash2 className="h-3.5 w-3.5" /> Delete department
            </Button>
          ) : (
            <span />
          )}
          <Button className="h-8 gap-1.5 text-xs" disabled={busy || !f.name.trim()} onClick={() => void save()} size="sm" type="button">
            {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null} {d ? "Save department" : "Create department"}
          </Button>
        </div>
      </Card>
    </aside>
  );
}

function Workload({ org, today, onOpen }: { org: Org; today?: Today; onOpen: (id: string) => void }) {
  const ai = org.members.filter((m) => m.kind === "ai");
  return (
    <Card className="divide-y divide-border/60 px-4">
      {ai.map((p) => {
        const n = rowFor(today, p.id)?.total ?? 0;
        const cap = p.capacity ?? 3;
        return (
          <button className="flex w-full items-center gap-3 py-3 text-start" key={p.id} onClick={() => onOpen(p.id)} type="button">
            <OrgAvatar person={p} size={34} />
            <span className="min-w-0 flex-1">
              <span className="flex justify-between text-sm">
                <span className="truncate font-semibold text-foreground">{p.name}</span>
                <span className="text-xs text-muted-foreground">
                  {n} of {cap}
                </span>
              </span>
              <Bar className="mt-1.5" value={n / cap} />
            </span>
          </button>
        );
      })}
      {!today?.teams.length ? <p className="py-3 text-xs text-muted-foreground">Workload fills in once a plan is approved today.</p> : null}
    </Card>
  );
}

// ------------------------------------------------------------------ person panel
function ManagerSelect({ org, self, value, onChange }: { org: Org; self: string; value: string; onChange: (v: string) => void }) {
  const banned = new Set([self, ...below(org, self).map((p) => p.id)]);
  return (
    <select className={field} onChange={(e) => onChange(e.target.value)} value={value}>
      {org.members
        .filter((p) => !banned.has(p.id))
        .map((p) => (
          <option key={p.id} value={p.id}>
            {p.name}
            {p.title ? ` · ${p.title}` : ""}
          </option>
        ))}
    </select>
  );
}

function Approves({ value, onChange }: { value: OrgAction[]; onChange: (v: OrgAction[]) => void }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {(Object.keys(ACTION_LABEL) as OrgAction[]).map((a) => {
        const on = value.includes(a);
        return (
          <button
            aria-pressed={on}
            className={cn(
              "flex items-center gap-1 rounded-md border px-2 py-1 text-xs font-medium",
              on ? "border-primary bg-primary/10 text-primary" : "border-border/70 text-muted-foreground hover:bg-muted",
            )}
            key={a}
            onClick={() => onChange(on ? value.filter((x) => x !== a) : [...value, a])}
            type="button"
          >
            {on ? <Check className="h-3 w-3" /> : null} {ACTION_LABEL[a]}
          </button>
        );
      })}
    </div>
  );
}

function PersonPanel({ id, org, onClose, onChanged }: { id: string; org: Org; onClose: () => void; onChanged: () => void }) {
  const day = useQuery({ queryKey: ["unlimited", "member-day", id], queryFn: () => orgApi.memberDay(id), retry: false });
  const p = org.members.find((m) => m.id === id);
  const [f, setF] = React.useState(() => ({
    reports_to: p?.reports_to ?? "owner",
    odoo_user: p?.odoo_user ?? "",
    avatar: p?.avatar ?? "",
    name: p?.name ?? "",
    title: p?.title ?? "",
    dept: p?.dept ?? "",
    capacity: p?.capacity ?? 3,
    approves: (p?.approves ?? []) as OrgAction[],
    approver_set: { ...(p?.approver_set ?? {}) } as Partial<Record<OrgAction, string>>,
  }));
  const [uploading, setUploading] = React.useState(false);
  const fileRef = React.useRef<HTMLInputElement>(null);
  const depts = org.departments ?? [];
  const deptHead = (() => {
    const dd = depts.find((x) => x.id === f.dept);
    if (!dd) return "";
    if (dd.head && dd.head !== id) return dd.head;
    return depts.find((x) => x.id === dd.parent)?.head || "owner";
  })();
  const humans = org.members.filter((m) => m.kind === "human");
  const upload = async (file: File) => {
    if (file.size > 2_000_000) {
      setError("The photo must be under 2 MB.");
      return;
    }
    setUploading(true);
    setError("");
    try {
      const url = await new Promise<string>((res, rej) => {
        const r = new FileReader();
        r.onload = () => res(String(r.result));
        r.onerror = () => rej(new Error("could not read the file"));
        r.readAsDataURL(file);
      });
      const next = await orgApi.photo(id, url);
      setF((x) => ({ ...x, avatar: next.members.find((m) => m.id === id)?.avatar ?? x.avatar }));
      onChanged();
    } catch (e) {
      setError(errorText(e));
    } finally {
      setUploading(false);
    }
  };
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState("");
  const [saved, setSaved] = React.useState(false);
  if (!p) return null;
  const d = day.data;
  const a = d?.approvers ?? {};

  const save = async () => {
    setBusy(true);
    setError("");
    try {
      await orgApi.updateMember(p.id, {
        ...(p.owner ? {} : { reports_to: f.reports_to, dept: f.dept, approvers: f.approver_set, name: f.name.trim(), title: f.title.trim() }),
        ...(p.kind === "ai" ? {} : { odoo_user: f.odoo_user.trim() }),
        avatar: f.avatar.trim(),
        ...(p.kind === "ai" ? { capacity: f.capacity } : { approves: f.approves }),
      });
      setSaved(true);
      onChanged();
      void day.refetch();
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  };

  const rows: [string, string][] = [
    ...(p.kind === "ai"
      ? ([["Daily plan", a.drafted_by ? `${firstName(a.drafted_by)} drafts, ${firstName(a.plan) || "you"} approves` : (a.plan?.name ?? "You")]] as [
          string,
          string,
        ][])
      : []),
    ["Code to staging", a.staging?.name ?? "You"],
    ["Anything to production", a.production?.name ?? "You"],
  ];

  return (
    <aside className="min-w-0 space-y-3">
      <Card className="px-4 py-4">
        <div className="flex items-start gap-3">
          <OrgAvatar badge={p.owner ? "You" : undefined} person={p} size={56} />
          <div className="min-w-0 flex-1">
            <h2 className="truncate text-lg font-bold text-foreground">{p.name}</h2>
            <p className="truncate text-xs text-muted-foreground">{[p.title, p.department].filter(Boolean).join(", ")}</p>
            <div className="mt-1.5 flex flex-wrap gap-1">
              {d?.manager ? <Pill tone="accent">Reports to {firstName(d.manager)}</Pill> : null}
              {p.kind === "human" && !p.owner
                ? p.approves?.map((x) => (
                    <Pill key={x} tone="ok">
                      Approves {x}
                    </Pill>
                  ))
                : null}
            </div>
          </div>
          <button className="text-xs text-muted-foreground hover:text-foreground" onClick={onClose} type="button">
            Close
          </button>
        </div>
      </Card>

      {p.kind === "ai" ? (
        <Card className="px-4 py-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-foreground">Today, from Odoo</h3>
            <span className="text-xs text-muted-foreground">
              {!d
                ? ""
                : d.tasks.length
                  ? `${d.done} of ${d.tasks.length} done${d.spent ? `, ${hours(d.spent)} logged` : ""}`
                  : d.plan_status === "pending"
                    ? "Plan waits for approval"
                    : "No tasks yet"}
            </span>
          </div>
          {d?.tasks.length ? <Bar className="my-2" value={d.done / d.tasks.length} /> : null}
          <ul className="divide-y divide-border/60">
            {d?.tasks.map((t) => (
              <li className="flex items-start gap-2.5 py-2" key={t.id}>
                <span
                  className={cn(
                    "mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded border-2",
                    t.status === "done"
                      ? "border-primary bg-primary text-primary-foreground"
                      : t.status === "blocked"
                        ? "border-amber-500 bg-amber-500/15"
                        : "border-border",
                  )}
                >
                  {t.status === "done" ? <Check className="h-3 w-3" /> : null}
                </span>
                <span className="min-w-0 flex-1">
                  {t.url ? (
                    <a className="block truncate text-sm font-semibold text-foreground hover:underline" href={t.url} rel="noreferrer" target="_blank">
                      {t.name}
                    </a>
                  ) : (
                    <span className="block truncate text-sm font-semibold text-foreground">{t.name}</span>
                  )}
                  <span className="block text-xs text-muted-foreground">{[t.ref, t.stage, t.spent ? hours(t.spent) : ""].filter(Boolean).join(" · ")}</span>
                </span>
              </li>
            ))}
          </ul>
        </Card>
      ) : null}

      <Card className="px-4 py-3">
        <h3 className="mb-1 text-sm font-semibold text-foreground">Who approves {firstName(p)}'s work</h3>
        {rows.map(([k, v]) => (
          <div className="flex justify-between gap-3 py-1 text-xs" key={k}>
            <span className="text-muted-foreground">{k}</span>
            <span className="text-end font-semibold text-foreground">{v}</span>
          </div>
        ))}
      </Card>

      <Card className="space-y-3 px-4 py-4">
        <h3 className="flex items-center gap-2 text-sm font-semibold text-foreground">
          <CalendarClock className="h-4 w-4 text-muted-foreground" /> Place in the team
        </h3>
        <div className="flex items-center gap-3">
          <OrgAvatar badge={false} person={{ ...p, avatar: f.avatar }} size={52} />
          <div className="flex flex-col gap-1">
            <Button className="h-8 gap-1.5 text-xs" disabled={uploading} onClick={() => fileRef.current?.click()} size="sm" type="button" variant="outline">
              {uploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Camera className="h-3.5 w-3.5" />} Upload a photo
            </Button>
            <span className="text-[11px] text-muted-foreground">JPG, PNG or WebP, under 2 MB</span>
          </div>
          <input
            accept="image/jpeg,image/png,image/webp"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void upload(file);
              e.target.value = "";
            }}
            ref={fileRef}
            type="file"
          />
        </div>
        {!p.owner ? (
          <div className="grid grid-cols-2 gap-2">
            <label className="flex flex-col gap-1 text-xs text-muted-foreground">
              Name
              <input className={field} onChange={(e) => setF({ ...f, name: e.target.value })} value={f.name} />
            </label>
            <label className="flex flex-col gap-1 text-xs text-muted-foreground">
              Job title
              <input className={field} onChange={(e) => setF({ ...f, title: e.target.value })} value={f.title} />
            </label>
          </div>
        ) : null}
        {!p.owner ? (
          <label className="flex flex-col gap-1 text-xs text-muted-foreground">
            Department
            <select className={field} onChange={(e) => setF({ ...f, dept: e.target.value })} value={f.dept}>
              <option value="">No department</option>
              {depts.map((x) => (
                <option key={x.id} value={x.id}>
                  {x.name}
                </option>
              ))}
            </select>
          </label>
        ) : null}
        {!p.owner ? (
          <label className="flex flex-col gap-1 text-xs text-muted-foreground">
            <span className="flex items-center justify-between">
              Manager (reports to)
              {deptHead && deptHead !== f.reports_to ? (
                <button className="font-semibold text-primary hover:underline" onClick={() => setF({ ...f, reports_to: deptHead })} type="button">
                  Use the department head
                </button>
              ) : null}
            </span>
            <ManagerSelect onChange={(v) => setF({ ...f, reports_to: v })} org={org} self={p.id} value={f.reports_to} />
          </label>
        ) : null}
        {!p.owner ? (
          <div className="space-y-1.5 text-xs text-muted-foreground">
            Approvers for {firstName(p) || "this person"}
            {(Object.keys(ACTION_LABEL) as OrgAction[]).map((act) => (
              <label className="flex items-center justify-between gap-2" key={act}>
                <span className="text-foreground">{ACTION_LABEL[act]}</span>
                <select
                  className={cn(field, "h-8 w-52")}
                  onChange={(e) => setF({ ...f, approver_set: { ...f.approver_set, [act]: e.target.value } })}
                  value={f.approver_set[act] ?? ""}
                >
                  <option value="">Up the reporting line</option>
                  {humans.map((h) => (
                    <option key={h.id} value={h.id}>
                      {h.owner ? `${h.name} (you)` : h.name}
                    </option>
                  ))}
                </select>
              </label>
            ))}
            <span className="block text-[11px]">Only people approve. If the approver does not answer in time, it goes to you.</span>
          </div>
        ) : null}
        {p.kind === "ai" ? (
          <div className="flex items-start justify-between gap-3 rounded-lg border border-border/60 px-3 py-2 text-xs">
            <span className="min-w-0">
              <span className="block font-semibold text-foreground">Company Odoo</span>
              <span className="block text-muted-foreground">
                {p.odoo_connected ? `Logs in as ${p.odoo_user}` : "Not connected. Set its Odoo user and password in its profile (Agents > Company Odoo)."}
              </span>
            </span>
            <Pill tone={p.odoo_connected ? "ok" : "warn"}>{p.odoo_connected ? "Connected" : "Not set"}</Pill>
          </div>
        ) : (
          <label className="flex flex-col gap-1 text-xs text-muted-foreground">
            Odoo user (login)
            <input className={field} onChange={(e) => setF({ ...f, odoo_user: e.target.value })} placeholder="name@unlimitedsolutions.technology" value={f.odoo_user} />
            <span className="text-[11px]">Shows their Odoo tasks next to the team.</span>
          </label>
        )}
        <label className="flex flex-col gap-1 text-xs text-muted-foreground">
          Photo link (optional)
          <input className={field} onChange={(e) => setF({ ...f, avatar: e.target.value })} placeholder="https://…" value={f.avatar} />
        </label>
        {p.kind === "ai" ? (
          <label className="flex items-center justify-between gap-3 text-xs text-muted-foreground">
            Tasks a day
            <input
              className={cn(field, "w-20")}
              max={6}
              min={1}
              onChange={(e) => setF({ ...f, capacity: Number(e.target.value) || 1 })}
              type="number"
              value={f.capacity}
            />
          </label>
        ) : !p.owner ? (
          <div className="space-y-1.5 text-xs text-muted-foreground">
            {firstName(p)} approves
            <Approves onChange={(v) => setF({ ...f, approves: v })} value={f.approves} />
          </div>
        ) : null}
        {error ? <p className="rounded-lg bg-destructive/10 px-3 py-2 text-xs text-destructive">{error}</p> : null}
        <div className="flex items-center justify-between gap-2">
          {p.kind === "human" && !p.owner ? (
            <Button
              className="h-8 gap-1.5 text-xs text-destructive"
              disabled={busy}
              onClick={() =>
                void orgApi
                  .removeMember(p.id)
                  .then(() => {
                    onChanged();
                    onClose();
                  })
                  .catch((e: unknown) => setError(errorText(e)))
              }
              size="sm"
              type="button"
              variant="ghost"
            >
              <Trash2 className="h-3.5 w-3.5" /> Remove
            </Button>
          ) : (
            <span />
          )}
          <Button className="h-8 gap-1.5 text-xs" disabled={busy} onClick={() => void save()} size="sm" type="button">
            {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : saved ? <Check className="h-3.5 w-3.5" /> : null} Save
          </Button>
        </div>
      </Card>
    </aside>
  );
}

// ------------------------------------------------------------------ add a person
function AddPerson({ org, onClose }: { org: Org; onClose: (added: boolean) => void }) {
  const [f, setF] = React.useState({ pubkey: "", name: "", title: "", reports_to: "owner", approves: ["plan"] as OrgAction[] });
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState("");
  const add = async () => {
    setBusy(true);
    setError("");
    try {
      await orgApi.addPerson({ ...f, pubkey: f.pubkey.trim(), name: f.name.trim(), title: f.title.trim() });
      onClose(true);
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  };
  return (
    <Dialog onOpenChange={(v) => !v && onClose(false)} open>
      <DialogContent className="w-[520px] max-w-[calc(100vw-2rem)]">
        <DialogTitle className="text-lg font-semibold">Add a person</DialogTitle>
        <DialogDescription className="text-sm text-muted-foreground">
          Someone who runs the work with you, like a delivery manager who approves plans. They join the workspace first, then copy their key
          (npub) from their profile.
        </DialogDescription>
        <div className="mt-2 grid gap-3">
          <label className="flex flex-col gap-1 text-xs text-muted-foreground">
            Their key
            <input className={field} onChange={(e) => setF({ ...f, pubkey: e.target.value })} placeholder="npub1…" value={f.pubkey} />
          </label>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="flex flex-col gap-1 text-xs text-muted-foreground">
              Name
              <input className={field} onChange={(e) => setF({ ...f, name: e.target.value })} value={f.name} />
            </label>
            <label className="flex flex-col gap-1 text-xs text-muted-foreground">
              Job title
              <input className={field} onChange={(e) => setF({ ...f, title: e.target.value })} placeholder="Head of Delivery" value={f.title} />
            </label>
          </div>
          <label className="flex flex-col gap-1 text-xs text-muted-foreground">
            Reports to
            <ManagerSelect onChange={(v) => setF({ ...f, reports_to: v })} org={org} self="" value={f.reports_to} />
          </label>
          <div className="space-y-1.5 text-xs text-muted-foreground">
            They approve
            <Approves onChange={(v) => setF({ ...f, approves: v })} value={f.approves} />
          </div>
          {error ? <p className="rounded-lg bg-destructive/10 px-3 py-2 text-xs text-destructive">{error}</p> : null}
          <div className="flex justify-end gap-2">
            <Button onClick={() => onClose(false)} size="sm" type="button" variant="ghost">
              Cancel
            </Button>
            <Button disabled={busy || !f.pubkey.trim() || !f.name.trim()} onClick={() => void add()} size="sm" type="button">
              {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null} Add
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ------------------------------------------------------------------ plan settings
const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function PlanSettings({ org, onChanged }: { org: Org; onChanged: () => void }) {
  const connected = org.odoo.state === "connected";
  return (
    <div className="grid gap-4 xl:grid-cols-2">
      <CompanyOdoo connected={connected} detail={org.odoo.detail} onChanged={onChanged} />
      {connected ? <Rhythm onChanged={onChanged} org={org} /> : null}
    </div>
  );
}

function CompanyOdoo({ connected, detail, onChanged }: { connected: boolean; detail: string; onChanged: () => void }) {
  const [f, setF] = React.useState({ url: "https://unlimitedsolutions.technology", login: "", key: "", db: "" });
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState("");
  const run = async (fn: () => Promise<unknown>) => {
    setBusy(true);
    setError("");
    try {
      await fn();
      setF((x) => ({ ...x, key: "" }));
      onChanged();
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  };
  return (
    <Card className="space-y-3 px-5 py-4">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold text-foreground">Company Odoo</h3>
          <p className="text-xs text-muted-foreground">Employees read their daily tasks from it and update them as they work.</p>
        </div>
        <Pill tone={connected ? "ok" : "neutral"}>{connected ? "Connected" : "Not connected"}</Pill>
      </div>
      {connected ? (
        <>
          <p className="text-xs text-muted-foreground">{detail}</p>
          <Button className="h-8 text-xs" disabled={busy} onClick={() => void run(() => connectionsApi.disconnect("company_odoo"))} size="sm" type="button" variant="ghost">
            Disconnect
          </Button>
        </>
      ) : (
        <>
          <p className="text-xs text-muted-foreground">
            Create an API key in Odoo: My Profile &gt; Account Security &gt; New API Key. It is stored encrypted on your server and never shown again.
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="flex flex-col gap-1 text-xs text-muted-foreground sm:col-span-2">
              Odoo address
              <input className={field} onChange={(e) => setF({ ...f, url: e.target.value })} value={f.url} />
            </label>
            <label className="flex flex-col gap-1 text-xs text-muted-foreground">
              Login (email)
              <input className={field} onChange={(e) => setF({ ...f, login: e.target.value })} value={f.login} />
            </label>
            <label className="flex flex-col gap-1 text-xs text-muted-foreground">
              API key
              <input autoComplete="new-password" className={field} onChange={(e) => setF({ ...f, key: e.target.value })} type="password" value={f.key} />
            </label>
            <label className="flex flex-col gap-1 text-xs text-muted-foreground sm:col-span-2">
              Database (optional, found automatically when there is one)
              <input className={field} onChange={(e) => setF({ ...f, db: e.target.value })} value={f.db} />
            </label>
          </div>
          <div className="flex justify-end">
            <Button
              className="h-8 text-xs"
              disabled={busy || !f.login.trim() || !f.key.trim()}
              onClick={() => void run(() => connectionsApi.save("company_odoo", { ...f, url: f.url.trim(), login: f.login.trim(), key: f.key.trim() }))}
              size="sm"
              type="button"
            >
              {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null} Test and connect
            </Button>
          </div>
        </>
      )}
      {error ? <p className="rounded-lg bg-destructive/10 px-3 py-2 text-xs text-destructive">{error}</p> : null}
    </Card>
  );
}

function Rhythm({ org, onChanged }: { org: Org; onChanged: () => void }) {
  const projects = useQuery({ queryKey: ["unlimited", "odoo-projects"], queryFn: () => orgApi.odooProjects(), retry: false });
  const [s, setS] = React.useState(org.settings);
  const [busy, setBusy] = React.useState("");
  const [msg, setMsg] = React.useState("");
  const leads = org.members.filter((m) => m.lead);
  const run = async (what: string, fn: () => Promise<unknown>, ok: string) => {
    setBusy(what);
    setMsg("");
    try {
      await fn();
      setMsg(ok);
      onChanged();
    } catch (e) {
      setMsg(errorText(e));
    } finally {
      setBusy("");
    }
  };
  return (
    <Card className="space-y-3 px-5 py-4">
      <h3 className="text-sm font-semibold text-foreground">Daily plan</h3>
      <div>
        <p className="mb-1 text-xs text-muted-foreground">Projects the team plans from</p>
        <div className="max-h-48 space-y-0.5 overflow-y-auto rounded-lg border border-border/60 p-1.5">
          {projects.isLoading ? <Loader2 className="m-2 h-4 w-4 animate-spin text-muted-foreground" /> : null}
          {projects.isError ? <p className="p-2 text-xs text-destructive">{errorText(projects.error)}</p> : null}
          {projects.data?.map((p) => (
            <label className="flex items-center gap-2 rounded px-1.5 py-1 text-sm hover:bg-muted/50" key={p.id}>
              <input
                checked={s.projects.includes(p.id)}
                onChange={(e) => setS({ ...s, projects: e.target.checked ? [...s.projects, p.id] : s.projects.filter((x) => x !== p.id) })}
                type="checkbox"
              />
              {p.name}
            </label>
          ))}
          {projects.data?.length === 0 ? <p className="p-2 text-xs text-muted-foreground">No projects in Odoo yet.</p> : null}
        </div>
        <p className="mt-1 text-[11px] text-muted-foreground">None picked means every open project.</p>
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        <label className="flex flex-col gap-1 text-xs text-muted-foreground">
          Leads draft at
          <input className={field} onChange={(e) => setS({ ...s, plan_at: e.target.value })} type="time" value={s.plan_at} />
        </label>
        <label className="flex flex-col gap-1 text-xs text-muted-foreground">
          End-of-day report
          <input className={field} onChange={(e) => setS({ ...s, report_at: e.target.value })} type="time" value={s.report_at} />
        </label>
        <label className="flex flex-col gap-1 text-xs text-muted-foreground">
          Move up after (min)
          <input
            className={field}
            max={240}
            min={5}
            onChange={(e) => setS({ ...s, escalate_minutes: Number(e.target.value) || 30 })}
            type="number"
            value={s.escalate_minutes}
          />
        </label>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {DAYS.map((d, i) => {
          const on = s.workdays.includes(i);
          return (
            <button
              aria-pressed={on}
              className={cn(
                "rounded-md border px-2.5 py-1 text-xs font-semibold",
                on ? "border-primary bg-primary text-primary-foreground" : "border-border/70 text-muted-foreground hover:bg-muted",
              )}
              key={d}
              onClick={() => setS({ ...s, workdays: on ? s.workdays.filter((x) => x !== i) : [...s.workdays, i] })}
              type="button"
            >
              {d}
            </button>
          );
        })}
      </div>
      {msg ? <p className="text-xs text-muted-foreground">{msg}</p> : null}
      <div className="flex flex-wrap justify-end gap-2">
        <Button
          className="h-8 text-xs"
          disabled={busy !== "" || !leads.length}
          onClick={() =>
            void run(
              "draft",
              async () => {
                for (const l of leads) await orgApi.draft(l.id);
              },
              "Drafted. It is waiting in Today.",
            )
          }
          size="sm"
          title={leads.length ? undefined : "First pick a lead: set who reports to them in the org chart."}
          type="button"
          variant="outline"
        >
          {busy === "draft" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null} Draft today's plan now
        </Button>
        <Button className="h-8 text-xs" disabled={busy !== ""} onClick={() => void run("save", () => orgApi.settings(s), "Saved")} size="sm" type="button">
          {busy === "save" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null} Save
        </Button>
      </div>
    </Card>
  );
}
