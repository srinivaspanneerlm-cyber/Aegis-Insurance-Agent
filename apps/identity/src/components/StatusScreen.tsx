import Link from "next/link";
import { buttonVariants } from "@aegis/ui";
import { AuthShell } from "@/components/AuthShell";
import type { IconName } from "@/components/Icon";

export interface StatusAction {
  label: string;
  href: string;
  /** External destinations (a portal, the website) need a plain anchor. */
  external?: boolean;
  variant?: "primary" | "secondary";
}

export interface StatusScreenProps {
  icon: IconName;
  title: string;
  description: string;
  /** What actually happened, and what it means. Kept concrete. */
  detail?: string;
  actions: readonly StatusAction[];
}

/**
 * The shape shared by access-denied, unauthorized and session-expired.
 *
 * All three are the same event from the person's point of view — something
 * stopped them — and the useful difference is only in what to do next. Sharing
 * the frame is what keeps that difference legible rather than buried under
 * three slightly different apologies.
 *
 * Every one of them offers a way onward. A refusal with no next step is where
 * people give up on a product entirely.
 */
export function StatusScreen({ icon, title, description, detail, actions }: StatusScreenProps) {
  return (
    <AuthShell title={title} description={description} icon={icon}>
      <div className="flex flex-col gap-5">
        {detail ? (
          <p className="text-pretty rounded-control border border-line/50 bg-surface-raised/40 px-4 py-3 text-body-sm text-content-secondary">
            {detail}
          </p>
        ) : null}

        <div className="flex flex-col gap-2">
          {actions.map((action) =>
            action.external ? (
              <a
                key={action.href}
                href={action.href}
                className={buttonVariants({
                  variant: action.variant ?? "secondary",
                  size: "lg",
                  fullWidth: true,
                })}
              >
                {action.label}
              </a>
            ) : (
              <Link
                key={action.href}
                href={action.href}
                className={buttonVariants({
                  variant: action.variant ?? "secondary",
                  size: "lg",
                  fullWidth: true,
                })}
              >
                {action.label}
              </Link>
            )
          )}
        </div>
      </div>
    </AuthShell>
  );
}
