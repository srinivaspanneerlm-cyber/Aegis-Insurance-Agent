import type { Metadata, Viewport } from "next";
import { ConsoleProvider } from "@/context/ConsoleProvider";
import { ConsoleShell } from "@/components/ConsoleShell";
import "@aegis/design-system/theme.css";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "Platform Console — Aegis AI", template: "%s — Aegis Platform" },
  description: "Aegis AI platform administration.",
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  themeColor: "#020617",
};

/**
 * The operator's console.
 *
 * Same restraint as the other internal surfaces: no backdrop, no glass on the
 * chrome. Somebody reads this during an incident, and decoration is the last
 * thing that helps at three in the morning.
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
