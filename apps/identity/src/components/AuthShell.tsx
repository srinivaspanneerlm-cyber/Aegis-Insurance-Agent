import Link from "next/link";
import type { ReactNode } from "react";
import { cn } from "@aegis/utils";
import { Wordmark } from "@/components/Wordmark";
import { Icon, type IconName } from "@/components/Icon";
import { WEBSITE_URL } from "@/lib/identity";

export interface AuthShellProps {
  title: string;
  description?: ReactNode;
  /** Small label above the title — usually which portal this is for. */
  eyebrow?: string;
  icon?: IconName;
  children: ReactNode;
  /** Links under the card: "no account?", "back to sign in", and so on. */
  footer?: ReactNode;
  /** Widens the card for the register form, which has more fields. */
  width?: "default" | "wide";
}

/**
 * The frame every authentication screen shares.
 *
 * Centred, single-column and narrow on purpose. This is the one place in the
 * product where a person has exactly one thing to do, and anything else on the
 * page is a way to fail at it — so there is no navigation, no marketing, and
 * one route out, back to the public site.
 */
export function AuthShell({
  title,
  description,
  eyebrow,
  icon,
  children,
  footer,
  width = "default",
}: AuthShellProps) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-4 py-12 sm:px-6">
      <a
        href={WEBSITE_URL}
        className="focus-ring mb-8 inline-flex items-center gap-2.5 rounded-control px-2 py-1"
      >
        <Wordmark />
        <span className="sr-only">Back to the Aegis AI website</span>
      </a>

      <main id="main" className={cn("w-full", width === "wide" ? "max-w-lg" : "max-w-md")}>
        <div className="rounded-panel p-6 glass glass-sheen sm:p-8">
          <div className="flex flex-col items-center text-center">
            {icon ? (
              <span className="mb-5 inline-flex h-12 w-12 items-center justify-center rounded-control border border-line/60 bg-surface-raised/60 text-brand">
                <Icon name={icon} size={22} />
              </span>
            ) : null}

            {eyebrow ? (
              <p className="mb-2 text-overline font-semibold uppercase text-brand">{eyebrow}</p>
            ) : null}

            <h1 className="text-balance text-h2 font-bold tracking-tight text-content">{title}</h1>

            {description ? (
              <div className="mt-3 text-pretty text-body-sm text-content-secondary">
                {description}
              </div>
            ) : null}
          </div>

          <div className="mt-7">{children}</div>
        </div>

        {footer ? (
          <div className="mt-6 text-center text-body-sm text-content-secondary">{footer}</div>
        ) : null}
      </main>

      <p className="mt-10 text-center text-caption text-content-muted">
        <Link href="/" className="focus-ring rounded hover:text-content">
          Choose a different portal
        </Link>
      </p>
    </div>
  );
}
