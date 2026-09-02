"use client";

import Link from "next/link";
import { ArrowRight, Clock } from "lucide-react";
import { cn } from "@/lib/cn";
import type { QuickAction } from "@/lib/consumer/quickActions";

/**
 * One quick action.
 *
 * Sized for a thumb rather than a cursor. The whole card is the target — not an
 * arrow in the corner — because the people this is for are often on a small
 * phone, sometimes with poor eyesight, and a small hit area is the difference
 * between a product that works and one that is merely present.
 *
 * A card that is not ready renders as a `div`, not a disabled link. A disabled
 * anchor is still focusable in some browsers and still announced as a link,
 * which promises a destination that does not exist; a div with the pending
 * label simply is what it says it is.
 */
export function QuickActionCard({ action }: { action: QuickAction }) {
  const Icon = action.icon;

  // Generous vertical space and a large tap target. 112px comfortably clears
  // the 44px minimum on every axis, including for someone whose hands shake.
  const shell =
    "group relative flex min-h-[112px] w-full items-start gap-4 rounded-4xl border p-5 text-left transition-all";

  const body = (
    <>
      <span
        className={cn(
          "flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl transition-colors",
          action.state === "ready"
            ? "bg-brand/10 text-brand group-hover:bg-brand/15"
            : "bg-surface-sunken text-content-subtle"
        )}
      >
        <Icon className="h-6 w-6" aria-hidden="true" />
      </span>

      <span className="flex min-w-0 flex-1 flex-col gap-1.5">
        <span className="flex items-center gap-2">
          {/* 16px, not the 10–12px uppercase used across the staff surfaces.
              This screen is read by people for whom small type is a barrier. */}
          <span className="text-base font-bold leading-snug text-content">{action.label}</span>
          {action.state === "ready" && (
            <ArrowRight
              className="h-4 w-4 shrink-0 text-content-subtle transition-transform group-hover:translate-x-0.5"
              aria-hidden="true"
            />
          )}
        </span>

        <span className="text-sm font-medium leading-relaxed text-content-muted">
          {action.description}
        </span>

        {action.state === "next" && action.pending && (
          <span className="mt-1 inline-flex items-center gap-1.5 text-xs font-semibold text-content-subtle">
            <Clock className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            {action.pending}
          </span>
        )}
      </span>
    </>
  );

  if (action.state === "ready" && action.href) {
    return (
      <Link
        href={action.href}
        data-testid={`quick-action-${action.id}`}
        className={cn(
          shell,
          "border-line bg-surface-raised shadow-elevation-1",
          "hover:border-brand/40 hover:shadow-elevation-2 active:scale-[0.99]"
        )}
      >
        {body}
      </Link>
    );
  }

  return (
    <div
      data-testid={`quick-action-${action.id}`}
      // Announced as unavailable rather than silently inert. Someone using a
      // screen reader gets the same information a sighted user gets from the
      // muted styling and the "available in" line.
      aria-disabled="true"
      className={cn(shell, "border-dashed border-line bg-surface-sunken/40")}
    >
      {body}
    </div>
  );
}
