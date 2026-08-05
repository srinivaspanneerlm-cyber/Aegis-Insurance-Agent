import type { Metadata, Viewport } from "next";
import { Suspense } from "react";
import { IdentityProvider } from "@/context/IdentityProvider";
import { Backdrop } from "@/components/Backdrop";
import "@aegis/design-system/theme.css";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "Sign in — Aegis AI", template: "%s — Aegis AI" },
  description: "Sign in to Aegis AI.",
  // An authentication surface has nothing to offer a search engine, and every
  // page here is either a form or a message about somebody's own session.
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  themeColor: "#020617",
};

/**
 * Dark, like the public site, and for the same reason: the identity platform is
 * the seam between the website and the portals, and a theme change at the seam
 * reads as having landed somewhere else entirely.
 */
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body className="bg-canvas text-content antialiased">
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-toast focus:rounded-control focus:bg-brand focus:px-4 focus:py-2 focus:font-semibold focus:text-brand-fg"
        >
          Skip to content
        </a>
        <Backdrop />
        <IdentityProvider>
          {/* Pages read their search params on the server and hand them down as
              props, so this boundary no longer gates the markup — it is here for
              the streaming of client form bundles only. An earlier version read
              `useSearchParams` inside the pages, which opted the whole subtree
              out of prerendering and served an empty document. */}
          <Suspense fallback={null}>{children}</Suspense>
        </IdentityProvider>
      </body>
    </html>
  );
}
