/**
 * Agents that run 24/7 on the Unlimited server (not on this Mac). They are listed next to
 * the local agents so they can join huddles as real agents (role "bot"), which makes the
 * huddle transcript mention them and turns transcription on automatically.
 */
import { odooApi } from "./api";

export type ServerAgentSummary = {
  pubkey: string;
  name: string;
  status: string;
  avatar_url: string | null;
  backend: { type: "provider"; id: string; config: Record<string, unknown> };
};

export async function loadServerAgents(): Promise<ServerAgentSummary[]> {
  try {
    const rows = await odooApi.serverAgents();
    return rows.map((r) => ({
      pubkey: r.pubkey,
      name: `${r.name} · Server`,
      status: "deployed",
      avatar_url: null,
      backend: { type: "provider", id: "unlimited-server", config: {} },
    }));
  } catch {
    return []; // not the owner, or connector unreachable: local agents still work
  }
}
