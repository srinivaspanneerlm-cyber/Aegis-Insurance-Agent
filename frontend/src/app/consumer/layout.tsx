import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Aegis Consumer",
  description:
    "Free insurance guidance from Aegis. Understand your cover, check when it runs out, and get help renewing it.",
};

export default function ConsumerLayout({ children }: { children: React.ReactNode }) {
  return children;
}
