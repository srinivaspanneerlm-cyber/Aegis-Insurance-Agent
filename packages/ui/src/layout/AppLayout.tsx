import type { ReactNode } from "react";
import { cn } from "@aegis/utils";

export interface AppLayoutProps {
  header?: ReactNode;
  footer?: ReactNode;
  children: ReactNode;
  /** Constrains the main column; off for dashboards that manage their own grid. */
  contained?: boolean;
  className?: string;
}

/**
 * The page frame every app shares: header, main, footer, in a column that fills
 * the viewport so a short page still pins its footer to the bottom.
 *
 * The skip link is the part that matters and the part most often missing. A
 * keyboard user landing on a page otherwise tabs through the entire navigation
 * before reaching the content — on every single page. One link, first in the
 * DOM, hidden until focused, removes that.
 */
export function AppLayout({
  header,
  footer,
  children,
  contained = true,
  className,
}: AppLayoutProps) {
  return (
    <div className={cn("bg-canvas text-content flex min-h-screen flex-col", className)}>
      <a
        href="#main"
        className="focus:z-toast focus:rounded-control focus:bg-brand focus:text-brand-fg sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:px-4 focus:py-2"
      >
        Skip to content
      </a>

      {header}

      <main id="main" tabIndex={-1} className="flex-1 outline-none">
        {contained ? (
          <div className="px-gutter py-section mx-auto w-full max-w-7xl">{children}</div>
        ) : (
          children
        )}
      </main>

      {footer}
    </div>
  );
}
