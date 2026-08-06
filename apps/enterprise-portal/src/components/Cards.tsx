"use client";

import { cn } from "@aegis/utils";
import { Icon, type IconName } from "@/components/Icon";

/**
 * The enterprise card vocabulary.
 *
 * Four shapes, defined once. A dashboard is mostly the same rectangle repeated,
 * and letting each section invent its own padding and border is how a screen
 * ends up looking assembled rather than designed.
 */

export function Panel({
  title,
  action,
  children,
  className,
}: {
  title: string;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section
      className={cn(
        "flex flex-col rounded-card border border-line/50 bg-surface-raised/30",
        className
      )}
    >
      <header className="flex items-center justify-between gap-3 border-b border-line/50 px-5 py-3.5">
        <h2 className="text-body-sm font-semibold text-content">{title}</h2>
        {action}
      </header>
      <div className="flex-1 p-5">{children}</div>
    </section>
  );
}

/**
 * A single number.
 *
 * `tone` marks the ones that mean something is wrong. Colour alone would fail a
 * colour-blind reader, so the tone also changes the label — "overdue" reads as
 * a problem in plain text.
 */
export function Stat({
  label,
  value,
  hint,
  tone = "neutral",
  icon,
}: {
  label: string;
  value: string | number;
  hint?: string;
  tone?: "neutral" | "warning" | "danger" | "success";
  icon?: IconName;
}) {
  const toneClass = {
    neutral: "text-content",
    warning: "text-warning",
    danger: "text-danger",
    success: "text-success",
  }[tone];

  return (
    <div className="rounded-card border border-line/50 bg-surface-raised/30 p-5">
      <div className="flex items-start justify-between gap-3">
        <p className="text-caption font-medium uppercase tracking-wide text-content-muted">
          {label}
        </p>
        {icon ? <Icon name={icon} size={16} className="shrink-0 text-content-muted" /> : null}
      </div>
      <p className={cn("mt-3 text-h1 font-bold tabular-nums", toneClass)}>{value}</p>
      {hint ? <p className="mt-1 text-caption text-content-muted">{hint}</p> : null}
    </div>
  );
}

/** A short status word. Never colour alone — the word carries the meaning. */
export function Badge({
  children,
  tone = "neutral",
}: {
  children: React.ReactNode;
  tone?: "neutral" | "info" | "warning" | "danger" | "success";
}) {
  const toneClass = {
    neutral: "border-line/60 text-content-secondary",
    info: "border-info/40 text-info",
    warning: "border-warning/40 text-warning",
    danger: "border-danger/40 text-danger",
    success: "border-success/40 text-success",
  }[tone];

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-pill border px-2 py-0.5 text-[0.6875rem] font-semibold uppercase tracking-wide",
        toneClass
      )}
    >
      {children}
    </span>
  );
}

/**
 * What a panel shows when it has nothing to show.
 *
 * Named and required rather than optional, because "no data" rendered as a
 * blank rectangle is indistinguishable from a component that failed — and an
 * employee cannot tell which, so they refresh and lose their place.
 */
export function Empty({
  icon = "check",
  children,
}: {
  icon?: IconName;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center gap-2 py-8 text-center">
      <Icon name={icon} size={22} className="text-content-muted" />
      <p className="max-w-xs text-pretty text-body-sm text-content-secondary">{children}</p>
    </div>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div aria-hidden="true" className={cn("rounded-pill bg-surface-raised/50", className)} />;
}
