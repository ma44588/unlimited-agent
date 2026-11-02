/** Unlimited Agent — small pieces shared by Today and Team (avatars with an AI / Human badge, bars, rings). */
import * as React from "react";

import { cn } from "@/shared/lib/cn";

import type { OrgPerson, PlanRow } from "./api";

const PALETTE = ["#E11D48", "#3B82F6", "#10B981", "#F59E0B", "#6366F1", "#8B5CF6", "#0EA5E9", "#7A4794"];

function colorFor(key: string): number {
  let n = 0;
  for (const ch of key) n += ch.charCodeAt(0);
  return n % PALETTE.length;
}

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return parts.slice(0, 2).map((p) => p[0]!.toUpperCase()).join("") || "?";
}

export function OrgAvatar({
  person,
  size = 40,
  badge,
  className,
}: {
  person: Pick<OrgPerson, "id" | "name" | "kind" | "avatar">;
  size?: number;
  badge?: string | false;
  className?: string;
}) {
  const i = colorFor(person.id);
  const a = PALETTE[i]!;
  const b = PALETTE[(i + 3) % PALETTE.length]!;
  const ai = person.kind === "ai";
  const label = badge === false ? null : (badge ?? (ai ? "AI" : "Human"));
  const img = person.avatar?.startsWith("https://") ? person.avatar : null;
  return (
    <span className={cn("relative inline-flex shrink-0", className)} style={{ width: size, height: size }}>
      <span
        className="flex h-full w-full items-center justify-center overflow-hidden rounded-full font-bold text-white"
        style={{ background: img ? undefined : `linear-gradient(135deg, ${a}, ${b})`, fontSize: size * 0.34 }}
      >
        {img ? <img alt="" className="h-full w-full object-cover" src={img} /> : initials(person.name)}
      </span>
      {label && size >= 28 ? (
        <span
          className={cn(
            "absolute -bottom-1 -right-1.5 rounded-md border-2 border-background px-1 text-[8px] font-extrabold leading-[1.15]",
            ai ? "bg-primary text-primary-foreground" : "bg-emerald-600 text-white",
          )}
        >
          {label}
        </span>
      ) : null}
    </span>
  );
}

export function Bar({ value, className }: { value: number; className?: string }) {
  const [w, setW] = React.useState(0);
  React.useEffect(() => {
    const id = requestAnimationFrame(() => setW(Math.max(0, Math.min(1, value))));
    return () => cancelAnimationFrame(id);
  }, [value]);
  return (
    <div className={cn("h-1.5 overflow-hidden rounded-full bg-primary/10", className)}>
      <div
        className="h-full rounded-full bg-gradient-to-r from-primary to-rose-500/80 transition-[width] duration-700 ease-out motion-reduce:transition-none"
        style={{ width: `${w * 100}%` }}
      />
    </div>
  );
}

export function Ring({ percent }: { percent: number }) {
  const [p, setP] = React.useState(0);
  React.useEffect(() => {
    const id = requestAnimationFrame(() => setP(percent));
    return () => cancelAnimationFrame(id);
  }, [percent]);
  const r = 32;
  const c = 2 * Math.PI * r;
  return (
    <svg aria-label={`${percent}% done`} className="shrink-0" height="80" role="img" viewBox="0 0 80 80" width="80">
      <circle cx="40" cy="40" fill="none" r={r} stroke="rgba(255,255,255,.15)" strokeWidth="8" />
      <circle
        className="transition-[stroke-dashoffset] duration-1000 ease-out motion-reduce:transition-none"
        cx="40"
        cy="40"
        fill="none"
        r={r}
        stroke="#E6BDF5"
        strokeDasharray={c}
        strokeDashoffset={c * (1 - p / 100)}
        strokeLinecap="round"
        strokeWidth="8"
        transform="rotate(-90 40 40)"
      />
      <text fill="#fff" fontSize="18" fontWeight="800" textAnchor="middle" x="40" y="46">
        {percent}%
      </text>
    </svg>
  );
}

export type Tone = "ok" | "warn" | "accent" | "neutral";
const TONE: Record<Tone, string> = {
  ok: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
  warn: "bg-amber-500/10 text-amber-700 dark:text-amber-300",
  accent: "bg-primary/10 text-primary",
  neutral: "bg-muted text-muted-foreground",
};

export function Pill({ tone = "neutral", children }: { tone?: Tone; children: React.ReactNode }) {
  return <span className={cn("inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[11px] font-semibold", TONE[tone])}>{children}</span>;
}

export function dayState(r?: PlanRow): [string, Tone] {
  if (!r || r.total === 0) return ["Free", "neutral"];
  if (r.done === r.total) return ["Done", "ok"];
  if (r.blocked > 0) return ["Blocked", "warn"];
  return ["On track", "ok"];
}

export function hm(iso?: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "" : d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
}

export function hours(h: number): string {
  return `${Number.isInteger(h) ? h : h.toFixed(1)} h`;
}

export function errorText(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}

export function Card({ className, children, ...rest }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn("rounded-2xl border border-border/60 bg-background", className)} {...rest}>
      {children}
    </div>
  );
}
