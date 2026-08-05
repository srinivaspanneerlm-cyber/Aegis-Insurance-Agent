"use client";

import type { ReactNode } from "react";
import { cn } from "@aegis/utils";
import { useTheme } from "../providers/ThemeProvider";

export interface NavItem {
  label: string;
  href: string;
  /** Marks the current page for both styling and assistive tech. */
  current?: boolean;
}

export interface NavbarProps {
  /** Wordmark or logo — each app supplies its own. */
  brand: ReactNode;
  items?: readonly NavItem[];
  /** Sign-in button, account menu, whatever the app puts on the right. */
  actions?: ReactNode;
  className?: string;
}

/**
 * The shared top bar.
 *
 * Takes its content as props rather than reaching for a router or a session,
 * because this package is used by five apps with different routing and two
 * different kinds of principal. Keeping it presentational is what lets it be
 * shared at all — the moment it imports `next/navigation` it stops being
 * testable in isolation and starts dictating how apps must be built.
 */
export function Navbar({ brand, items = [], actions, className }: NavbarProps) {
  return (
    <header
      className={cn("z-sticky sticky top-0 w-full", "glass border-line/60 border-b", className)}
    >
      <nav
        aria-label="Main"
        className="px-gutter mx-auto flex h-16 w-full max-w-7xl items-center gap-6"
      >
        <div className="text-content flex items-center gap-2 font-bold">{brand}</div>

        {items.length > 0 ? (
          <ul className="hidden items-center gap-1 md:flex">
            {items.map((item) => (
              <li key={item.href}>
                <a
                  href={item.href}
                  aria-current={item.current ? "page" : undefined}
                  className={cn(
                    "focus-ring rounded-control text-body-sm px-3 py-2 font-medium",
                    "duration-fast ease-enter transition-colors",
                    item.current
                      ? "bg-surface-sunken text-content"
                      : "text-content-secondary hover:text-content"
                  )}
                >
                  {item.label}
                </a>
              </li>
            ))}
          </ul>
        ) : null}

        <div className="ml-auto flex items-center gap-2">
          <ThemeToggle />
          {actions}
        </div>
      </nav>
    </header>
  );
}

/**
 * Three states, not two.
 *
 * A binary toggle silently overrides the operating-system preference the first
 * time it is touched, and there is then no way back to "follow my device". The
 * cycle keeps that option reachable.
 */
export function ThemeToggle() {
  const { theme, setTheme } = useTheme();

  const next = theme === "light" ? "dark" : theme === "dark" ? "system" : "light";
  const labels = { light: "Light", dark: "Dark", system: "System" } as const;

  return (
    <button
      type="button"
      onClick={() => setTheme(next)}
      aria-label={`Theme: ${labels[theme]}. Switch to ${labels[next]}.`}
      className="focus-ring h-control-sm rounded-control border-line text-caption text-content-secondary duration-fast hover:text-content border px-3 font-semibold transition-colors"
    >
      {labels[theme]}
    </button>
  );
}
