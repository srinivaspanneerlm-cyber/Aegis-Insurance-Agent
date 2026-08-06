"use client";

import { Icon, type IconName } from "@/components/Icon";
import { Stat } from "@/components/Cards";
import type { Metric } from "@/lib/platform";

/**
 * A figure, or an honest account of why there is not one.
 *
 * The two states render differently on purpose. A missing metric shown as a
 * dash reads as zero, and zero revenue is a very different claim from "the
 * platform does not record revenue". This makes the second one impossible to
 * mistake for the first, and names what would have to be captured — so the gap
 * is a backlog item rather than a shrug.
 */
export function MetricCard<T>({
  label,
  metric,
  render,
  icon,
  tone,
}: {
  label: string;
  metric: Metric<T>;
  render: (value: T) => { value: string | number; hint?: string };
  icon?: IconName;
  tone?: "neutral" | "warning" | "danger" | "success";
}) {
  if (!metric.available) {
    return (
      <div className="rounded-card border border-dashed border-line/50 bg-surface-raised/20 p-5">
        <div className="flex items-start justify-between gap-3">
          <p className="text-caption font-medium uppercase tracking-wide text-content-muted">
            {label}
          </p>
          <Icon name="eye" size={16} className="shrink-0 text-content-muted" />
        </div>
        <p className="mt-3 text-body font-semibold text-content-secondary">Not measured</p>
        <p className="mt-1 text-pretty text-caption text-content-muted">{metric.reason}</p>
        <p className="mt-2 text-pretty text-caption text-content-muted">
          <span className="font-medium">Needs:</span> {metric.needs}
        </p>
      </div>
    );
  }

  const { value, hint } = render(metric.value);
  return (
    <Stat
      label={label}
      value={value}
      {...(hint ? { hint } : {})}
      {...(tone ? { tone } : {})}
      {...(icon ? { icon } : {})}
    />
  );
}
