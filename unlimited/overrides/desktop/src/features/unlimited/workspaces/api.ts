/**
 * Unlimited Agent — control-plane client: workspaces (tenants), members, invites, plans and status.
 * Same owner-signed transport as the rest of the admin API; the browser design preview gets demo data.
 */
import { isDemo, request } from "@/features/unlimited/odoo/api";

export type WorkspaceStatus = "trial" | "active" | "past_due" | "suspended" | "archived";
export type WorkspaceRole = "owner" | "admin" | "member" | "viewer";

export type Plan = { id: string; name: string; seats: number; employees: number; monthly_tokens: number; price_month: number; currency: string };
export type Workspace = {
  id: string;
  slug: string;
  name: string;
  host: string;
  status: WorkspaceStatus;
  plan_id: string;
  plan_name?: string;
  cell_name?: string;
  is_home: number;
  created_at: number;
  status_changed_at: number;
  members: number;
  invites_open: number;
};
export type Member = { pubkey: string; display_name: string; email: string; role: WorkspaceRole; status: "active" | "removed"; joined_at: number };
export type Invite = { id: string; email: string; role: WorkspaceRole; code_hint: string; expires_at: number; max_uses: number; created_at: number; revoked_at: number | null };
export type AuditRow = { ts: number; actor: string; action: string; target: string; details: string };
export type WorkspaceDetail = Omit<Workspace, "members"> & { members: Member[]; invites: Invite[]; audit: AuditRow[]; transitions: WorkspaceStatus[] };
export type NewInvite = { id: string; url: string; expires_at: number; max_uses: number; role: WorkspaceRole };

const enc = encodeURIComponent;

export const workspacesApi = {
  list: () => (isDemo() ? demoList() : request<{ workspaces: Workspace[]; plans: Plan[] }>("GET", "/admin/workspaces")),
  get: (ref: string, sync = false) =>
    isDemo() ? demoGet(ref) : request<WorkspaceDetail>("GET", `/admin/workspaces/${enc(ref)}${sync ? "?sync=1" : ""}`),
  create: (input: { name: string; slug: string; plan: string; admin_pubkey?: string; trial?: boolean }) =>
    isDemo() ? demoCreate(input) : request<{ id: string; slug: string; host: string; status: WorkspaceStatus; note: string }>("POST", "/admin/workspaces", input),
  setStatus: (ref: string, status: WorkspaceStatus, reason: string) =>
    isDemo() ? demoStatus(ref, status) : request<{ status: WorkspaceStatus }>("POST", `/admin/workspaces/${enc(ref)}/status`, { status, reason }),
  setPlan: (ref: string, plan: string) =>
    isDemo() ? demoPlan(ref, plan) : request<{ plan: string }>("POST", `/admin/workspaces/${enc(ref)}/plan`, { plan }),
  invite: (ref: string, input: { email: string; role: WorkspaceRole; days: number; max_uses: number }) =>
    isDemo() ? demoInvite(ref, input) : request<NewInvite>("POST", `/admin/workspaces/${enc(ref)}/invites`, input),
  revokeInvite: (ref: string, id: string) =>
    isDemo() ? demoRevoke(ref, id) : request<{ revoked: boolean }>("POST", `/admin/workspaces/${enc(ref)}/invites/${enc(id)}/revoke`, {}),
  member: (ref: string, pubkey: string, input: { do: "remove" } | { do: "role"; role: WorkspaceRole }) =>
    isDemo() ? demoMember(ref, pubkey, input) : request<unknown>("POST", `/admin/workspaces/${enc(ref)}/members/${enc(pubkey)}`, input),
};

// ------------------------------------------------------------------ demo data (preview only)
const now = () => Math.floor(Date.now() / 1000);
const DAY = 86400;
const PLANS: Plan[] = [
  { id: "starter", name: "Starter", seats: 5, employees: 2, monthly_tokens: 20_000_000, price_month: 0, currency: "USD" },
  { id: "team", name: "Team", seats: 15, employees: 5, monthly_tokens: 80_000_000, price_month: 0, currency: "USD" },
  { id: "enterprise", name: "Enterprise", seats: 100, employees: 20, monthly_tokens: 500_000_000, price_month: 0, currency: "USD" },
];
const TRANSITIONS: Record<WorkspaceStatus, WorkspaceStatus[]> = {
  trial: ["active", "archived", "suspended"],
  active: ["archived", "past_due", "suspended"],
  past_due: ["active", "archived", "suspended"],
  suspended: ["active", "archived"],
  archived: ["active"],
};
const pk = (c: string) => c.repeat(64);
const demo: Record<string, WorkspaceDetail> = {
  "unlimited-solutions": {
    id: "w1", slug: "unlimited-solutions", name: "Unlimited Solutions", host: "app.unlimitedsolutions.technology",
    status: "active", plan_id: "enterprise", plan_name: "Enterprise", cell_name: "Cell 1 (Contabo EU)", is_home: 1,
    created_at: now() - 60 * DAY, status_changed_at: now() - 60 * DAY, invites_open: 1, transitions: [],
    members: [
      { pubkey: pk("a"), display_name: "Mostafa Gabr", email: "", role: "owner", status: "active", joined_at: now() - 60 * DAY },
      { pubkey: pk("b"), display_name: "Youssef", email: "youssef@unlimitedsolutions.technology", role: "admin", status: "active", joined_at: now() - 20 * DAY },
      { pubkey: pk("c"), display_name: "Fahd", email: "fahd@unlimitedsolutions.technology", role: "member", status: "active", joined_at: now() - 9 * DAY },
    ],
    invites: [{ id: "i1", email: "sara@unlimitedsolutions.technology", role: "member", code_hint: "k2Q9xa", expires_at: now() + 5 * DAY, max_uses: 1, created_at: now() - 2 * DAY, revoked_at: null }],
    audit: [
      { ts: now() - 2 * DAY, actor: "owner", action: "invite.created", target: "sara@unlimitedsolutions.technology", details: "{}" },
      { ts: now() - 9 * DAY, actor: "system", action: "member.joined", target: "Fahd", details: "{}" },
    ],
  },
  "acme-trading": {
    id: "w2", slug: "acme-trading", name: "Acme Trading", host: "acme-trading.unlimitedsolutions.technology",
    status: "trial", plan_id: "team", plan_name: "Team", cell_name: "Cell 1 (Contabo EU)", is_home: 0,
    created_at: now() - 6 * DAY, status_changed_at: now() - 6 * DAY, invites_open: 0, transitions: TRANSITIONS.trial,
    members: [{ pubkey: pk("d"), display_name: "Omar (Acme)", email: "omar@acme.example", role: "admin", status: "active", joined_at: now() - 6 * DAY }],
    invites: [],
    audit: [{ ts: now() - 6 * DAY, actor: "owner", action: "workspace.created", target: "acme-trading.unlimitedsolutions.technology", details: "{}" }],
  },
  "nile-foods": {
    id: "w3", slug: "nile-foods", name: "Nile Foods", host: "nile-foods.unlimitedsolutions.technology",
    status: "suspended", plan_id: "starter", plan_name: "Starter", cell_name: "Cell 1 (Contabo EU)", is_home: 0,
    created_at: now() - 40 * DAY, status_changed_at: now() - 3 * DAY, invites_open: 0, transitions: TRANSITIONS.suspended,
    members: [{ pubkey: pk("e"), display_name: "Hana", email: "hana@nilefoods.example", role: "admin", status: "active", joined_at: now() - 40 * DAY }],
    invites: [],
    audit: [{ ts: now() - 3 * DAY, actor: "owner", action: "workspace.status_changed", target: "suspended", details: '{"reason":"Invoice unpaid"}' }],
  },
};
const summary = (w: WorkspaceDetail): Workspace => ({
  ...w,
  members: w.members.filter((m) => m.status === "active").length,
  invites_open: w.invites.filter((i) => !i.revoked_at && i.expires_at > now()).length,
});
const later = <T,>(v: T) => new Promise<T>((r) => setTimeout(() => r(structuredClone(v)), 250));
const log = (w: WorkspaceDetail, action: string, target: string) => w.audit.unshift({ ts: now(), actor: "owner", action, target, details: "{}" });
const demoList = () => later({ workspaces: Object.values(demo).map(summary), plans: PLANS });
const demoGet = (ref: string) => later(demo[ref] ?? Object.values(demo).find((w) => w.id === ref)!);
function demoCreate(i: { name: string; slug: string; plan: string }) {
  const host = `${i.slug}.unlimitedsolutions.technology`;
  demo[i.slug] = {
    id: i.slug, slug: i.slug, name: i.name || i.slug, host, status: "trial", plan_id: i.plan,
    plan_name: PLANS.find((p) => p.id === i.plan)?.name, cell_name: "Cell 1 (Contabo EU)", is_home: 0,
    created_at: now(), status_changed_at: now(), invites_open: 0, transitions: TRANSITIONS.trial, members: [], invites: [], audit: [],
  };
  log(demo[i.slug], "workspace.created", host);
  return later({ id: i.slug, slug: i.slug, host, status: "trial" as WorkspaceStatus, note: "" });
}
function demoStatus(ref: string, status: WorkspaceStatus) {
  const w = demo[ref];
  log(w, "workspace.status_changed", status);
  Object.assign(w, { status, status_changed_at: now(), transitions: TRANSITIONS[status] });
  return later({ status });
}
function demoPlan(ref: string, plan: string) {
  Object.assign(demo[ref], { plan_id: plan, plan_name: PLANS.find((p) => p.id === plan)?.name });
  log(demo[ref], "workspace.plan_changed", plan);
  return later({ plan });
}
function demoInvite(ref: string, i: { email: string; role: WorkspaceRole; days: number; max_uses: number }) {
  const code = Math.random().toString(36).slice(2, 12);
  const inv: Invite = { id: code, email: i.email, role: i.role, code_hint: code.slice(-6), expires_at: now() + i.days * DAY, max_uses: i.max_uses, created_at: now(), revoked_at: null };
  demo[ref].invites.unshift(inv);
  log(demo[ref], "invite.created", i.email || inv.id);
  return later<NewInvite>({ id: inv.id, url: `https://${demo[ref].host}/invite/${code}`, expires_at: inv.expires_at, max_uses: i.max_uses, role: i.role });
}
function demoRevoke(ref: string, id: string) {
  const inv = demo[ref].invites.find((x) => x.id === id);
  if (inv) inv.revoked_at = now();
  log(demo[ref], "invite.revoked", id);
  return later({ revoked: true });
}
function demoMember(ref: string, pubkey: string, input: { do: "remove" } | { do: "role"; role: WorkspaceRole }) {
  const m = demo[ref].members.find((x) => x.pubkey === pubkey);
  if (m && input.do === "remove") m.status = "removed";
  if (m && input.do === "role") m.role = input.role;
  log(demo[ref], input.do === "remove" ? "member.removed" : "member.role_changed", m?.display_name ?? pubkey);
  return later({});
}
