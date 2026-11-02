/**
 * Unlimited Agent — calling a server employee from the normal huddle buttons.
 *
 * Starting a huddle in a DM with a running server employee (the headphones in the chat header, or Huddle in
 * the profile card) opens the live voice call instead of the on-device huddle. Anyone else, or anyone who is
 * not the workspace owner, gets the normal huddle.
 */
import * as React from "react";

import { odooApi, type ServerEmployee } from "@/features/unlimited/odoo/api";

import { EmployeeCallDialog } from "./EmployeeCallDialog";

let current: ServerEmployee | null = null;
const listeners = new Set<() => void>();

function emit(next: ServerEmployee | null) {
  current = next;
  for (const l of listeners) l();
}

/** The running server employee among these pubkeys, or null (also null when the caller is not the owner). */
export async function serverEmployeeAmong(pubkeys: readonly string[]): Promise<ServerEmployee | null> {
  try {
    const rows = await odooApi.serverAgents();
    const wanted = new Set(pubkeys.map((p) => p.toLowerCase()));
    return rows.find((r) => wanted.has(r.pubkey.toLowerCase()) && r.status === "running") ?? null;
  } catch {
    return null;
  }
}

/** Opens the live call when the DM is with a server employee. Returns true when it did. */
export async function callServerEmployee(pubkeys: readonly string[]): Promise<boolean> {
  const employee = await serverEmployeeAmong(pubkeys);
  if (!employee) return false;
  emit(employee);
  return true;
}

export function UnlimitedCallHost() {
  const employee = React.useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => {
        listeners.delete(cb);
      };
    },
    () => current,
  );
  return <EmployeeCallDialog employee={employee} onClose={() => emit(null)} />;
}
