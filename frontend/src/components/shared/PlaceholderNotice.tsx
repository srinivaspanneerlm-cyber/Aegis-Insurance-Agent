import { Info } from "lucide-react";

interface PlaceholderNoticeProps {
  /** What the reader is looking at, e.g. the testimonial notice copy. */
  message: string;
  /** Matches the surrounding surface; sections render on both themes. */
  tone?: "light" | "dark";
  className?: string;
}

/**
 * Visible marker for illustrative pre-launch content.
 *
 * Placeholder content on a financial product has to be labelled where the
 * content is, not in a footnote somewhere else — a visitor scrolling past a
 * testimonial row must be able to tell it is illustrative without hunting.
 */
export default function PlaceholderNotice({
  message,
  tone = "light",
  className = "",
}: PlaceholderNoticeProps) {
  const toneClass =
    tone === "dark"
      ? "bg-white/5 border-white/10 text-slate-300"
      : "bg-amber-50 border-amber-200 text-amber-900";

  return (
    <p
      className={`inline-flex items-center gap-2 rounded-full border px-3.5 py-1.5 text-[12.5px] font-medium ${toneClass} ${className}`}
    >
      <Info className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
      <span>{message}</span>
    </p>
  );
}
