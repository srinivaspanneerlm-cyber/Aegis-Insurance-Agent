import type { Metadata } from "next";

/**
 * Exists only to name the page.
 *
 * The screen itself is a client component, and a client component cannot export
 * metadata — so the title has to come from a server layout wrapped around it.
 * This one renders its children unchanged and adds nothing else.
 */
export const metadata: Metadata = { title: "AI Advisor" };

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
