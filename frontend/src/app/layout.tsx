import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
});

export const metadata: Metadata = {
  title: "Aegis AI | AI-Powered Family Protection & Insurance Advisor",
  description: "Understand insurance before you buy it. Aegis pairs specialist AI advisors with a curated catalogue of health, motor, travel and home policies, and explains each recommendation in plain language.",
  keywords: "insurance, AI advisor, health insurance, term life, vehicle insurance, family protection, premium fintech",
};

import { MotionConfig } from "framer-motion";
import { AuthProvider } from "@/context/AuthContext";
import { ThemeProvider } from "@/context/ThemeContext";
import FloatingAI from "@/components/FloatingAI";
import { Toaster } from "@/components/shared/Toaster";

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
            </MotionConfig>
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
