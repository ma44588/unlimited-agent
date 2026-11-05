/**
 * Unlimited Agent — joining a workspace by invite (before the app has an account).
 * lookup / email steps are public; claim and status are signed by this device's own key (NIP-98),
 * so only the public key ever reaches the server.
 */
import { signRelayEvent } from "@/shared/api/tauri";

import { UNLIMITED_API } from "../odoo/api";

export type JoinInfo = {
  workspace: string;
  host: string;
  relay_url: string;
  invited_by: string;
  role: string;
  department: string;
  name: string;
  confirm: boolean;
  status: "open" | "pending" | "joined" | "rejected" | "none";
  pair?: string;
  code?: string;
};

export class JoinFailed extends Error {}

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

const demo = () => typeof window !== "undefined" && Boolean((window as { __BUZZ_E2E__?: unknown }).__BUZZ_E2E__);
const DEMO: JoinInfo = {
  workspace: "Unlimited Solutions", host: "app.unlimitedsolutions.technology", relay_url: "wss://app.unlimitedsolutions.technology",
  invited_by: "Mostafa Gabr", role: "member", department: "Delivery", name: "Ahmed Samir", confirm: true, status: "open",
};

async function post<T>(path: string, body: unknown, signed = false): Promise<T> {
  const url = UNLIMITED_API + path;
  const payload = JSON.stringify(body ?? {});
  const headers: Record<string, string> = { "content-type": "application/json" };
  if (signed) {
    const tags = [["u", url], ["method", "POST"], ["payload", await sha256Hex(payload)]];
    const ev = await signRelayEvent({ kind: 27235, content: "", tags });
    const { id, pubkey, created_at, kind, content, sig } = ev;
    headers.authorization = "Nostr " + b64(JSON.stringify({ id, pubkey, created_at, kind, tags: ev.tags, content, sig }));
  }
  let res: Response;
  try {
    res = await fetch(url, { method: "POST", headers, body: payload });
  } catch {
    throw new JoinFailed("Can't reach Unlimited Agent. Check your internet connection.");
  }
  const data = (await res.json().catch(() => ({}))) as { ok?: boolean; result?: T; error?: string };
  if (!res.ok || !data.ok) throw new JoinFailed(data.error || `Something went wrong (${res.status}).`);
  return data.result as T;
}

const wait = <T,>(v: T) => new Promise<T>((r) => setTimeout(() => r(v), 500));

export function deviceName(): string {
  const p = `${navigator.userAgent} ${navigator.platform}`.toLowerCase();
  return p.includes("mac") ? "Mac" : p.includes("win") ? "Windows PC" : "Computer";
}

export const joinApi = {
  lookup: (code: string) => (demo() ? wait(DEMO) : post<JoinInfo>("/join/lookup", { code })),
  emailStart: (email: string) =>
    demo() ? wait({ sent: true, resend_in: 45 }) : post<{ sent: boolean; resend_in: number }>("/join/email/start", { email }),
  emailVerify: (email: string, code: string) =>
    demo() ? wait({ ...DEMO, code: "demo-ticket-123456" }) : post<JoinInfo & { code: string }>("/join/email/verify", { email, code }),
  claim: (code: string, name: string) =>
    demo()
      ? wait({ ...DEMO, status: "pending" as const, pair: "48 · 17" })
      : post<JoinInfo>("/join/claim", { code, name, device: deviceName() }, true),
  status: () => (demo() ? wait({ ...DEMO, status: "pending" as const, pair: "48 · 17" }) : post<JoinInfo>("/join/status", {}, true)),
};
