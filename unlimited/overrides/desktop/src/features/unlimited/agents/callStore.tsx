/**
 * Unlimited Agent — calling a server employee from the normal huddle buttons.
 *
 * Starting a huddle in a DM with a running server employee (the headphones in the chat header, or Huddle in
 * the profile card) opens the live voice call instead of the on-device huddle. Anyone else, or anyone who is
 * not the workspace owner, gets the normal huddle.
 */
import { useQuery } from "@tanstack/react-query";
import { Headphones } from "lucide-react";
import * as React from "react";

import { Button } from "@/shared/ui/button";

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

/** The running server employee in this DM (owner only; null for anyone else). Shares the Agents page cache. */
export function useServerEmployeeIn(pubkeys: readonly string[]): ServerEmployee | null {
  const query = useQuery({
    queryKey: ["unlimited", "server-agents"],
    queryFn: () => odooApi.serverAgents(),
    staleTime: 15_000,
    retry: false,
    enabled: pubkeys.length > 0,
  });
  return React.useMemo(() => {
    if (!query.data || pubkeys.length === 0) return null;
    const wanted = new Set(pubkeys.map((p) => p.toLowerCase()));
    return query.data.find((r) => wanted.has(r.pubkey.toLowerCase()) && r.status === "running") ?? null;
  }, [pubkeys, query.data]);
}

/** Header button in a DM with a server employee: always the live call, never the on-device huddle. */
export function UnlimitedCallButton({ employee }: { employee: ServerEmployee }) {
  return (
    <Button
      aria-label={`Call ${employee.person || employee.name}`}
      data-testid="unlimited-call-trigger"
      onClick={() => emit(employee)}
      size="icon"
      title={`Call ${employee.person || employee.name}`}
      type="button"
      variant="outline"
    >
      <Headphones />
    </Button>
  );
}
