/**
 * Unlimited Agent — the org (who reports to whom, who approves what), Today and the daily plan from the
 * company Odoo. Connector routes /admin/org, /admin/today, /admin/plans (signed like every admin call).
 */
import { request } from "../odoo/api";

export type OrgAction = "plan" | "staging" | "production";
export type OrgPerson = {
  id: string;
  kind: "ai" | "human";
  name: string;
  title?: string;
  department?: string;
  avatar?: string;
  pubkey?: string;
  slug?: string;
  status?: string;
  reports_to?: string | null;
  approves?: OrgAction[];
  capacity?: number;
  hours?: number;
  odoo_user?: string;
  /** The employee has its own Odoo login stored (the password never comes back). */
  odoo_connected?: boolean;
  owner?: boolean;
  lead?: boolean;
  reports?: string[];
  approvers?: Record<OrgAction, string>;
  /** Department id (see Org.departments). */
  dept?: string;
  /** Approvers chosen for this person, per action; anything missing follows the reporting line. */
  approver_set?: Partial<Record<OrgAction, string>>;
};
export type Department = { id: string; name: string; head: string; parent: string };
export type OrgSettings = {
  tz: string;
  plan_at: string;
  report_at: string;
  escalate_minutes: number;
  workdays: number[];
  projects: number[];
};
export type OdooLink = { kind: "company_odoo"; state: "connected" | "off" | "attention"; detail: string; url?: string; checked_at?: string };
export type Org = { members: OrgPerson[]; settings: OrgSettings; odoo: OdooLink; departments?: Department[] };

export type PlanTask = {
  id: number;
  name: string;
  ref: string;
  project: string;
  stage: string;
  status: "open" | "done" | "blocked";
  hours: number;
  spent: number;
  url: string;
  deadline?: string | null;
};
export type PlanRow = {
  member: OrgPerson;
  tasks: PlanTask[];
  done: number;
  total: number;
  blocked: number;
  now: string | null;
  hours: number;
  spent: number;
};
export type PlanStatus = "pending" | "approved" | "rejected";
export type TeamDay = {
  plan: string;
  status: PlanStatus;
  lead: OrgPerson | null;
  approver: OrgPerson | null;
  decided_by: OrgPerson | null;
  decided_at?: string | null;
  members: PlanRow[];
  notes: string[];
};
export type PlanAsk = { kind: "plan"; id: string; lead: OrgPerson; tasks: number; people: number; since: string };
export type Today = {
  date: string;
  tz: string;
  me: OrgPerson;
  odoo: boolean;
  has_teams: boolean;
  settings: OrgSettings;
  summary: { tasks: number; done: number; blocked: number; open: number; percent: number };
  needs_you: PlanAsk[];
  teams: TeamDay[];
};
export type PlanDetail = {
  id: string;
  date: string;
  lead: string;
  status: PlanStatus;
  approver: string;
  created_at: string;
  notes?: string[];
  rows: PlanRow[];
  lead_member: OrgPerson;
  approver_member: OrgPerson;
  team: OrgPerson[];
};
export type MemberDay = {
  member: OrgPerson;
  manager: OrgPerson | null;
  reports: OrgPerson[];
  approvers: Partial<Record<OrgAction | "drafted_by", OrgPerson | null>>;
  date: string;
  plan_status: PlanStatus | null;
  tasks: PlanTask[];
  done: number;
  hours: number;
  spent: number;
};

const enc = encodeURIComponent;

export const orgApi = {
  org: () => request<Org>("GET", "/admin/org"),
  today: () => request<Today>("GET", "/admin/today"),
  memberDay: (id: string) => request<MemberDay>("GET", `/admin/org/members/${enc(id)}/day`),
  plan: (id: string) => request<PlanDetail>("GET", `/admin/plans/${enc(id)}`),
  decide: (id: string, approve: boolean, note = "", moves: { task: number; to: string }[] = []) =>
    request<PlanDetail>("POST", `/admin/plans/${enc(id)}/decide`, { decision: approve ? "approve" : "reject", note, moves }),
  draft: (lead: string, again = false) => request<PlanDetail>("POST", "/admin/plans", { lead, again }),
  updateMember: (id: string, fields: Omit<Partial<OrgPerson>, "approvers"> & { approvers?: Partial<Record<OrgAction, string>> }) => request<Org>("POST", `/admin/org/members/${enc(id)}`, fields),
  removeMember: (id: string) => request<Org>("POST", `/admin/org/members/${enc(id)}`, { action: "remove" }),
  addPerson: (fields: { pubkey: string; name: string; title?: string; reports_to?: string; approves?: OrgAction[] }) =>
    request<Org>("POST", "/admin/org/humans", fields),
  settings: (fields: Partial<OrgSettings>) => request<Org>("POST", "/admin/org/settings", fields),
  /** The employee's own Odoo user: {} reads the status, {login, key} saves it, {action: "remove"} clears it. */
  memberOdoo: (id: string, body: { login?: string; key?: string; action?: "remove" } = {}) =>
    request<{ login: string; connected: boolean; checked_at?: string }>("POST", `/admin/org/members/${enc(id)}/odoo`, body),
  /** Create or change a department; apply=true redraws the reporting lines from the departments. */
  department: (body: Partial<Department> & { members?: string[]; apply?: boolean; action?: "remove" }) =>
    request<Org>("POST", "/admin/org/departments", body),
  /** Upload a photo (data URL of a JPG, PNG or WebP under 2 MB). */
  photo: (id: string, dataUrl: string) => request<Org>("POST", `/admin/org/members/${enc(id)}/photo`, { data: dataUrl }),
  odooProjects: () => request<{ id: number; name: string }[]>("GET", "/admin/org/odoo-projects"),
};

export const ACTION_LABEL: Record<OrgAction, string> = {
  plan: "Daily plans",
  staging: "Code to staging",
  production: "Anything to production",
};

export function firstName(p?: { name?: string } | null): string {
  return (p?.name ?? "").trim().split(/\s+/)[0] || "";
}

export function below(org: Org, id: string): OrgPerson[] {
  const out: OrgPerson[] = [];
  for (const p of org.members) {
    if (p.reports_to === id) out.push(p, ...below(org, p.id));
  }
  return out;
}

export function rowFor(today: Today | undefined, id: string): PlanRow | undefined {
  for (const t of today?.teams ?? []) {
    const r = t.members.find((m) => m.member.id === id);
    if (r) return r;
  }
  return undefined;
}
