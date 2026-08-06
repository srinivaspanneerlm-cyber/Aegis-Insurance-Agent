"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { cn } from "@aegis/utils";
import { Icon, type IconName } from "@/components/Icon";
import { Wordmark } from "@/components/Wordmark";
import { useConsole } from "@/context/ConsoleProvider";
import { NAVIGATION, SIGN_IN_URL } from "@/lib/console";

/**
 * The frame every workspace screen sits in.
 *
 * A persistent left rail rather than a top bar, because this is software
 * somebody has open all day and moves around inside constantly — the cost of a
 * fixed 260px is paid once and saves a click every time. Below `lg` it
 * collapses, since a rail on a phone is most of the screen.
 */
export function ConsoleShell({ children }: { children: React.ReactNode }) {
  const { phase, session, message, can, signOut } = useConsole();
  const [navOpen, setNavOpen] = useState(false);
  const pathname = usePathname();

  if (phase === "checking") return <Splash label="Opening the console…" />;

  if (phase === "error") {
    return (
      <Splash
        icon="close"
        title="We could not open the console"
        label={message}
        action={{ label: "Sign out", onClick: signOut }}
      />
    );
  }

  return (
    <div className="flex min-h-screen bg-canvas text-content">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-toast focus:rounded-control focus:bg-brand focus:px-4 focus:py-2 focus:font-semibold focus:text-brand-fg"
      >
        Skip to content
      </a>

      {/* The rail. `hidden lg:flex` rather than unmounting, so the nav is in the
          DOM for a screen reader on every viewport. */}
      <nav
        aria-label="Console"
        className={cn(
          "fixed inset-y-0 left-0 z-sticky w-[260px] shrink-0 flex-col border-r border-line/50 bg-surface-sunken/40",
          "lg:sticky lg:top-0 lg:flex lg:h-screen",
          navOpen ? "flex" : "hidden"
        )}
      >
        <div className="flex h-16 items-center gap-2.5 border-b border-line/50 px-5">
          <Wordmark />
        </div>

        <div className="flex-1 overflow-y-auto px-3 py-4">
          {NAVIGATION.map((group) => {
            const visible = group.items.filter((item) => !item.permission || can(item.permission));
            if (visible.length === 0) return null;
            return (
              <div key={group.title} className="mb-6">
                <h2 className="mb-2 px-3 text-caption font-semibold uppercase tracking-wide text-content-muted">
                  {group.title}
                </h2>
                <ul className="flex flex-col gap-0.5">
                  {visible.map((item) => {
                    const current = pathname === item.href;
                    return (
                      <li key={item.href}>
                        <Link
                          href={item.href}
                          aria-current={current ? "page" : undefined}
                          onClick={() => setNavOpen(false)}
                          className={cn(
                            "focus-ring flex min-h-10 items-center gap-3 rounded-control px-3 py-2 text-body-sm",
                            "transition-colors duration-fast",
                            current
                              ? "bg-surface-raised font-medium text-content"
                              : "text-content-secondary hover:bg-surface-raised/50 hover:text-content"
                          )}
                        >
                          <Icon name={item.icon as IconName} size={17} className="shrink-0" />
                          <span className="flex-1 truncate">{item.label}</span>
                          {item.comingSoon ? (
                            <span className="text-[0.625rem] font-semibold uppercase text-content-muted">
                              Soon
                            </span>
                          ) : null}
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </div>
            );
          })}
        </div>

        <div className="border-t border-line/50 p-3">
          <button
            type="button"
            onClick={signOut}
            className="focus-ring flex min-h-10 w-full items-center gap-3 rounded-control px-3 py-2 text-body-sm text-content-secondary transition-colors hover:bg-surface-raised/50 hover:text-content"
          >
            <Icon name="lock" size={17} />
            Sign out
          </button>
        </div>
      </nav>

      {navOpen ? (
        <button
          type="button"
          aria-label="Close navigation"
          onClick={() => setNavOpen(false)}
          className="fixed inset-0 z-overlay bg-overlay/60 lg:hidden"
        />
      ) : null}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-sticky flex h-16 items-center gap-4 border-b border-line/50 bg-canvas/80 px-4 backdrop-blur sm:px-6">
          <button
            type="button"
            aria-expanded={navOpen}
            onClick={() => setNavOpen((v) => !v)}
            className="focus-ring -ml-1 inline-flex h-10 w-10 items-center justify-center rounded-control text-content-secondary hover:text-content lg:hidden"
          >
            <Icon name={navOpen ? "close" : "menu"} size={20} />
            <span className="sr-only">{navOpen ? "Close navigation" : "Open navigation"}</span>
          </button>

          <EnterpriseSearch />

          <div className="ml-auto flex items-center gap-3">
            {session ? (
              <div className="hidden text-right sm:block">
                <p className="text-body-sm font-medium leading-tight text-content">
                  {session.user.name}
                </p>
                <p className="text-caption leading-tight text-content-muted">
                  Enterprise administrator
                </p>
              </div>
            ) : null}
            <span
              aria-hidden="true"
              className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-surface-raised text-body-sm font-semibold text-content-secondary"
            >
              {(session?.user.name ?? "?").charAt(0).toUpperCase()}
            </span>
          </div>
        </header>

        <main id="main" tabIndex={-1} className="flex-1 px-4 py-6 outline-none sm:px-6 lg:px-8">
          {children}
        </main>
      </div>
    </div>
  );
}

/**
 * Enterprise search.
 *
 * A real form that navigates, not a decorative box. It searches the audit
 * trail, which is the one index that spans the whole estate — every login,
 * role change, approval and configuration change lands there. Wiring it to a
 * cross-entity search that does not exist would be worse than not having it.
 */
function EnterpriseSearch() {
  return (
    <form action="/audit" method="get" className="max-w-md flex-1">
      <label htmlFor="console-search" className="sr-only">
        Search the audit trail
      </label>
      <div className="relative">
        <Icon
          name="search"
          size={16}
          className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-content-muted"
        />
        <input
          id="console-search"
          name="action"
          type="search"
          placeholder="Search audit events — auth.login, workflow.step, admin.report"
          className="h-10 w-full rounded-control border border-line/60 bg-surface-raised/40 pl-9 pr-3 text-body-sm text-content transition-colors placeholder:text-content-muted focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/40"
        />
      </div>
    </form>
  );
}

function Splash({
  icon = "compass",
  title,
  label,
  action,
}: {
  icon?: IconName;
  title?: string;
  label: string;
  action?: { label: string; onClick: () => void };
}) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-canvas px-6 text-center">
      <Wordmark />
      <span className="mt-4 inline-flex h-12 w-12 items-center justify-center rounded-control border border-line/60 bg-surface-raised/60 text-content-muted">
        <Icon name={icon} size={22} />
      </span>
      {title ? <h1 className="text-h3 font-semibold text-content">{title}</h1> : null}
      <p role="status" className="max-w-md text-pretty text-body-sm text-content-secondary">
        {label}
      </p>
      {action ? (
        <button
          type="button"
          onClick={action.onClick}
          className="focus-ring mt-2 rounded-control border border-line bg-surface-raised px-5 py-2.5 text-body-sm font-semibold text-content transition-colors hover:border-line-strong"
        >
          {action.label}
        </button>
      ) : (
        <a href={SIGN_IN_URL} className="sr-only">
          Sign in
        </a>
      )}
    </div>
  );
}
