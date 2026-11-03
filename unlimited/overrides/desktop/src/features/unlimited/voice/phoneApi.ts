/** Phone line (Twilio) on the connector: /admin/phone. Twilio credentials are never returned. */
import { request } from "../odoo/api";

export type PhoneStatus = {
  webhook: string;
  numbers: Record<string, string>;
  owner_phones: string[];
  twilio: { connected: boolean; account: string };
  openai: boolean;
  recent: { ts: string; dir?: string; slug?: string; who?: string; from?: string; seconds?: number; error?: string }[];
};

export const phoneApi = {
  status: () => request<PhoneStatus>("GET", "/admin/phone"),
  update: (body: { numbers?: Record<string, string>; owner_phones?: string[] }) => request<PhoneStatus>("POST", "/admin/phone", body),
  twilio: (sid: string, token: string) => request<PhoneStatus>("POST", "/admin/phone/twilio", { sid, token }),
  callMe: (slug: string, reason: string) => request<{ ok: boolean; call: string; employee: string }>("POST", "/admin/phone/call", { slug, reason }),
};
