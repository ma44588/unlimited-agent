/**
 * Unlimited Agent — the employee's own user in the company Odoo (in the employee's profile). With it the
 * employee reads its assigned tasks and writes stages, notes and hours as itself. The password or API key is
 * checked against Odoo, stored encrypted on the server and never shown again.
 */
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, CircleAlert, KeyRound, Loader2 } from "lucide-react";
import * as React from "react";

import { Button } from "@/shared/ui/button";

import { orgApi } from "./api";
import { errorText } from "./ui";

const field =
  "h-10 w-full rounded-md border border-border/70 bg-background px-3 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring";

export function OdooAccountSection({ memberId, name }: { memberId: string; name: string }) {
  const qc = useQueryClient();
  const status = useQuery({ queryKey: ["unlimited", "member-odoo", memberId], queryFn: () => orgApi.memberOdoo(memberId), retry: false });
  const [login, setLogin] = React.useState("");
  const [key, setKey] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState("");
  React.useEffect(() => {
    if (status.data?.login) setLogin(status.data.login);
  }, [status.data?.login]);

  const run = async (body: { login?: string; key?: string; action?: "remove" }) => {
    setBusy(true);
    setError("");
    try {
      const st = await orgApi.memberOdoo(memberId, body);
      qc.setQueryData(["unlimited", "member-odoo", memberId], st);
      void qc.invalidateQueries({ queryKey: ["unlimited", "org"] });
      setKey("");
      if (body.action === "remove") setLogin("");
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  };

  const s = status.data;
  return (
    <div className="max-w-xl space-y-4">
      <div>
        <h3 className="text-sm font-semibold text-foreground">Company Odoo</h3>
        <p className="text-xs text-muted-foreground">
          {name} logs in to the company Odoo with its own user. Tasks you assign to this user reach {name} within minutes; it reads them,
          moves their stage, writes feedback in the chatter and logs hours, as itself.
        </p>
      </div>
      {status.isLoading ? (
        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
      ) : status.isError ? (
        <p className="text-xs text-destructive">{errorText(status.error)}</p>
      ) : (
        <p className="flex items-center gap-2 text-xs">
          {s?.connected ? (
            <>
              <Check className="h-3.5 w-3.5 text-emerald-600" />
              <span className="text-foreground">Connected as {s.login}</span>
            </>
          ) : (
            <>
              <CircleAlert className="h-3.5 w-3.5 text-amber-600" />
              <span className="text-muted-foreground">Not connected yet</span>
            </>
          )}
        </p>
      )}
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="flex flex-col gap-1 text-xs text-muted-foreground">
          Odoo login
          <input autoComplete="off" className={field} onChange={(e) => setLogin(e.target.value)} placeholder="omar@unlimitedsolutions.technology" value={login} />
        </label>
        <label className="flex flex-col gap-1 text-xs text-muted-foreground">
          Password or API key {s?.connected ? <span className="text-muted-foreground/70">(leave empty to keep the saved one)</span> : null}
          <input autoComplete="new-password" className={field} onChange={(e) => setKey(e.target.value)} type="password" value={key} />
        </label>
      </div>
      <p className="flex items-start gap-2 text-[11px] text-muted-foreground">
        <KeyRound className="mt-0.5 h-3.5 w-3.5 shrink-0" />
        Create the user in Odoo first (Settings &gt; Users) and give it access to Project. An API key is safer than a password: in Odoo open the
        user, Account Security, New API Key.
      </p>
      {error ? <p className="rounded-lg bg-destructive/10 px-3 py-2 text-xs text-destructive">{error}</p> : null}
      <div className="flex gap-2">
        <Button disabled={busy || !login.trim() || (!key.trim() && !s?.connected)} onClick={() => void run({ login: login.trim(), key: key.trim() })} size="sm" type="button">
          {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null} Test and save
        </Button>
        {s?.connected ? (
          <Button disabled={busy} onClick={() => void run({ action: "remove" })} size="sm" type="button" variant="ghost">
            Disconnect
          </Button>
        ) : null}
      </div>
    </div>
  );
}
