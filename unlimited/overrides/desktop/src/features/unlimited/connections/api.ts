/** Connections API (connector /admin/connections), signed with the owner's key like the other admin calls. */
import { isDemo, request } from "../odoo/api";

export type ConnKind = "github" | "odoosh" | "cicdoo" | "server" | "email" | "voice" | "company_odoo" | "push";
export type ConnState = "connected" | "attention" | "off";

export type ConnItem = {
  kind: ConnKind;
  state: ConnState;
  detail: string;
  checked_at?: string;
  method?: "app" | "account";
  account?: string;
  app?: boolean;
  repos?: { full_name: string; ok?: boolean; private?: boolean; default_branch?: string }[];
  public_key?: string;
  server?: { host: string; user: string; port: number; odoo_url: string; database: string };
  /** email: the team mailbox (password never returned). */
  address?: string;
  display_name?: string;
  imap_host?: string;
  smtp_host?: string;
  /** voice: which call services have a key on the server (keys never returned). */
  providers?: { id: VoiceProvider; name: string; connected: boolean; checked_at?: string }[];
  engine?: "realtime" | "split" | "device";
  /** push: the Apple key (never returned) and how many phones registered. */
  key_id?: string;
  team_id?: string;
  phones?: number;
};
export type VoiceProvider = "openai" | "gemini" | "anthropic" | "elevenlabs";

export type ConnOverview = { workspace: string; items: ConnItem[] };

const minsAgo = (m: number) => new Date(Date.now() - m * 60000).toISOString();
const DEMO_KEY = "ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIExampleKeyForPreviewOnly unlimited-agent@preview";
const demo: ConnOverview = {
  workspace: "preview",
  items: [
    { kind: "github", state: "connected", method: "app", account: "acme-trading", detail: "acme-trading · 2 repositories",
      checked_at: minsAgo(2), repos: [{ full_name: "acme-trading/odoo-erp", private: true }, { full_name: "acme-trading/website", private: true }] },
    { kind: "odoosh", state: "attention", detail: "Session expired: sign in again", checked_at: minsAgo(60) },
    { kind: "cicdoo", state: "off", detail: "Not connected", public_key: DEMO_KEY },
    { kind: "server", state: "off", detail: "Not connected", public_key: DEMO_KEY },
    { kind: "email", state: "connected", detail: "team@unlimitedsolutions.technology · 4 unread", address: "team@unlimitedsolutions.technology",
      display_name: "Unlimited Solutions", imap_host: "imap.hostinger.com", smtp_host: "smtp.hostinger.com", checked_at: minsAgo(3) },
    { kind: "voice", state: "connected", detail: "OpenAI", engine: "realtime", providers: [
      { id: "openai", name: "OpenAI", connected: true }, { id: "gemini", name: "Google Gemini", connected: false },
      { id: "anthropic", name: "Anthropic", connected: false }, { id: "elevenlabs", name: "ElevenLabs", connected: false }] },
  ],
};

async function call<T = ConnOverview>(method: "GET" | "POST", path: string, body?: unknown): Promise<T> {
  if (isDemo()) {
    if ((body as { action?: string } | undefined)?.action === "start") return { url: "https://github.com", step: "install" } as T;
    return demo as T;
  }
  return request<T>(method, path, body);
}

export const connectionsApi = {
  overview: () => call("GET", "/admin/connections"),
  githubStart: () => call<{ url: string; step: string }>("POST", "/admin/connections/github", { action: "start" }),
  save: (kind: ConnKind, data: Record<string, unknown>) => call("POST", `/admin/connections/${kind}`, { action: "save", ...data }),
  check: (kind: ConnKind) => call("POST", `/admin/connections/${kind}`, { action: "check" }),
  pushTest: () => call("POST", "/admin/push/test", {}),
  disconnect: (kind: ConnKind) => call("POST", `/admin/connections/${kind}`, { action: "disconnect" }),
  voiceSave: (provider: VoiceProvider, key: string) => call("POST", "/admin/connections/voice", { action: "save", provider, key }),
  voiceRemove: (provider: VoiceProvider) => call("POST", "/admin/connections/voice", { action: "remove", provider }),
  voiceEngine: (engine: "realtime" | "device") => call("POST", "/admin/connections/voice", { action: "engine", engine }),
};
