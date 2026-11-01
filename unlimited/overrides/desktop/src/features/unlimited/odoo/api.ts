/**
 * Unlimited Agent — client for the Odoo connector admin API.
 *
 * Every request is signed with the workspace key the app already holds (NIP-98,
 * kind 27235, bound to URL + method + body hash). No password or token is typed.
 * In the browser design preview (window.__BUZZ_E2E__) it serves demo data instead.
 */
import { signRelayEvent } from "@/shared/api/tauri";

export const UNLIMITED_API = "https://app.unlimitedsolutions.technology/unlimited-api";

export type OdooProject = {
  id: string;
  name: string;
  repo: string;
  branch: string;
  odoosh_project: string;
  odoo_version: string;
  buzz_project: string;
  locked_branches: string[];
  agent_login: string;
  agents: string[];
};
export type OdooShProject = { name: string; repo: string; version: string; connected_as: string | null };
export type OdooShBranch = { id: number; name: string; stage: string; locked: boolean; build_state: string };
export type CheckStep = { key: string; ok: boolean; detail: unknown };
export type Approval = { id: string; ts: string; agent: string; project: string; tool: string; args: string; reason: string };
export type ActivityEvent = { seq: number; ts: string; agent: string; project: string; tool: string; outcome: string; detail: string };
export type SessionStatus = { ok?: boolean; expired?: boolean; checked_at?: string; error?: string };
export type ProjectStatus = {
  project: OdooProject;
  build: { key: string; ok: boolean; detail: { build_id?: string; state?: string; url?: string } | string };
  approvals: Approval[];
  activity: ActivityEvent[];
  session: SessionStatus;
};
export type Overview = { projects: OdooProject[]; session: SessionStatus; approvals: number; agents: string[] };
export type HealthReport = { score?: number; checks?: { name: string; status: string; detail: string }[] };

export type OutboxItem = {
  id: string; ts: string; agent: string; mailbox: string; from: string; to: string[]; cc: string[];
  subject: string; body: string; attachments: string[]; reply: boolean;
};

export class ApiError extends Error {
  constructor(message: string, readonly status: number, readonly sessionExpired = false) {
    super(message);
  }
}

const isDemo = () => typeof window !== "undefined" && Boolean((window as { __BUZZ_E2E__?: unknown }).__BUZZ_E2E__);

function b64(text: string): string {
  const bytes = new TextEncoder().encode(text);
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin);
}

async function sha256Hex(text: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
}

async function request<T>(method: "GET" | "POST", path: string, body?: unknown): Promise<T> {
  if (isDemo()) return demo<T>(method, path, body);
  const url = UNLIMITED_API + path;
  const payload = body === undefined ? "" : JSON.stringify(body);
  const tags = [["u", url], ["method", method]];
  if (payload) tags.push(["payload", await sha256Hex(payload)]);
  const ev = await signRelayEvent({ kind: 27235, content: "", tags });
  const { id, pubkey, created_at, kind, content, sig } = ev;
  const auth = "Nostr " + b64(JSON.stringify({ id, pubkey, created_at, kind, tags: ev.tags, content, sig }));
  const res = await fetch(url, {
    method,
    headers: { authorization: auth, ...(payload ? { "content-type": "application/json" } : {}) },
    body: payload || undefined,
  });
  const data = (await res.json().catch(() => ({}))) as { ok?: boolean; result?: T; error?: string; session_expired?: boolean };
  if (!res.ok || !data.ok) {
    throw new ApiError(data.error || `Request failed (${res.status})`, res.status, Boolean(data.session_expired));
  }
  return data.result as T;
}

export const odooApi = {
  overview: () => request<Overview>("GET", "/admin/overview"),
  odooShProjects: () => request<OdooShProject[]>("GET", "/admin/odoosh/projects"),
  branches: (project: string) =>
    request<OdooShBranch[]>("GET", `/admin/odoosh/branches?project=${encodeURIComponent(project)}`),
  byBuzz: (buzzId: string) => request<OdooProject | null>("GET", `/admin/projects/by-buzz/${encodeURIComponent(buzzId)}`),
  save: (input: { buzz_project: string; name: string; odoosh_project: string; branch: string; agents: string[] }) =>
    request<OdooProject>("POST", "/admin/projects", input),
  check: (pid: string) => request<{ ok: boolean; steps: CheckStep[] }>("POST", `/admin/projects/${pid}/check`, {}),
  status: (pid: string) => request<ProjectStatus>("GET", `/admin/projects/${pid}/status`),
  health: (pid: string) => request<HealthReport>("POST", `/admin/projects/${pid}/health`, {}),
  outbox: () => request<OutboxItem[]>("GET", "/admin/outbox"),
  serverAgents: () => request<{ name: string; pubkey: string }[]>("GET", "/admin/server-agents"),
  taskStages: (buzzId: string) =>
    request<import("@/features/unlimited/tasks/taskDesk").TaskStages>(
      "GET",
      `/admin/tasks/by-buzz/${encodeURIComponent(buzzId)}`,
    ),
  decideEmail: (aid: string, decision: "approve" | "reject", edits?: { subject?: string; body?: string }) =>
    request<{ sent?: boolean }>("POST", `/admin/outbox/${aid}`, { decision, ...(edits ? { edits } : {}) }),
  decide: (aid: string, decision: "approve" | "reject") =>
    request<{ id: string }>("POST", `/admin/approvals/${aid}`, { decision }),
};

// ------------------------------------------------------------------ demo data (preview only)
const demoState: { projects: Record<string, OdooProject>; approvals: Approval[] } = {
  projects: {},
  approvals: [
    {
      id: "a1b2c3", ts: new Date().toISOString(), agent: "developer", project: "diraty-odoo", tool: "odoo_call",
      args: '{"model": "sale.order.line", "method": "unlink", "args": [[412, 413]]}',
      reason: "Delete 2 lines from sale order S00412",
    },
  ],
};
let demoOutbox: OutboxItem[] = [
  {
    id: "m1", ts: new Date().toISOString(), agent: "sales", mailbox: "sales", from: "sales@unlimitedsolutions.technology",
    to: ["it@client-example.com"], cc: [], subject: "عرض تطوير Odoo — متابعة اجتماع أمس",
    body: "أهلاً أستاذ أحمد،\n\nشكراً على وقتك أمس. مرفق العرض الفني والمالي لتطوير موديول المخازن كما اتفقنا.\n\nتحياتي،\nفريق Unlimited Solutions",
    attachments: ["offer.pdf"], reply: true,
  },
];
const DEMO_PROJECTS: OdooShProject[] = [
  { name: "diraty-odoo", repo: "ma44588/diraty", version: "18.0", connected_as: null },
  { name: "alfares-int", repo: "ma44588/Alfares", version: "19.0", connected_as: null },
  { name: "rtsc", repo: "unlimited/rtsc", version: "18.0", connected_as: null },
  { name: "tetra-pharma", repo: "unlimited/tetra-pharma", version: "17.0", connected_as: null },
];
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));
const minsAgo = (m: number) => new Date(Date.now() - m * 60000).toISOString();

/** Preview only: stages are spread over the demo tasks by id (see stageFor in taskDesk.ts). */
function demoTaskStages() {
  return { enabled: true, demo: true, developer: "", documentation: "", stages: {} };
}

async function demo<T>(method: string, path: string, body?: unknown): Promise<T> {
  await wait(350);
  const pick = (p: string) => Object.values(demoState.projects).find((x) => x.id === p);
  let m: RegExpMatchArray | null;
  if (path === "/admin/overview")
    return { projects: Object.values(demoState.projects), session: { ok: true, checked_at: minsAgo(12) },
      approvals: demoState.approvals.length, agents: ["developer", "documentation"] } as T;
  if (path === "/admin/odoosh/projects") return DEMO_PROJECTS as T;
  if (path.startsWith("/admin/odoosh/branches"))
    return [
      { id: 1, name: "production", stage: "production", locked: true, build_state: "success" },
      { id: 2, name: "stag", stage: "staging", locked: false, build_state: "success" },
      { id: 3, name: "dev-barcode", stage: "dev", locked: false, build_state: "success" },
    ] as T;
  if ((m = path.match(/^\/admin\/projects\/by-buzz\/(.+)$/)))
    return (demoState.projects[decodeURIComponent(m[1])] ?? null) as T;
  if (path.startsWith("/admin/tasks/by-buzz/")) return demoTaskStages() as T;
  if (path === "/admin/projects" && method === "POST") {
    const d = body as { buzz_project: string; name: string; odoosh_project: string; branch: string; agents: string[] };
    const src = DEMO_PROJECTS.find((p) => p.name === d.odoosh_project);
    const p: OdooProject = { id: d.odoosh_project, name: d.name, repo: src?.repo ?? "", branch: d.branch,
      odoosh_project: d.odoosh_project, odoo_version: src?.version ?? "", buzz_project: d.buzz_project,
      locked_branches: ["production"], agent_login: "unlimited_agent", agents: d.agents };
    demoState.projects[d.buzz_project] = p;
    return p as T;
  }
  if ((m = path.match(/^\/admin\/projects\/([^/]+)\/check$/))) {
    await wait(1200);
    return { ok: true, steps: [
      { key: "build", ok: true, detail: "40960206" }, { key: "ssh", ok: true, detail: "ok" },
      { key: "agent", ok: true, detail: "unlimited_agent" }, { key: "version", ok: true, detail: "18.0+e" },
    ] } as T;
  }
  if ((m = path.match(/^\/admin\/projects\/([^/]+)\/status$/))) {
    const p = pick(m[1]);
    return { project: p, session: { ok: true, checked_at: minsAgo(12) },
      build: { key: "build", ok: true, detail: { build_id: "40960206", state: "success", url: "https://diraty-odoo-stag-40960206.dev.odoo.com" } },
      approvals: demoState.approvals,
      activity: [
        { seq: 4, ts: minsAgo(1), agent: "documentation", project: m[1], tool: "odoo_search_read", outcome: "ok", detail: "" },
        { seq: 3, ts: minsAgo(16), agent: "developer", project: m[1], tool: "build_wait", outcome: "ok", detail: "" },
        { seq: 2, ts: minsAgo(31), agent: "developer", project: m[1], tool: "repo_commit_push", outcome: "ok", detail: "" },
        { seq: 1, ts: minsAgo(38), agent: "developer", project: m[1], tool: "odoo_fields", outcome: "ok", detail: "" },
      ] } as T;
  }
  if ((m = path.match(/^\/admin\/projects\/([^/]+)\/health$/))) {
    await wait(900);
    return { score: 90, checks: [
      { name: "version", status: "ok", detail: "Odoo 18.0+e" },
      { name: "scheduled_actions", status: "ok", detail: "All scheduled actions ran this week" },
      { name: "outgoing_mail", status: "warn", detail: "3 emails failed to send" },
    ] } as T;
  }
  if (path === "/admin/outbox") return demoOutbox as T;
  if (path === "/admin/server-agents")
    return [{ name: "Developer", pubkey: "e".repeat(64) }, { name: "Documentation", pubkey: "d".repeat(64) }] as T;
  if ((m = path.match(/^\/admin\/outbox\/(.+)$/))) {
    demoOutbox = demoOutbox.filter((x) => x.id !== m![1]);
    return { sent: (body as { decision: string }).decision === "approve" } as T;
  }
  if ((m = path.match(/^\/admin\/approvals\/(.+)$/))) {
    demoState.approvals = demoState.approvals.filter((a) => a.id !== m![1]);
    return { id: m[1] } as T;
  }
  throw new ApiError("Not found", 404);
}
