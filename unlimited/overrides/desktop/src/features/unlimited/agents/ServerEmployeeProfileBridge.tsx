/**
 * Unlimited Agent — lets the app's profile panel treat server employees as the owner's own agents: the same
 * Harness log / Logs views (read from the server, tokens hidden) and Edit opens the employee's Profile.
 * Nothing runs on this computer.
 */
import { useQuery } from "@tanstack/react-query";
import { Loader2, RefreshCw } from "lucide-react";
import * as React from "react";

import { odooApi, type ServerEmployee } from "@/features/unlimited/odoo/api";
import { Button } from "@/shared/ui/button";

export function useServerEmployee(pubkeyLower: string): ServerEmployee | undefined {
  const query = useQuery({
    queryKey: ["unlimited", "server-agents"],
    queryFn: () => odooApi.serverAgents(),
    staleTime: 30_000,
    retry: false,
    enabled: pubkeyLower.length === 64,
  });
  return query.data?.find((e) => e.pubkey.toLowerCase() === pubkeyLower);
}

export function ServerEmployeeLogView({ employee }: { employee: ServerEmployee }) {
  const [lines, setLines] = React.useState(400);
  const query = useQuery({
    queryKey: ["unlimited", "server-agent-logs", employee.slug, lines],
    queryFn: () => odooApi.serverAgentLogs(employee.slug, lines),
    refetchInterval: 15_000,
    retry: false,
  });
  const ref = React.useRef<HTMLPreElement>(null);
  React.useEffect(() => {
    if (ref.current) ref.current.scrollTop = ref.current.scrollHeight;
  }, [query.data?.log]);
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-2 pt-4" data-testid="server-employee-log">
      <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
        <span>
          {employee.person || employee.name} on the Unlimited server · last {lines} lines · keys and tokens hidden
        </span>
        <span className="flex gap-1.5">
          {lines < 3000 ? (
            <Button onClick={() => setLines((n) => Math.min(3000, n * 2))} size="sm" type="button" variant="ghost">
              Show more
            </Button>
          ) : null}
          <Button disabled={query.isFetching} onClick={() => void query.refetch()} size="sm" type="button" variant="outline">
            <RefreshCw className={query.isFetching ? "animate-spin" : ""} /> Refresh
          </Button>
        </span>
      </div>
      {query.isLoading ? (
        <div className="flex items-center gap-2 py-6 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Reading the log from the server…
        </div>
      ) : query.isError ? (
        <p className="py-6 text-sm text-destructive">
          {query.error instanceof Error ? query.error.message : "Could not read the log from the server."}
        </p>
      ) : (
        <pre
          className="min-h-[240px] flex-1 overflow-auto whitespace-pre-wrap break-words rounded-lg border border-border/60 bg-muted/30 p-3 font-mono text-[11px] leading-relaxed text-foreground"
          dir="auto"
          ref={ref}
        >
          {query.data?.log?.trim() || "The log is empty."}
        </pre>
      )}
    </div>
  );
}
