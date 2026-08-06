import type { Metadata, Viewport } from "next";
import { WorkspaceProvider } from "@/context/WorkspaceProvider";
import { WorkspaceShell } from "@/components/WorkspaceShell";
import "@aegis/design-system/theme.css";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "Employee Workspace — Aegis AI", template: "%s — Aegis Workspace" },
  description: "Aegis AI employee workspace.",
  // Internal software behind a session. There is nothing here for a crawler,
  // and a staff surface appearing in search results is a finding, not a feature.
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  themeColor: "#020617",
};

/**
 * Dark, like the rest of the platform, and deliberately quieter than the
 * marketing site: no backdrop wash, no glass on the chrome. This is software
 * somebody looks at for eight hours, and the decoration that makes a landing
 * page feel considered makes a work surface feel tiring.
 *
 * The guard lives in `WorkspaceProvider`, wrapping every screen. A page-level
 * check is one somebody can forget to add, and that failure is silent.
 */
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body className="bg-canvas text-content antialiased">
        <WorkspaceProvider>
          <WorkspaceShell>{children}</WorkspaceShell>
        </WorkspaceProvider>
      </body>
    </html>
  );
}
