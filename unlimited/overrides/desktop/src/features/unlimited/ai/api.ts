/**
 * Unlimited Agent — Settings > AI provider: the Claude accounts the server employees use, their usage, and who
 * uses which. Tokens go to the server once and never come back.
 */
import { isDemo, request } from "../odoo/api";

export type AiAccountState = "active" | "standby" | "resting" | "invalid" | "error";
export type AiAccount = {
  id: string;
  order: number;
  label: string;
  plan: string;
  state: AiAccountState;
  util5: number | null;
  util7: number | null;
  reset5: number | null;
  reset7: number | null;
  resting_until: number | null;
  checked_at: number | null;
  error: string;
  employees: string[];
};
export type AiEmployee = { slug: string; name: string; title: string; model: string; account: string; status: string };
export type AiSettings = { mode: "switch" | "assign"; return_first: boolean; alert: boolean };
export type AiView = {
  provider: "claude";
  accounts: AiAccount[];
  settings: AiSettings;
  active: string;
  employees: AiEmployee[];
  events: { at: number; text: string }[];
  codex: { available: boolean; why: string };
};

const now = () => Math.floor(Date.now() / 1000);
function demoView(): AiView {
  const t = now();
  const emp = (slug: string, name: string, title: string, model: string, account = "a2"): AiEmployee => ({
    slug, name, title, model, account, status: "running",
  });
  return {
    provider: "claude",
    active: "a2",
    settings: { mode: "switch", return_first: true, alert: true },
    accounts: [
      { id: "a1", order: 1, label: "mostafa@unlimited", plan: "Max", state: "resting", util5: 0.98, util7: 0.61, reset5: t + 4800,
        reset7: t + 3 * 86400, resting_until: t + 4800, checked_at: t - 120, error: "", employees: [] },
      { id: "a2", order: 2, label: "ops@unlimited", plan: "Max", state: "active", util5: 0.22, util7: 0.35, reset5: t + 9000,
        reset7: t + 4 * 86400, resting_until: null, checked_at: t - 120, error: "", employees: ["developer", "documentation", "bassem"] },
      { id: "a3", order: 3, label: "dev@unlimited", plan: "Pro", state: "standby", util5: 0, util7: 0.04, reset5: null,
        reset7: t + 5 * 86400, resting_until: null, checked_at: t - 120, error: "", employees: [] },
    ],
    employees: [
      emp("developer", "Youssef", "Senior Odoo Developer", "opus"),
      emp("documentation", "Rami", "Documentation", "sonnet"),
      emp("bassem", "Bassem", "Project Manager", "sonnet"),
    ],
    events: [{ at: t - 1800, text: "Switched from mostafa@unlimited to ops@unlimited (limit reached)" }],
    codex: { available: false, why: "The employees run on Claude Code today. Codex needs a second engine in the employee image; until then it cannot take over." },
  };
}

async function call(method: "GET" | "POST", path: string, body?: unknown): Promise<AiView> {
  if (isDemo()) return demoView();
  return request<AiView>(method, path, body);
}

export const aiApi = {
  view: () => call("GET", "/admin/ai"),
  check: () => call("POST", "/admin/ai/check", {}),
  add: (label: string, plan: string, token: string) => call("POST", "/admin/ai/accounts", { label, plan, token }),
  account: (id: string, body: Record<string, unknown>) => call("POST", `/admin/ai/accounts/${encodeURIComponent(id)}`, body),
  settings: (body: Partial<AiSettings>) => call("POST", "/admin/ai/settings", body),
  employee: (slug: string, body: { model?: string; account?: string }) =>
    call("POST", `/admin/ai/employees/${encodeURIComponent(slug)}`, body),
};
