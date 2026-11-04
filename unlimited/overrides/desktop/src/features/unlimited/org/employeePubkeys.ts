/**
 * Unlimited Agent — the company's AI employees run on the server, not from this desktop, so the stock mention
 * rules (agents managed here or published with an owner policy) hide them. The org list from the Unlimited
 * server is the source of truth: its AI employees are always mentionable.
 */
import { normalizePubkey } from "@/shared/lib/pubkey";

const employees = new Set<string>();

export function setUnlimitedEmployees(pubkeys: readonly string[]) {
  employees.clear();
  for (const pk of pubkeys) if (pk) employees.add(normalizePubkey(pk));
}

export function unlimitedEmployeePubkeys(): ReadonlySet<string> {
  return employees;
}
