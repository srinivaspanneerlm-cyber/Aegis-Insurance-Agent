"use client";

import { MessageSquare, ArrowRight } from "lucide-react";
import { motion } from "framer-motion";
import { useTheme } from "@/context/ThemeContext";
import type { NavId } from "../types";
import { cardVariants } from "./variants";

/** Prompt to resume the AI consultation; routes into the advisor. */
export function ResumeConsultationCard({ setActiveNav }: { setActiveNav: (nav: NavId) => void }) {
  const { theme } = useTheme();

  return (
    <motion.div
      variants={cardVariants}
      className={`rounded-[24px] border p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition-all duration-300 ${
        theme === "dark" ? "bg-slate-900/30 border-white/5 hover:border-purple-550/20" : "bg-white border-slate-200 shadow-premium"
      }`}
    >
      <div className="flex items-center gap-3.5 text-left">
        <div className="w-9 h-9 rounded-xl bg-purple-950/40 text-purple-400 flex items-center justify-center border border-purple-800/30 flex-shrink-0">
          <MessageSquare className="w-5 h-5 text-purple-400" />
        </div>
        <div>
          <p className={`text-xs font-black ${theme === "dark" ? "text-white" : "text-navy-950"}`}>Continue Your AI Consultation</p>
          <p className="text-[11.5px] text-slate-500 font-semibold mt-0.5">Resume your family health protection session with Sarah AI.</p>
        </div>
      </div>

      <button
        onClick={() => setActiveNav("advisor")}
        className="bg-purple-650 hover:bg-purple-600 text-white font-bold py-2.5 px-4.5 rounded-xl text-[10.5px] uppercase tracking-wider flex items-center justify-center gap-1.5 transition-all cursor-pointer border border-purple-500/20 self-start sm:self-center shadow-glow"
      >
        <span>Resume Dialogue</span>
        <ArrowRight className="w-4 h-4 animate-pulse" />
      </button>
    </motion.div>
  );
}
