import type { Metadata, Viewport } from "next";
import {
  AppLayout,
  Footer,
  Navbar,
  ThemeProvider,
  ToastProvider,
  themeInitScript,
} from "@aegis/ui";
import "@aegis/design-system/theme.css";
import "./globals.css";

export const metadata: Metadata = {
  title: "Aegis \u2014 Your Account",
  description: "Your policies, claims and documents.",
};

export const viewport: Viewport = {
  // Pinch-zoom stays available. Disabling it is an accessibility failure for
  // anyone who needs to enlarge text — which is a large share of this audience.
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* Runs before first paint so the correct theme is already applied.
            `suppressHydrationWarning` above is required because this script
            mutates <html> before React sees it — that mismatch is intended. */}
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body>
        <ThemeProvider>
          <ToastProvider>
            <AppLayout
              header={<Navbar brand={<span>Aegis \u2014 Your Account</span>} />}
              footer={<Footer />}
            >
              {children}
            </AppLayout>
          </ToastProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
