"use client";

import { ShieldCheck } from "lucide-react";
import { motion } from "framer-motion";
import { useTheme } from "@/context/ThemeContext";

/** Single glass card introducing the company. */
export function CompanyIntroCard() {
  const { theme } = useTheme();

  return (
    <section className="relative px-6 py-12 z-10">
      <div className="max-w-4xl mx-auto">
        <motion.div
          whileHover={{ y: -4 }}
          className={`p-8 md:p-10 rounded-[32px] border text-center relative overflow-hidden transition-all ${
            theme === "dark"
              ? "bg-slate-900/50 border-cyan-500/20 shadow-[0_0_35px_rgba(6,182,212,0.05)]"
              : "bg-white border-royal-200 shadow-premium"
          }`}
        >
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-48 h-[2px] bg-gradient-to-r from-transparent via-cyan-400 to-transparent" />
          <div className="space-y-4 max-w-2xl mx-auto">
            <span className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 mb-2">
              <ShieldCheck className="w-6 h-6 stroke-[1.8]" />
            </span>
            <h2 className="text-xl sm:text-2xl font-black text-white leading-snug">The Next-Generation AI Consulting Desk</h2>
            <p className={`text-sm md:text-base leading-relaxed font-semibold ${theme === "dark" ? "text-slate-300" : "text-slate-700"}`}>
              Aegis AI is a next-generation AI-powered insurance consultation ecosystem designed to simplify insurance guidance through intelligent conversations, personalized recommendations, and future-ready automation systems.
            </p>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
