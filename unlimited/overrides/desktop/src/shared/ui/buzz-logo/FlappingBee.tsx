import { BuzzMark } from "./BuzzMark";

/** Static Unlimited Agent mark in place of the flapping bee. */
export function FlappingBee({ className }: { className?: string }) {
  return <BuzzMark className={className} />;
}
