"use client";

import { cn } from "@aegis/utils";
import { Button } from "@aegis/ui";
import { Icon, type IconName } from "@/components/Icon";
import type { PortalOption } from "@/lib/api";

export interface PortalCardProps {
  portal: PortalOption;
  /** True while this particular card's Continue is in flight. */
  entering: boolean;
  /** True while any card is in flight — the others stop accepting clicks. */
  busy: boolean;
  onContinue: (portal: PortalOption) => void;
}

/**
 * The icon comes from the server as a name, and is resolved to a glyph here.
 *
 * Falling back rather than throwing: a portal added server-side with an icon
 * this build does not know should render a neutral square, not crash the only
 * page standing between somebody and their work.
 */
const ICONS: Record<string, IconName> = {
  users: "users",
  briefcase: "briefcase",
  building: "building",
  layers: "layers",
};

/**
 * One workspace on the gateway.
 *
 * A closed workspace is rendered as a `<div>`, not a disabled link or button.
 * There is nothing to activate — it carries no destination, because the server
 * never sent one — and presenting it as an interactive control that refuses is
 * both a lie to a sighted user and a tab stop that wastes a keyboard user's
 * time.
 */
export function PortalCard({ portal, entering, busy, onContinue }: PortalCardProps) {
  const icon = ICONS[portal.icon] ?? "shield";

  return (
    <div
      className={cn(
        "flex h-full flex-col rounded-panel p-6",
        portal.entitled
          ? "transition-transform duration-base ease-enter glass glass-sheen hover:-translate-y-1 motion-reduce:hover:translate-y-0"
          : "border border-dashed border-line/40 bg-surface-raised/20"
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <span
          className={cn(
            "inline-flex h-12 w-12 items-center justify-center rounded-control border",
            portal.entitled
              ? "border-line/60 bg-surface-raised/60 text-brand"
              : "border-line/40 text-content-muted"
          )}
        >
          <Icon name={icon} size={24} />
        </span>

        {portal.entitled ? (
          <span className="inline-flex items-center gap-1.5 rounded-pill border border-success/40 px-2.5 py-1 text-[0.6875rem] font-semibold uppercase tracking-wide text-success">
            <span className="h-1.5 w-1.5 rounded-full bg-success" aria-hidden="true" />
            Your workspace
          </span>
        ) : (
          <span className="inline-flex items-center gap-1.5 rounded-pill border border-line/50 px-2.5 py-1 text-[0.6875rem] font-semibold uppercase tracking-wide text-content-muted">
            <Icon name="lock" size={11} />
            No access
          </span>
        )}
      </div>

      <h2
        className={cn(
          "mt-5 text-h4 font-semibold",
          portal.entitled ? "text-content" : "text-content-secondary"
        )}
      >
        {portal.name}
      </h2>
      <p className="mt-2 text-pretty text-body-sm text-content-secondary">{portal.description}</p>

      <div className="mt-auto pt-6">
        {portal.entitled ? (
          <Button
            size="lg"
            fullWidth
            loading={entering}
            disabled={busy && !entering}
            onClick={() => onContinue(portal)}
          >
            {entering ? "Opening…" : "Continue"}
          </Button>
        ) : (
          <p className="text-caption text-content-muted">
            Your account is not set up for this workspace.
          </p>
        )}
      </div>
    </div>
  );
}
