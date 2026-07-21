import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

interface EmptyStateProps {
  /** Icon element (e.g. a lucide icon). Rendered in a muted token circle. */
  icon?: ReactNode;
  title: string;
  description?: ReactNode;
  /** Optional call-to-action, typically a <Button>. */
  action?: ReactNode;
  className?: string;
}

/**
 * Placeholder for an empty list / no-results / nothing-yet surface. Gives the
 * user a calm explanation and an optional next step instead of a blank panel —
 * part of the Step 4.2.2 state-coverage work this primitive seeds.
 */
export function EmptyState({ icon, title, description, action, className }: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center text-center gap-3 py-12 px-6",
        className,
      )}
    >
      {icon && (
        <div className="w-12 h-12 rounded-2xl bg-surface-sunken text-content-subtle flex items-center justify-center">
          {icon}
        </div>
      )}
      <div className="space-y-1">
        <h3 className="text-sm font-black text-content">{title}</h3>
        {description && (
          <p className="text-xs font-semibold text-content-muted max-w-sm">{description}</p>
        )}
      </div>
      {action && <div className="mt-1">{action}</div>}
    </div>
  );
}
