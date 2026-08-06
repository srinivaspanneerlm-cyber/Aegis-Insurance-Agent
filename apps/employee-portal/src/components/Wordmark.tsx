import { cn } from "@aegis/utils";

/**
 * The mark and the name, drawn rather than fetched.
 *
 * An inline SVG costs no request and cannot arrive after the text does, which
 * is what causes the small lurch you see on most sites as a logo image loads.
 * It also inherits `currentColor`, so it stays correct on any surface without a
 * second file for a second background.
 *
 * The shield is the whole idea of the company in one shape: `aegis` is a shield.
 * The inner form is a lowered guard — protection that is open rather than shut.
 */
export function Wordmark({
  className,
  showName = true,
}: {
  className?: string;
  showName?: boolean;
}) {
  return (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      <svg
        width="28"
        height="28"
        viewBox="0 0 32 32"
        fill="none"
        aria-hidden="true"
        focusable="false"
        className="shrink-0"
      >
        <defs>
          <linearGradient
            id="aegis-mark"
            x1="4"
            y1="2"
            x2="28"
            y2="30"
            gradientUnits="userSpaceOnUse"
          >
            <stop stopColor="rgb(var(--aegis-brand))" />
            <stop offset="1" stopColor="rgb(var(--aegis-accent))" />
          </linearGradient>
        </defs>
        <path
          d="M16 2.5 5 6.4v9.1c0 6.6 4.6 12.4 11 14 6.4-1.6 11-7.4 11-14V6.4L16 2.5Z"
          fill="url(#aegis-mark)"
          fillOpacity="0.16"
          stroke="url(#aegis-mark)"
          strokeWidth="1.8"
          strokeLinejoin="round"
        />
        <path
          d="M11 15.6l3.4 3.5L21 12"
          stroke="url(#aegis-mark)"
          strokeWidth="2.2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      {showName ? (
        <span className="text-body font-bold tracking-tight text-content">Aegis AI</span>
      ) : null}
    </span>
  );
}
