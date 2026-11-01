/**
 * Unlimited Agent — the company's employees that run 24/7 on the Unlimited server, shown at the
 * top of the Agents page with a one-click direct message. Owner-only (the list comes from the
 * connector admin API); renders nothing for anyone else.
 */
import { useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { MessageSquare, Server } from "lucide-react";
import * as React from "react";
import { toast } from "sonner";

import { useOpenDmMutation } from "@/features/channels/hooks";
import { odooApi } from "@/features/unlimited/odoo/api";
import { Button } from "@/shared/ui/button";
import { UserAvatar } from "@/shared/ui/UserAvatar";

const ROLE: Record<string, string> = {
  Developer: "مطوّر Odoo: تحليل، تنفيذ على stag، متابعة الـ build والاختبار",
  Documentation: "التوثيق: أدلة المستخدم، ملخصات للفريق، محاضر الاجتماعات",
};

export function ServerAgentsSection() {
  const navigate = useNavigate();
  const openDm = useOpenDmMutation();
  const [opening, setOpening] = React.useState<string | null>(null);
  const query = useQuery({
    queryKey: ["unlimited", "server-agents"],
    queryFn: () => odooApi.serverAgents(),
    staleTime: 60_000,
    retry: false,
  });
  const rows = query.data ?? [];
  if (query.isError || (!query.isLoading && rows.length === 0)) return null;

  async function message(pubkey: string) {
    setOpening(pubkey);
    try {
      const dm = await openDm.mutateAsync({ pubkeys: [pubkey] });
      await navigate({ to: "/channels/$channelId", params: { channelId: dm.id } });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "تعذر فتح المحادثة.");
    } finally {
      setOpening(null);
    }
  }

  return (
    <section className="space-y-3" data-testid="server-agents-section">
      <div className="space-y-0.5">
        <h2 className="text-base font-semibold text-foreground">Server employees</h2>
        <p className="text-sm text-muted-foreground" dir="rtl">
          موظفين الشركة اللي شغالين على السيرفر طول الوقت. تقدر تكلمهم، تضيفهم للقنوات والمكالمات، وتعيّن لهم تاسكات.
        </p>
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {query.isLoading
          ? [0, 1].map((i) => (
              <div className="h-[104px] animate-pulse rounded-xl border border-border/60 bg-muted/30" key={i} />
            ))
          : rows.map((agent) => (
              <article
                className="flex min-w-0 flex-col gap-3 rounded-xl border border-border/70 bg-card/60 p-4"
                data-testid="server-agent-card"
                key={agent.pubkey}
              >
                <div className="flex min-w-0 items-center gap-3">
                  <UserAvatar avatarUrl={null} displayName={agent.name} shape="squircle" size="md" />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="truncate text-sm font-semibold text-foreground">{agent.name}</span>
                      <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[11px] font-medium text-emerald-700 ring-1 ring-inset ring-emerald-500/25 dark:text-emerald-300">
                        <Server className="h-3 w-3" /> Server
                      </span>
                    </div>
                    <p className="truncate text-xs text-muted-foreground" dir="rtl" title={ROLE[agent.name]}>
                      {ROLE[agent.name] ?? "موظف على السيرفر"}
                    </p>
                  </div>
                </div>
                <div className="flex">
                  <Button
                    disabled={opening !== null}
                    onClick={() => void message(agent.pubkey)}
                    size="sm"
                    variant="outline"
                  >
                    <MessageSquare /> Message
                  </Button>
                </div>
              </article>
            ))}
      </div>
    </section>
  );
}
