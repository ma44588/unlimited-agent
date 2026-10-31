import { cn } from "@/shared/lib/cn";
import { BuzzMark } from "./BuzzMark";

export type FuzzyLogoProps = {
  fuzz?: boolean;
  className?: string;
  ariaLabel?: string;
  loop?: boolean;
  loopRestSeconds?: number;
  pulse?: boolean;
  reverse?: boolean;
  variant?: string;
};

/** Unlimited Agent mark (replaces the animated Buzz logo; same props). */
export function FuzzyLogo({ className, ariaLabel = "Unlimited Agent" }: FuzzyLogoProps) {
  return (
    <span role="img" aria-label={ariaLabel} className={cn("inline-flex", className)}>
      <BuzzMark className="h-full w-full" />
    </span>
  );
}
