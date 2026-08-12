import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
});

export const metadata: Metadata = {
  // Internally this application is the Aegis Customer Portal: the customer-
  // facing half of the platform. Staff tooling lives in the separate Enterprise
  // Admin application, against the same backend.
  // Every screen inherited this one string, so ten open tabs were ten identical
  // labels and a bookmark said nothing about what had been bookmarked. Pages
  // supply their own segment through the template; the default still covers the
  // home page and anything that has not named itself yet.
  title: {
    default: "Aegis Customer Portal | AI-Powered Family Protection & Insurance Advisor",
    template: "%s | Aegis Customer Portal",
  },
  applicationName: "Aegis Customer Portal",
  description: "Understand insurance before you buy it. Aegis pairs specialist AI advisors with a curated catalogue of health, motor, travel and home policies, and explains each recommendation in plain language.",
  keywords: "insurance, AI advisor, health insurance, term life, vehicle insurance, family protection, premium fintech",
};

import { MotionConfig } from "framer-motion";
import { AuthProvider } from "@/context/AuthContext";
import { ThemeProvider } from "@/context/ThemeContext";
import FloatingAI from "@/components/FloatingAI";
import { Toaster } from "@/components/shared/Toaster";
import WebVitalsReporter from "@/components/WebVitalsReporter";

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="scroll-smooth">
      <body
        className={`${inter.variable} font-sans antialiased`}
      >
        <a href="#main-content" className="skip-link">Skip to main content</a>
        <ThemeProvider>
          <AuthProvider>
            {/* reducedMotion="user" makes framer-motion honour the OS setting,
                complementing the CSS catch-all in globals.css. */}
            <MotionConfig reducedMotion="user">
              {children}
              <FloatingAI />
              <Toaster />
              <WebVitalsReporter />
            </MotionConfig>
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
