import type { ReactNode } from "react";
import Link from "next/link";
import { cn } from "@aegis/utils";
import { Icon, type IconName } from "@/components/ui/Icon";
import { Reveal } from "@/components/ui/Reveal";

export interface Feature {
  icon: IconName;
  title: string;
  description: ReactNode;
  /** Turns the whole card into a link. */
  href?: string;
  /** Short supporting points, rendered as a checklist. */
  points?: readonly string[];
  comingSoon?: boolean;
}

export interface FeatureGridProps {
  features: readonly Feature[];
  columns?: 2 | 3 | 4;
  className?: string;
}

const COLUMNS = {
  2: "sm:grid-cols-2",
  3: "sm:grid-cols-2 lg:grid-cols-3",
  4: "sm:grid-cols-2 lg:grid-cols-4",
} as const;

/**
 * The workhorse of the whole site: a grid of glass cards.
 *
 * The stagger is capped rather than proportional to the index. On a
 * twelve-card grid a per-card delay would leave the last one arriving a second
 * after the first, which stops reading as polish and starts reading as a slow
 * page.
 */
export function FeatureGrid({ features, columns = 3, className }: FeatureGridProps) {
  return (
    <ul className={cn("grid gap-4 sm:gap-5", COLUMNS[columns], className)}>
      {features.map((feature, index) => (
        <li key={feature.title} className="flex">
          <Reveal delay={Math.min(index, 5) * 60} className="flex w-full">
            <FeatureCard feature={feature} />
          </Reveal>
        </li>
      ))}
    </ul>
  );
}

function FeatureCard({ feature }: { feature: Feature }) {
  const body = (
    <>
      <div className="flex items-start justify-between gap-3">
        <span
          className={cn(
            "inline-flex h-11 w-11 items-center justify-center rounded-control",
            "border border-line/60 bg-surface-raised/60 text-brand"
          )}
        >
          <Icon name={feature.icon} size={22} />
        </span>
        {feature.comingSoon ? (
          <span className="shrink-0 rounded-pill border border-line/70 px-2.5 py-1 text-[0.6875rem] font-semibold uppercase tracking-wide text-content-muted">
            Coming soon
          </span>
        ) : null}
      </div>

      <h3 className="mt-5 text-h4 font-semibold text-content">{feature.title}</h3>
      <p className="mt-2 text-pretty text-body-sm text-content-secondary">{feature.description}</p>

      {feature.points?.length ? (
        <ul className="mt-4 flex flex-col gap-2">
          {feature.points.map((point) => (
            <li
              key={point}
              className="flex items-start gap-2.5 text-body-sm text-content-secondary"
            >
              <Icon name="check" size={16} className="mt-0.5 shrink-0 text-success" />
              <span>{point}</span>
            </li>
          ))}
        </ul>
      ) : null}

      {feature.href ? (
        <span className="mt-5 inline-flex items-center gap-1.5 text-body-sm font-semibold text-brand">
          Learn more
          <Icon name="arrowRight" size={16} />
        </span>
      ) : null}
    </>
  );

  const shell = cn(
    "flex h-full w-full flex-col rounded-panel p-6 glass glass-sheen",
    feature.href &&
      "focus-ring transition-transform duration-base ease-enter hover:-translate-y-1 motion-reduce:hover:translate-y-0"
  );

  return feature.href ? (
    <Link href={feature.href} className={shell}>
      {body}
    </Link>
  ) : (
    <div className={shell}>{body}</div>
  );
}
