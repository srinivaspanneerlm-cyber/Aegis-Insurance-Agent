"use client";

import { cn } from "@aegis/utils";
import { STATUS_META, type DocumentStatus } from "../lib/types";

const TONE = {
  neutral: "border-line/60 text-content-secondary",
  info: "border-info/40 text-info",
  warning: "border-warning/40 text-warning",
  danger: "border-danger/40 text-danger",
  success: "border-success/40 text-success",
} as const;

/**
 * A document's status, in words a customer can act on.
 *
 * The tone is carried by the border and the text, never by colour alone — and
 * the label itself is the meaning ("Not accepted" rather than "REJECTED"), so a
 * colour-blind reader loses nothing.
 */
export function DocumentStatusBadge({
  status,
  className,
}: {
  status: DocumentStatus;
  className?: string;
}) {
  const meta = STATUS_META[status] ?? STATUS_META.UPLOADED;
  return (
    <span
      className={cn(
        "rounded-pill inline-flex items-center border px-2 py-0.5 text-[0.6875rem] font-semibold tracking-wide uppercase",
        TONE[meta.tone],
        className
      )}
      title={meta.meaning}
    >
      {meta.label}
    </span>
  );
}
