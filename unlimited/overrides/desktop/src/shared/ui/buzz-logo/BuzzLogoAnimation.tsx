/**
 * Unlimited Agent loading mark: the infinity mark with a soft pulse, in place of the animated Buzz bee.
 * Same props as the upstream component so every caller keeps working.
 */
import type { CSSProperties } from "react";

import { BuzzMark } from "./BuzzMark";

export type BuzzLogoAnimationProps = {
  ariaLabel?: string;
  className?: string;
  fullScreen?: boolean;
  loop?: boolean;
  loopRestSeconds?: number;
  reverse?: boolean;
  showBackground?: boolean;
  style?: CSSProperties;
  textured?: boolean;
  variant?: "v1" | "v2" | "v3" | "v4" | "v5" | "v6" | "v7" | "v8";
};

export default function BuzzLogoAnimation({ ariaLabel = "Unlimited Agent", className, fullScreen = false, style }: BuzzLogoAnimationProps) {
  const mark = (
    <span
      aria-label={ariaLabel}
      className={["inline-flex animate-pulse text-primary/70 motion-reduce:animate-none", fullScreen ? "" : className ?? ""].join(" ")}
      role="img"
      style={{ width: "2rem", ...style }}
    >
      <BuzzMark className="h-auto w-full" />
    </span>
  );
  if (!fullScreen) return mark;
  return <div className={["flex h-full w-full items-center justify-center", className ?? ""].join(" ")}>{mark}</div>;
}
