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

export type ServerModel = "opus" | "sonnet" | "haiku";
export type ServerRespondTo = "owner-only" | "allowlist" | "anyone";
export type ServerMcpServer = { name: string; url: string; headers: Record<string, string> };

export type ServerEmployee = {
  slug: string;
  name: string;
  role: string;
  about?: string;
  avatar?: string;
  pubkey: string;
  builtin: boolean;
  projects: string[];
  model: ServerModel;
  thinking: number;
  respond_to?: ServerRespondTo;
  allow?: string[];
  status: string;
};
export type ServerEmployeeDetails = ServerEmployee & {
  instructions: string;
  skills: string[];
  skills_available: string[];
  memory: { file: string; size: number; updated: number; preview: string }[];
  projects_available: string[];
  env: Record<string, string>;
  mcp: ServerMcpServer[];
};
export type ServerEmployeeInput = {
  name: string;
  role: string;
  about: string;
  avatar: string;
  instructions: string;
  model: ServerModel;
  thinking: number;
  skills: string[];
  projects: string[];
  respond_to: ServerRespondTo;
  allow: string[];
  env: Record<string, string>;
  mcp: ServerMcpServer[];
};

export type AgentFile = { name: string; size: number; updated: number; mime: string };
export type AgentFileContent = { name: string; size: number; mime: string; data: string };
export type EmployeeUsage = {
  slug: string;
  name: string;
  pubkey: string;
  total: { input: number; output: number; cache_read: number; cache_write: number; turns: number };
  days: { date: string; tokens: number; turns: number }[];
};

export type UsageStep = {
  stage: string;
  start: number;
  end: number | null;
  seconds: number;
  worker: "developer" | "documentation" | "owner";
  employee: string;
  slug: string;
  tokens?: { input: number; output: number; cache_read: number; cache_write: number; turns: number };
};
export type UsageOverview = {
  now: number;
  days: number;
  projects: { id: string; buzz_id: string; name: string }[];
  tasks: { id: string; title: string; project: string; stage: string; created_at: number; last: number; steps: UsageStep[] }[];
  employees: (EmployeeUsage & { avatar?: string })[];
};

export class ApiError extends Error {
  constructor(message: string, readonly status: number, readonly sessionExpired = false) {
    super(message);
  }
}

export const isDemo = () => typeof window !== "undefined" && Boolean((window as { __BUZZ_E2E__?: unknown }).__BUZZ_E2E__);

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

export async function request<T>(method: "GET" | "POST", path: string, body?: unknown): Promise<T> {
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

export type CicdooStatus = { connected: boolean; tools?: string[]; error?: string };

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
  usageOverview: (days = 30) => request<UsageOverview>("GET", `/admin/usage/overview?days=${days}`),
  agentFiles: () => request<AgentFile[]>("GET", "/admin/agent-files"),
  agentFile: (name: string) => request<AgentFileContent>("GET", `/admin/agent-files/${encodeURIComponent(name)}`),
  employeeUsage: (days = 30) => request<{ days: number; employees: EmployeeUsage[] }>("GET", `/admin/usage/employees?days=${days}`),
  serverAgents: () => request<ServerEmployee[]>("GET", "/admin/server-agents"),
  serverAgent: (slug: string) => request<ServerEmployeeDetails>("GET", `/admin/server-agents/${encodeURIComponent(slug)}`),
  createServerAgent: (input: ServerEmployeeInput) => request<{ slug: string }>("POST", "/admin/server-agents", input),
  updateServerAgent: (slug: string, input: Partial<ServerEmployeeInput>) =>
    request<{ slug: string }>("POST", `/admin/server-agents/${encodeURIComponent(slug)}`, input),
  serverAgentAction: (slug: string, input: { do: "start" | "stop" | "restart" | "delete" | "memory_delete"; file?: string }) =>
    request<{ slug: string }>("POST", `/admin/server-agents/${encodeURIComponent(slug)}/action`, input),
  taskStages: (buzzId: string) =>
    request<import("@/features/unlimited/tasks/taskDesk").TaskStages>(
      "GET",
      `/admin/tasks/by-buzz/${encodeURIComponent(buzzId)}`,
    ),
  decideEmail: (aid: string, decision: "approve" | "reject", edits?: { subject?: string; body?: string }) =>
    request<{ sent?: boolean }>("POST", `/admin/outbox/${aid}`, { decision, ...(edits ? { edits } : {}) }),
  cicdooStatus: () => request<CicdooStatus>("GET", "/admin/providers/cicdoo"),
  cicdooConnect: (token: string) => request<{ connected: boolean; tools?: number }>("POST", "/admin/providers/cicdoo", { token }),
  cicdooDisconnect: () => request<{ connected: boolean }>("POST", "/admin/providers/cicdoo", { disconnect: true }),
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
const DEMO_EMPLOYEES: ServerEmployee[] = [
  { slug: "developer", name: "Developer", role: "Odoo developer: analysis, building on stag, build and test follow-up",
    about: "Odoo developer on the Unlimited server", avatar: "", pubkey: "e".repeat(64), builtin: true, projects: ["*"],
    model: "opus", thinking: 12000, respond_to: "owner-only", allow: [], status: "running" },
  { slug: "documentation", name: "Documentation", role: "Documentation: team summaries and user guides",
    about: "", avatar: "", pubkey: "d".repeat(64), builtin: true, projects: ["*"],
    model: "opus", thinking: 12000, respond_to: "owner-only", allow: [], status: "running" },
];

const DEMO_FILES: AgentFile[] = [
  { name: "POS_DARK_MODE_GUIDE.md", size: 4547, updated: Math.floor(Date.now() / 1000) - 5400, mime: "text/markdown" },
  { name: "DIRATY_CUSTOM_MODULES.pdf", size: 253303, updated: Math.floor(Date.now() / 1000) - 86400, mime: "application/pdf" },
];

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
  if (path.startsWith("/admin/usage/overview")) {
    const now = Math.floor(Date.now() / 1000);
    const t = (i: number, o: number) => ({ input: i, output: o, cache_read: i * 140, cache_write: i * 16, turns: 10 });
    const mk = (id: string, title: string, stage: string, ago: number, toks: number) => ({
      id, title, project: "diraty", stage, created_at: now - ago - 3600, last: now - ago,
      steps: [
        { stage: "planning", start: now - ago - 1500, end: now - ago - 1320, seconds: 180, worker: "developer", employee: "Developer", slug: "developer", tokens: t(toks * 0.15, 6400) },
        { stage: "awaiting_approval", start: now - ago - 1320, end: now - ago - 1200, seconds: 120, worker: "owner", employee: "", slug: "" },
        { stage: "executing", start: now - ago - 1200, end: now - ago - 660, seconds: 540, worker: "developer", employee: "Developer", slug: "developer", tokens: t(toks * 0.8, 21800) },
        { stage: "in_review", start: now - ago - 660, end: now - ago - 240, seconds: 420, worker: "owner", employee: "", slug: "" },
        { stage: "documenting", start: now - ago - 240, end: now - ago - 223, seconds: 17, worker: "documentation", employee: "Documentation", slug: "documentation", tokens: t(toks * 0.05, 1200) },
        { stage: "documented", start: now - ago - 223, end: null, seconds: 0, worker: "owner", employee: "", slug: "" },
      ],
    });
    const day = (d: number) => new Date(Date.now() - d * 86400000).toISOString().slice(0, 10);
    return {
      now, days: 30,
      projects: [{ id: "diraty", buzz_id: "x:dirty-odoo-sh", name: "Dirty-odoo.sh" }, { id: "alfares", buzz_id: "y:alfares", name: "Alfares" }],
      tasks: [mk("42f10c91aa", "Dark mode for Point of Sale (POS)", "documented", 7200, 8000),
              mk("51ab22cc01", "Carton barcode on delivery slip", "executing", 1800, 6000),
              { ...mk("77de90aa02", "Fix VAT rounding on POS refunds", "awaiting_approval", 600, 1500), project: "alfares" }],
      employees: [
        { slug: "developer", name: "Developer", pubkey: "e".repeat(64), total: { input: 3200, output: 28200, cache_read: 1492000, cache_write: 165000, turns: 64 },
          days: [{ date: day(6), tokens: 300000, turns: 9 }, { date: day(4), tokens: 420000, turns: 18 }, { date: day(2), tokens: 610000, turns: 22 }, { date: day(0), tokens: 658000, turns: 24 }] },
        { slug: "documentation", name: "Documentation", pubkey: "d".repeat(64), total: { input: 400, output: 5100, cache_read: 212000, cache_write: 26000, turns: 9 },
          days: [{ date: day(2), tokens: 90000, turns: 3 }, { date: day(0), tokens: 153500, turns: 6 }] },
      ],
    } as T;
  }
  if (path === "/admin/agent-files") return DEMO_FILES as T;
  if ((m = path.match(/^\/admin\/agent-files\/(.+)$/))) {
    const md = "# POS Dark Mode — user guide\n\n1. Open **Point of Sale**.\n2. Press the 🌙 button in the top bar.\n\n| Screen | Mode |\n|---|---|\n| Products | Dark |";
    return { name: decodeURIComponent(m[1]), size: md.length, mime: "text/markdown", data: btoa(unescape(encodeURIComponent(md))) } as T;
  }
  if (path.startsWith("/admin/usage/employees")) {
    const day = (d: number) => new Date(Date.now() - d * 86400000).toISOString().slice(0, 10);
    return { days: 30, employees: [
      { slug: "developer", name: "Developer", pubkey: "e".repeat(64), total: { input: 3200, output: 28200, cache_read: 1492000, cache_write: 165000, turns: 64 },
        days: [{ date: day(2), tokens: 610000, turns: 22 }, { date: day(1), tokens: 420000, turns: 18 }, { date: day(0), tokens: 658000, turns: 24 }] },
      { slug: "documentation", name: "Documentation", pubkey: "d".repeat(64), total: { input: 400, output: 5100, cache_read: 212000, cache_write: 26000, turns: 9 },
        days: [{ date: day(0), tokens: 243500, turns: 9 }] },
    ] } as T;
  }
  if (path === "/admin/server-agents" && method === "GET") return DEMO_EMPLOYEES as T;
  if ((m = path.match(/^\/admin\/server-agents\/([a-z0-9-]+)$/)) && method === "GET") {
    const row = DEMO_EMPLOYEES.find((e) => e.slug === m![1]) ?? DEMO_EMPLOYEES[0];
    return {
      ...row,
      instructions: `You are the ${row.name} of Unlimited Solutions, an Odoo partner.\n\nWork loop for every task: understand, plan, code on stag, test on staging, report.`,
      skills: row.slug === "developer" ? ["odoo-module-development", "odoo-sh-delivery"] : ["odoo-user-guide"],
      skills_available: ["odoo-module-development", "odoo-sh-delivery", "odoo-user-guide"],
      memory: [{ file: "MEMORY.md", size: 2140, updated: Math.floor(Date.now() / 1000) - 3600, preview: "# Lessons\n- Always bump the manifest version." }],
      projects_available: ["diraty"],
      env: { ODOO_DEFAULT_LANG: "ar_001" },
      mcp: [],
    } as T;
  }
  if (path.startsWith("/admin/server-agents")) return { slug: "demo" } as T;
  if ((m = path.match(/^\/admin\/outbox\/(.+)$/))) {
    demoOutbox = demoOutbox.filter((x) => x.id !== m![1]);
    return { sent: (body as { decision: string }).decision === "approve" } as T;
  }
  if ((m = path.match(/^\/admin\/approvals\/(.+)$/))) {
    demoState.approvals = demoState.approvals.filter((a) => a.id !== m![1]);
    return { id: m[1] } as T;
  }
  if (path === "/admin/providers/cicdoo" && method === "GET") return { connected: demoCicdoo, tools: demoCicdoo ? ["list_projects"] : [] } as T;
  if (path === "/admin/providers/cicdoo") {
    demoCicdoo = !(body as { disconnect?: boolean }).disconnect;
    return { connected: demoCicdoo, tools: 1 } as T;
  }
  throw new ApiError("Not found", 404);
}
let demoCicdoo = false;
