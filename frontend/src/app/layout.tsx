import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
});

export const metadata: Metadata = {
  title: "Aegis AI | Premium AI-Powered Family Protection & Insurance Advisor",
  description: "Protect your family's future with India's most trusted AI insurance advisor. Aegis evaluates 1,000+ policies in seconds to provide customized protection recommendations with 99.2% claim support success.",
  keywords: "insurance, AI advisor, health insurance, term life, vehicle insurance, family protection, premium fintech",
};

import { AuthProvider } from "@/context/AuthContext";
import { ThemeProvider } from "@/context/ThemeContext";
import FloatingAI from "@/components/FloatingAI";

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
        <ThemeProvider>
          <AuthProvider>
            {children}
            <FloatingAI />
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
