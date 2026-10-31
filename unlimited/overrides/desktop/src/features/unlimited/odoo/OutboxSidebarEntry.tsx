/**
 * Outbox: emails prepared by agents wait here for the owner. Nothing is sent until approved.
 */
import { CircleCheck, Loader2, Mail, Paperclip, X } from "lucide-react";
import * as React from "react";

import { Button } from "@/shared/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/shared/ui/dialog";
import { SidebarMenuButton, SidebarMenuItem } from "@/shared/ui/sidebar";
import { SidebarMenuLabel } from "@/shared/ui/sidebar-menu-label";

import { ApiError, type OutboxItem, odooApi } from "./api";

export function OutboxSidebarEntry() {
  const [items, setItems] = React.useState<OutboxItem[] | null>(null);
  const [allowed, setAllowed] = React.useState(true);
  const [open, setOpen] = React.useState(false);

  const load = React.useCallback(() => {
    odooApi
      .outbox()
      .then((rows) => { setItems(rows); setAllowed(true); })
      .catch((e: ApiError) => { if (e.status === 401) setAllowed(false); });
  }, []);
  React.useEffect(() => {
    load();
    const t = window.setInterval(load, 60000);
    return () => window.clearInterval(t);
  }, [load]);

  if (!allowed) return null;
  const count = items?.length ?? 0;
  return (
    <SidebarMenuItem>
      <SidebarMenuButton data-testid="open-unlimited-outbox" onClick={() => { setOpen(true); load(); }} tooltip="Outbox" type="button">
        <Mail className="h-4 w-4" />
        <SidebarMenuLabel>Outbox</SidebarMenuLabel>
        {count ? (
          <span className="ml-auto rounded-full bg-primary px-1.5 text-[11px] font-semibold leading-5 text-primary-foreground">{count}</span>
        ) : null}
      </SidebarMenuButton>
      {open ? <OutboxDialog items={items ?? []} onChanged={load} onClose={() => setOpen(false)} /> : null}
    </SidebarMenuItem>
  );
}

function OutboxDialog({ items, onChanged, onClose }: { items: OutboxItem[]; onChanged: () => void; onClose: () => void }) {
  return (
    <Dialog onOpenChange={(v) => !v && onClose()} open>
      <DialogContent className="flex max-h-[85vh] w-[760px] max-w-[calc(100vw-2rem)] flex-col gap-0 overflow-hidden p-0">
        <div className="border-b border-border/60 px-6 pb-4 pt-5">
          <DialogTitle className="text-lg font-semibold">Outbox</DialogTitle>
          <DialogDescription className="text-sm text-muted-foreground">
            Emails your agents prepared. Nothing is sent until you approve it.
          </DialogDescription>
        </div>
        <div className="flex flex-1 flex-col gap-4 overflow-y-auto px-6 py-5">
          {items.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-12 text-center text-sm text-muted-foreground">
              <CircleCheck className="h-6 w-6 text-emerald-600" /> Nothing waiting for you.
            </div>
          ) : (
            items.map((it) => <OutboxCard item={it} key={it.id} onChanged={onChanged} />)
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function OutboxCard({ item, onChanged }: { item: OutboxItem; onChanged: () => void }) {
  const [subject, setSubject] = React.useState(item.subject);
  const [body, setBody] = React.useState(item.body);
  const [busy, setBusy] = React.useState<"approve" | "reject" | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [done, setDone] = React.useState<string | null>(null);
  const edited = subject !== item.subject || body !== item.body;

  async function decide(d: "approve" | "reject") {
    setBusy(d);
    setError(null);
    try {
      await odooApi.decideEmail(item.id, d, d === "approve" && edited ? { subject, body } : undefined);
      setDone(d === "approve" ? "Sent" : "Rejected");
      window.setTimeout(onChanged, 900);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  return (
    <section className="flex flex-col gap-3 rounded-xl border border-border/70 bg-card p-4">
      <dl className="grid grid-cols-[72px_1fr] gap-x-3 gap-y-1 text-sm">
        <dt className="text-muted-foreground">From</dt>
        <dd className="truncate">{item.from} <span className="text-muted-foreground">· {item.agent}</span></dd>
        <dt className="text-muted-foreground">To</dt>
        <dd className="truncate font-medium">{item.to.join(", ")}{item.cc.length ? ` · cc ${item.cc.join(", ")}` : ""}</dd>
      </dl>
      <input
        aria-label="Subject"
        className="h-10 rounded-lg border border-input bg-background px-3 text-sm font-semibold"
        dir="auto"
        disabled={Boolean(done)}
        onChange={(e) => setSubject(e.target.value)}
        value={subject}
      />
      <textarea
        aria-label="Message"
        className="min-h-40 rounded-lg border border-input bg-background p-3 text-sm leading-relaxed"
        dir="auto"
        disabled={Boolean(done)}
        onChange={(e) => setBody(e.target.value)}
        value={body}
      />
      {item.attachments.length ? (
        <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
          {item.attachments.map((a) => (
            <span className="flex items-center gap-1 rounded-full border border-border px-2 py-0.5" key={a}>
              <Paperclip className="h-3 w-3" /> {a}
            </span>
          ))}
        </div>
      ) : null}
      {error ? <p className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p> : null}
      <div className="flex items-center gap-2">
        <span className="flex-1 text-xs text-muted-foreground">{done ?? (edited ? "Your edits will be sent" : item.reply ? "Reply in the same thread" : "New email")}</span>
        <Button disabled={Boolean(busy) || Boolean(done)} onClick={() => decide("reject")} size="sm" variant="outline">
          {busy === "reject" ? <Loader2 className="animate-spin" /> : <X />} Reject
        </Button>
        <Button disabled={Boolean(busy) || Boolean(done)} onClick={() => decide("approve")} size="sm">
          {busy === "approve" ? <Loader2 className="animate-spin" /> : <Mail />} Approve & send
        </Button>
      </div>
    </section>
  );
}
