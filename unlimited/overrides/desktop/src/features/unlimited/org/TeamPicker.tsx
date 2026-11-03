/**
 * Unlimited Agent — pick AI employees by department: each department is a row (tick it to take everyone,
 * open it to choose people). Used by "Add agents" in a channel and by the project's Connect wizard.
 */
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, ChevronRight, Minus, Search } from "lucide-react";
import * as React from "react";

import { cn } from "@/shared/lib/cn";

import { type Department, type Org, orgApi, type OrgPerson } from "./api";
import { OrgAvatar } from "./ui";

type Group = { id: string; name: string; head: string; people: OrgPerson[] };

const isAi = (m: OrgPerson) => m.kind === "ai";

/** Departments in tree order (each division, then the departments under it), keeping only people `keep` allows. */
export function teamGroups(org: Org, keep: (m: OrgPerson) => boolean): Group[] {
  const depts = org.departments ?? [];
  const known = new Set(depts.map((d) => d.id));
  const order: Department[] = [];
  const walk = (parent: string) => {
    for (const d of depts) {
      const p = d.parent && known.has(d.parent) ? d.parent : "";
      if (p !== parent || order.includes(d)) continue;
      order.push(d);
      walk(d.id);
    }
  };
  walk("");
  const groups: Group[] = order.map((d) => {
    const people = org.members.filter((m) => m.dept === d.id && !m.owner && keep(m));
    people.sort((a, b) => (a.id === d.head ? -1 : b.id === d.head ? 1 : 0));
    return { id: d.id, name: d.name, head: d.head, people };
  });
  const loose = org.members.filter((m) => !m.owner && keep(m) && !known.has(m.dept ?? ""));
  if (loose.length) groups.push({ id: "_none", name: "Not in a department", head: "", people: loose });
  return groups.filter((g) => g.people.length);
}

function Box({ state }: { state: "on" | "part" | "off" }) {
  return (
    <span
      className={cn(
        "flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-[5px] border-[1.5px]",
        state === "off" ? "border-muted-foreground/40 bg-background" : "border-primary bg-primary text-primary-foreground",
      )}
    >
      {state === "on" ? <Check className="h-3 w-3" strokeWidth={3} /> : state === "part" ? <Minus className="h-3 w-3" strokeWidth={3} /> : null}
    </span>
  );
}

const NONE = new Set<string>();

export function TeamPicker({
  org,
  selected,
  onChange,
  keep = isAi,
  locked = NONE,
  lockedLabel = "In channel",
}: {
  org: Org;
  selected: string[];
  onChange: (ids: string[]) => void;
  keep?: (m: OrgPerson) => boolean;
  /** People who are already in (shown ticked and disabled). */
  locked?: Set<string>;
  lockedLabel?: string;
}) {
  const [q, setQ] = React.useState("");
  const groups = React.useMemo(() => teamGroups(org, keep), [org, keep]);
  const [open, setOpen] = React.useState<Set<string>>(
    () => new Set(groups.filter((g) => g.people.some((m) => selected.includes(m.id))).map((g) => g.id)),
  );
  const needle = q.trim().toLowerCase();
  const shown = groups
    .map((g) => ({
      ...g,
      people: needle ? g.people.filter((m) => `${m.name} ${m.title ?? ""} ${g.name}`.toLowerCase().includes(needle)) : g.people,
    }))
    .filter((g) => g.people.length);
  const pick = new Set(selected);
  const total = groups.reduce((n, g) => n + g.people.length, 0);

  const toggleGroup = (g: Group) => {
    const free = g.people.filter((m) => !locked.has(m.id)).map((m) => m.id);
    const all = free.length > 0 && free.every((id) => pick.has(id));
    onChange(all ? selected.filter((id) => !free.includes(id)) : [...new Set([...selected, ...free])]);
  };
  const toggleOpen = (id: string) =>
    setOpen((cur) => {
      const next = new Set(cur);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  return (
    <div className="space-y-2" data-testid="team-picker">
      <label className="flex h-10 items-center gap-2 rounded-xl border border-border/70 bg-background px-3 text-sm focus-within:ring-2 focus-within:ring-ring">
        <Search className="h-4 w-4 text-muted-foreground" />
        <input
          className="min-w-0 flex-1 bg-transparent outline-none placeholder:text-muted-foreground"
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search by name or job…"
          value={q}
        />
      </label>
      <p className="px-0.5 pt-1 text-[11px] font-bold tracking-wide text-muted-foreground">UNLIMITED TEAM · {total}</p>
      {shown.map((g) => {
        const free = g.people.filter((m) => !locked.has(m.id));
        const n = free.filter((m) => pick.has(m.id)).length;
        const state = free.length && n === free.length ? "on" : n ? "part" : "off";
        const isOpen = needle ? true : open.has(g.id);
        return (
          <section className="overflow-hidden rounded-xl border border-border/60 bg-background" key={g.id}>
            <div className="flex items-center gap-2.5 px-3 py-2.5">
              <button
                aria-expanded={isOpen}
                aria-label={`${isOpen ? "Close" : "Open"} ${g.name}`}
                className="rounded p-0.5 text-muted-foreground hover:bg-muted"
                onClick={() => toggleOpen(g.id)}
                type="button"
              >
                <ChevronRight className={cn("h-4 w-4 transition-transform", isOpen && "rotate-90")} />
              </button>
              <button aria-label={`Select everyone in ${g.name}`} disabled={!free.length} onClick={() => toggleGroup(g)} type="button">
                <Box state={free.length ? state : "on"} />
              </button>
              <button className="flex min-w-0 flex-1 items-center gap-2 text-start" onClick={() => toggleOpen(g.id)} type="button">
                <span className="truncate text-sm font-bold text-primary">{g.name}</span>
                <span className="rounded-full bg-muted px-1.5 text-[11px] text-muted-foreground">{g.people.length}</span>
                <span className="ms-1 flex">
                  {g.people.slice(0, 4).map((m, i) => (
                    <span className={cn("rounded-full ring-2 ring-background", i > 0 && "-ms-1.5")} key={m.id}>
                      <OrgAvatar badge={false} person={m} size={20} />
                    </span>
                  ))}
                </span>
              </button>
              {free.length ? (
                <button className="shrink-0 text-xs font-semibold text-primary hover:underline" onClick={() => toggleGroup(g)} type="button">
                  {state === "on" ? "Clear" : "Select all"}
                </button>
              ) : (
                <span className="shrink-0 text-xs text-muted-foreground">{lockedLabel}</span>
              )}
            </div>
            {isOpen ? (
              <div className="border-t border-border/50 px-1.5 py-1">
                {g.people.map((m) => {
                  const isLocked = locked.has(m.id);
                  const on = isLocked || pick.has(m.id);
                  return (
                    <button
                      className={cn("flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-start hover:bg-muted/50", isLocked && "cursor-default opacity-60")}
                      disabled={isLocked}
                      key={m.id}
                      onClick={() => onChange(on ? selected.filter((x) => x !== m.id) : [...selected, m.id])}
                      type="button"
                    >
                      <Box state={on ? "on" : "off"} />
                      <OrgAvatar badge={false} person={m} size={34} />
                      <span className="min-w-0 flex-1">
                        <span className="flex items-center gap-1.5 text-sm font-semibold text-foreground">
                          <span className="truncate">{m.name}</span>
                          {m.id === g.head ? <span className="rounded bg-primary/10 px-1 text-[9.5px] font-bold uppercase text-primary">Head</span> : null}
                        </span>
                        <span className="block truncate text-xs text-muted-foreground">{m.title}</span>
                      </span>
                      {isLocked ? <span className="shrink-0 text-[11px] font-semibold text-emerald-700 dark:text-emerald-300">{lockedLabel}</span> : null}
                    </button>
                  );
                })}
              </div>
            ) : null}
          </section>
        );
      })}
      {!shown.length ? <p className="px-1 py-3 text-sm text-muted-foreground">{needle ? "Nobody matches that." : "No employees yet."}</p> : null}
    </div>
  );
}

/** State for "Add agents" in a channel: which AI employees are picked, who is already in, and the add call. */
export function useChannelTeamPick(channelId: string | null, open: boolean, memberPubkeys: readonly string[] | undefined) {
  const qc = useQueryClient();
  const org = useQuery({ queryKey: ["unlimited", "org"], queryFn: () => orgApi.org(), enabled: open, retry: false, staleTime: 60_000 });
  const [selected, setSelected] = React.useState<string[]>([]);
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState("");
  React.useEffect(() => {
    if (!open) {
      setSelected([]);
      setError("");
    }
  }, [open]);
  const inChannel = React.useMemo(() => {
    const pks = new Set((memberPubkeys ?? []).map((p) => p.toLowerCase()));
    return new Set((org.data?.members ?? []).filter((m) => m.pubkey && pks.has(m.pubkey.toLowerCase())).map((m) => m.id));
  }, [memberPubkeys, org.data]);
  const picked = selected.filter((id) => !inChannel.has(id));
  const names = picked.map((id) => org.data?.members.find((m) => m.id === id)?.name ?? id);
  const submit = async () => {
    if (!channelId || !picked.length) return;
    setPending(true);
    setError("");
    try {
      await orgApi.channelAdd(channelId, picked);
      setSelected([]);
      void qc.invalidateQueries({ queryKey: ["channels", channelId, "members"] });
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      throw e;
    } finally {
      setPending(false);
    }
  };
  return {
    org: org.data,
    selected,
    setSelected,
    inChannel,
    count: picked.length,
    summary: picked.length ? `${picked.length} selected · ${names.slice(0, 4).join(", ")}${names.length > 4 ? "…" : ""}` : "",
    pending,
    error,
    submit,
  };
}

export function ChannelTeamSection({ team }: { team: ReturnType<typeof useChannelTeamPick> }) {
  if (!team.org) return null;
  return (
    <div className="space-y-2">
      <TeamPicker locked={team.inChannel} onChange={team.setSelected} org={team.org} selected={team.selected} />
      {team.error ? <p className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">{team.error}</p> : null}
      <p className="px-0.5 pt-2 text-[11px] font-bold tracking-wide text-muted-foreground">ON THIS COMPUTER</p>
    </div>
  );
}
