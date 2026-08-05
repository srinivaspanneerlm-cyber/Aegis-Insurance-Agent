import type { Metadata, Viewport } from "next";
import { CONTACT, SITE, SOCIALS } from "@/lib/site";
import { organizationJsonLd } from "@/lib/seo";
import { SiteHeader } from "@/components/layout/SiteHeader";
import { SiteFooter } from "@/components/layout/SiteFooter";
import { Backdrop } from "@/components/ui/Backdrop";
import "@aegis/design-system/theme.css";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(SITE.url),
  title: {
    default: `${SITE.name} — ${SITE.tagline}`,
    // Every other page supplies only its own name.
    template: `%s — ${SITE.name}`,
  },
  description: SITE.description,
  applicationName: SITE.name,
  keywords: [
    "insurance platform",
    "enterprise insurance software",
    "health insurance",
    "motor insurance",
    "claims automation",
    "insurance India",
  ],
  authors: [{ name: SITE.legalName }],
  creator: SITE.legalName,
  openGraph: {
    type: "website",
    siteName: SITE.name,
    locale: SITE.locale,
    url: SITE.url,
    title: `${SITE.name} — ${SITE.tagline}`,
    description: SITE.description,
  },
  twitter: { card: "summary_large_image" },
  robots: { index: true, follow: true },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  // Pinch-zoom stays available. Disabling it is an accessibility failure for
  // anyone who needs to enlarge text — a large share of this audience.
  maximumScale: 5,
  themeColor: "#020617",
};

/**
 * The public site is dark, and only dark.
 *
 * The portals honour the customer's theme, because a person works inside them
 * for long stretches and that is their choice to make. A marketing site is a
 * first impression measured in seconds, and it should be one considered thing
 * rather than two half-considered ones. So `.dark` is written on the element
 * directly and no theme toggle is offered — which also means no theme script,
 * no flash of the wrong colours, and no client-side theme state at all.
 */
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body className="flex min-h-screen flex-col bg-canvas text-content antialiased">
        {/* First in the DOM, hidden until focused. Without it a keyboard user
            tabs the whole navigation on every page before reaching content. */}
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-toast focus:rounded-control focus:bg-brand focus:px-4 focus:py-2 focus:font-semibold focus:text-brand-fg"
        >
          Skip to content
        </a>

        <Backdrop />
        <SiteHeader />

        <main id="main" tabIndex={-1} className="flex-1 outline-none">
          {children}
        </main>

        <SiteFooter />

        {/* One authoritative description of the company, emitted once rather
            than repeated per page. Claims only a name, a description and ways
            to make contact — nothing we cannot substantiate. */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(
              organizationJsonLd({
                email: CONTACT.email,
                phone: CONTACT.phone,
                socials: SOCIALS,
              })
            ),
          }}
        />
      </body>
    </html>
  );
}
