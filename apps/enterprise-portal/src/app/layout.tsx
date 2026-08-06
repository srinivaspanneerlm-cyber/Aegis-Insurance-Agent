import type { Metadata, Viewport } from "next";
import { ConsoleProvider } from "@/context/ConsoleProvider";
import { ConsoleShell } from "@/components/ConsoleShell";
import "@aegis/design-system/theme.css";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "Enterprise Console — Aegis AI", template: "%s — Aegis Console" },
  description: "Aegis AI enterprise administration console.",
  // Internal software behind a session. An administration surface appearing in
  // search results is a finding, not a feature.
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  themeColor: "#020617",
};

/**
 * Quieter than the marketing site, like the employee workspace: no backdrop
 * wash, no glass on the chrome. Somebody reads this screen for hours, and the
 * decoration that makes a landing page feel considered makes a console tiring.
 */
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body className="bg-canvas text-content antialiased">
        <ConsoleProvider>
          <ConsoleShell>{children}</ConsoleShell>
        </ConsoleProvider>
      </body>
    </html>
  );
}
