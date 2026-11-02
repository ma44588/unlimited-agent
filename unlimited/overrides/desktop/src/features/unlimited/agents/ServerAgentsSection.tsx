/**
 * Unlimited Agent — the company's employees that run 24/7 on the Unlimited server: one card each with
 * status, model, Message and Settings, plus a card to add a new server employee. Owner-only (the list
 * comes from the connector admin API); renders nothing for anyone else.
 */
import { useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { AtSign, MessageSquare, Mic, Plus, Send, Server, Settings2 } from "lucide-react";
import * as React from "react";
import { toast } from "sonner";

import { useOpenDmMutation } from "@/features/channels/hooks";
import { odooApi, type ServerEmployee } from "@/features/unlimited/odoo/api";
import { cn } from "@/shared/lib/cn";
import { Button } from "@/shared/ui/button";
import { UserAvatar } from "@/shared/ui/UserAvatar";
import { NewServerEmployeeDialog, ServerEmployeeSettingsDialog } from "./ServerEmployeeDialogs";

function StatusPill({ status }: { status: string }) {
  const running = status === "running";
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium ring-1 ring-inset",
        running
          ? "bg-emerald-500/10 text-emerald-700 ring-emerald-500/25 dark:text-emerald-300"
          : "bg-amber-500/10 text-amber-700 ring-amber-500/25 dark:text-amber-300",
      )}
    >
      <Server className="h-3 w-3" /> {running ? "Server" : status === "exited" ? "Stopped" : status}
    </span>
  );
}

const DEPARTMENTS = ["Development", "Implementation", "Analysis", "Marketing & Sales", "Opportunities"];

function groups(rows: ServerEmployee[]): [string, ServerEmployee[]][] {
  const by = new Map<string, ServerEmployee[]>();
  for (const r of rows) {
    const d = r.department || "Employees";
    by.set(d, [...(by.get(d) ?? []), r]);
  }
  const order = (d: string) => (DEPARTMENTS.indexOf(d) + 1 || 99);
  const out = [...by.entries()].sort((a, b) => order(a[0]) - order(b[0]));
  return out.length ? out : [["Employees", []]];
}

function Channel({ icon: Icon, label, ok }: { icon: React.ComponentType<{ className?: string }>; label: string; ok: boolean }) {
  return (
    <span className={cn("inline-flex min-w-0 items-center gap-1", ok ? "text-foreground/80" : "text-muted-foreground/60")} title={ok ? label : `${label}: not linked`}>
      <Icon className="h-3 w-3 shrink-0" />
      <span className="truncate">{label}</span>
      <span className={cn("h-1.5 w-1.5 shrink-0 rounded-full", ok ? "bg-emerald-500" : "bg-muted-foreground/40")} />
    </span>
  );
}

export function ServerAgentsSection() {
  const navigate = useNavigate();
  const openDm = useOpenDmMutation();
  const [opening, setOpening] = React.useState<string | null>(null);
  const [creating, setCreating] = React.useState(false);
  const [editing, setEditing] = React.useState<ServerEmployee | null>(null);
  const query = useQuery({
    queryKey: ["unlimited", "server-agents"],
    queryFn: () => odooApi.serverAgents(),
    staleTime: 15_000,
    refetchInterval: 30_000,
    retry: false,
  });
  if (query.isError) return null;
  const rows = query.data ?? [];

  async function message(pubkey: string) {
    setOpening(pubkey);
    try {
      const dm = await openDm.mutateAsync({ pubkeys: [pubkey] });
      await navigate({ to: "/channels/$channelId", params: { channelId: dm.id } });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not open the chat.");
    } finally {
      setOpening(null);
    }
  }

  return (
    <section className="space-y-3" data-testid="server-agents-section">
      <div className="space-y-0.5">
        <h2 className="text-base font-semibold text-foreground">Server employees</h2>
        <p className="text-sm text-muted-foreground">
          The company’s employees that run on the server around the clock. Message them, change their settings, add them to channels and calls, and assign them tasks.
        </p>
      </div>
      {query.isLoading ? (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {[0, 1].map((i) => <div className="h-[132px] animate-pulse rounded-xl border border-border/60 bg-muted/30" key={i} />)}
        </div>
      ) : (
        groups(rows).map(([dept, list], gi) => (
          <div className="space-y-2" key={dept}>
            <div className="flex items-baseline gap-2 pt-2">
              <h3 className="text-sm font-semibold text-foreground">{dept}</h3>
              <span className="text-xs text-muted-foreground">{list.length}</span>
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {list.map((agent) => (
                <article
                  className="flex min-w-0 flex-col gap-3 rounded-xl border border-border/70 bg-card/60 p-4"
                  data-testid="server-agent-card"
                  key={agent.pubkey}
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <UserAvatar avatarUrl={agent.avatar || null} displayName={agent.person || agent.name} shape="squircle" size="md" />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="truncate text-sm font-semibold text-foreground">{agent.person || agent.name}</span>
                        <StatusPill status={agent.status} />
                      </div>
                      {agent.title ? <p className="truncate text-xs text-foreground/80">{agent.title}</p> : null}
                      <p className="truncate text-xs text-muted-foreground" title={agent.about || agent.role}>
                        {agent.about || agent.role || "Server employee"}
                      </p>
                    </div>
                  </div>
                  {agent.telegram || agent.email || agent.voice ? (
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
                    <Channel icon={Send} label={agent.telegram?.bot ?? "Telegram"} ok={!!agent.telegram?.ok} />
                    <Channel icon={AtSign} label="Email" ok={!!agent.email?.ok} />
                    {agent.voice ? <Channel icon={Mic} label={agent.voice.split(" ·")[0]} ok /> : null}
                  </div>
                  ) : null}
                  <div className="flex items-center gap-2">
                    <Button disabled={opening !== null} onClick={() => void message(agent.pubkey)} size="sm" variant="outline">
                      <MessageSquare /> Message
                    </Button>
                    <Button onClick={() => setEditing(agent)} size="sm" variant="ghost">
                      <Settings2 /> Profile
                    </Button>
                    <span className="ms-auto text-[11px] capitalize text-muted-foreground/70">{agent.model}</span>
                  </div>
                </article>
              ))}
              {gi === 0 ? (
                <button
                  className="flex min-h-[132px] flex-col items-center justify-center gap-1.5 rounded-xl border border-dashed border-border/80 text-sm text-muted-foreground transition-colors hover:border-primary/40 hover:bg-muted/30 hover:text-foreground"
                  data-testid="server-agent-new"
                  onClick={() => setCreating(true)}
                  type="button"
                >
                  <Plus className="h-5 w-5" />
                  New server employee
                </button>
              ) : null}
            </div>
          </div>
        ))
      )}
      <NewServerEmployeeDialog onOpenChange={setCreating} open={creating} />
      <ServerEmployeeSettingsDialog employee={editing} onOpenChange={(o) => !o && setEditing(null)} />
    </section>
  );
}
