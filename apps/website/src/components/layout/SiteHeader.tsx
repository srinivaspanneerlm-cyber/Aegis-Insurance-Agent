"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useId, useRef, useState } from "react";
import { cn } from "@aegis/utils";
import { buttonVariants } from "@aegis/ui";
import { PRIMARY_NAV, SITE } from "@/lib/site";
import { Icon } from "@/components/ui/Icon";
import { Wordmark } from "@/components/layout/Wordmark";

/**
 * The public site's top bar.
 *
 * Not the shared `Navbar` from `@aegis/ui`, and the difference is intentional.
 * That one is built for a signed-in application: it carries a theme toggle and
 * an account slot. A marketing header has a different job — one clear next
 * action, repeated — and mixing the two would either bloat the shared component
 * with props no portal wants or leave a theme control on a page that is
 * deliberately dark.
 */
export function SiteHeader() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const menuId = useId();
  const toggleRef = useRef<HTMLButtonElement>(null);

  // The header starts transparent over the hero and gains its glass as soon as
  // the page moves, so the first impression is the content rather than chrome.
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // A menu left open across a navigation covers the page the visitor just asked
  // for, which on a phone reads as the site being broken.
  useEffect(() => setOpen(false), [pathname]);

  // Escape closes it, and focus goes back to the control that opened it —
  // otherwise a keyboard user is returned to the top of the document.
  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
        toggleRef.current?.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  const isCurrent = (href: string) => pathname === href || pathname.startsWith(`${href}/`);

  return (
    <header
      className={cn(
        "sticky top-0 z-sticky w-full",
        "transition-all duration-base ease-enter",
        scrolled || open
          ? "border-b border-line/40 glass"
          : "border-b border-transparent bg-transparent"
      )}
    >
      <nav aria-label="Main" className="mx-auto w-full max-w-7xl px-gutter">
        <div className="sm:h-18 flex h-16 items-center gap-4">
          <Link
            href="/"
            className="focus-ring -ml-1 flex items-center gap-2.5 rounded-control px-1 py-1"
            aria-label={`${SITE.name} — home`}
          >
            <Wordmark />
          </Link>

          <ul className="ml-2 hidden items-center gap-0.5 lg:flex">
            {PRIMARY_NAV.map((item) => (
              <li key={item.href}>
                <Link
                  href={item.href}
                  aria-current={isCurrent(item.href) ? "page" : undefined}
                  className={cn(
                    "focus-ring rounded-control px-3 py-2 text-body-sm font-medium",
                    "transition-colors duration-fast ease-enter",
                    isCurrent(item.href)
                      ? "bg-surface-raised/60 text-content"
                      : "text-content-secondary hover:bg-surface-raised/40 hover:text-content"
                  )}
                >
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>

          <div className="ml-auto flex items-center gap-2">
            <Link
              href="/request-demo"
              className={cn(
                buttonVariants({ variant: "ghost", size: "md" }),
                "hidden sm:inline-flex"
              )}
            >
              Request a demo
            </Link>
            <Link
              href="/get-started"
              className={cn(
                buttonVariants({ variant: "primary", size: "md" }),
                "hidden sm:inline-flex"
              )}
            >
              Get started
            </Link>

            <button
              ref={toggleRef}
              type="button"
              onClick={() => setOpen((v) => !v)}
              aria-expanded={open}
              aria-controls={menuId}
              className="focus-ring -mr-1 inline-flex h-11 w-11 items-center justify-center rounded-control text-content-secondary transition-colors hover:bg-surface-raised/50 hover:text-content lg:hidden"
            >
              <Icon name={open ? "close" : "menu"} size={22} />
              <span className="sr-only">{open ? "Close menu" : "Open menu"}</span>
            </button>
          </div>
        </div>

        {/* Rendered rather than unmounted so the close animation can play, but
            hidden from assistive tech and taken out of the tab order when shut. */}
        <div id={menuId} hidden={!open} className="border-t border-line/40 py-4 lg:hidden">
          <ul className="flex flex-col gap-1">
            {PRIMARY_NAV.map((item) => (
              <li key={item.href}>
                <Link
                  href={item.href}
                  aria-current={isCurrent(item.href) ? "page" : undefined}
                  className={cn(
                    "focus-ring flex min-h-11 flex-col justify-center rounded-control px-3 py-2",
                    isCurrent(item.href)
                      ? "bg-surface-raised/60 text-content"
                      : "text-content-secondary hover:text-content"
                  )}
                >
                  <span className="text-body font-medium">{item.label}</span>
                  {item.description ? (
                    <span className="text-caption text-content-muted">{item.description}</span>
                  ) : null}
                </Link>
              </li>
            ))}
          </ul>

          <div className="mt-4 flex flex-col gap-2">
            <Link
              href="/get-started"
              className={buttonVariants({ variant: "primary", size: "lg", fullWidth: true })}
            >
              Get started
            </Link>
            <Link
              href="/request-demo"
              className={buttonVariants({ variant: "secondary", size: "lg", fullWidth: true })}
            >
              Request a demo
            </Link>
          </div>
        </div>
      </nav>
    </header>
  );
}
