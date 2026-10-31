/**
 * Unlimited Agent mark (infinity), drawn in `currentColor`.
 * Replaces the upstream Buzz mark at build time (see unlimited/brand.py).
 */
export function BuzzMark({ className }: { className?: string }) {
  return (
    <svg
      aria-hidden="true"
      className={["buzz-mark", className].filter(Boolean).join(" ")}
      viewBox="0 0 466 309"
      fill="none"
      stroke="currentColor"
      strokeWidth={46}
      strokeLinecap="round"
    >
      <path d="M233 154C192 104 156 74 118 74a80 80 0 0 0 0 160c38 0 74-30 115-80s77-80 115-80a80 80 0 0 1 0 160c-38 0-74-30-115-80z" />
    </svg>
  );
}
