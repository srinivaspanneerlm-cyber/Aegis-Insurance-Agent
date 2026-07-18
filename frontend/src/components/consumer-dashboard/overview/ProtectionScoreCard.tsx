"use client";

import { ShieldCheck } from "lucide-react";
import { motion } from "framer-motion";
import { useTheme } from "@/context/ThemeContext";
import { cardVariants } from "./variants";

/** Holographic protection-score ring widget. */
export function ProtectionScoreCard() {
  const { theme } = useTheme();

  return (
    <motion.div
      variants={cardVariants}
      className={`rounded-[32px] border p-6 sm:p-7 shadow-2xl space-y-6 relative overflow-hidden transition-all duration-300 ${
        theme === "dark" ? "bg-slate-900/40 border-white/5 shadow-purple-950/5" : "bg-white border-slate-200 shadow-premium"
      }`}
    >
      <div className="absolute top-[-30%] left-[-20%] w-40 h-40 rounded-full bg-cyan-500/5 blur-2xl pointer-events-none" />

      <div className="border-b border-white/5 pb-3">
        <h4 className={`font-black text-xs sm:text-sm uppercase tracking-wider flex items-center gap-1.5 ${theme === "dark" ? "text-white" : "text-navy-950"}`}>
          <ShieldCheck className="w-4.5 h-4.5 text-purple-400" />
          <span>Protection Core Score</span>
        </h4>
      </div>

      <div className="flex flex-col items-center justify-center py-4 space-y-5">
        {/* Circular Progress Ring with glow */}
        <div className="relative w-36 h-36 flex items-center justify-center">
          {/* Inner tech ring details */}
          <div className="absolute inset-2.5 rounded-full border border-dashed border-white/10 animate-spin" style={{ animationDuration: "35s" }} />
          <div className="absolute inset-5 rounded-full border border-white/5" />

          <svg className="w-full h-full transform -rotate-90">
            <circle cx="72" cy="72" r="58" fill="transparent" stroke={theme === "dark" ? "rgba(255,255,255,0.04)" : "rgba(15,23,42,0.04)"} strokeWidth="7" />
            <motion.circle
              cx="72"
              cy="72"
              r="58"
              fill="transparent"
              stroke="url(#purpleCyanGrad)"
              strokeWidth="7"
              strokeDasharray="364"
              initial={{ strokeDashoffset: 364 }}
              animate={{ strokeDashoffset: 65 }} // 82% filled
              transition={{ duration: 1.8, ease: "easeOut", delay: 0.3 }}
              strokeLinecap="round"
            />
            <defs>
              <linearGradient id="purpleCyanGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#a855f7" />
                <stop offset="100%" stopColor="#06b6d4" />
              </linearGradient>
            </defs>
          </svg>
          <div className="absolute flex flex-col items-center justify-center text-center">
            <span className={`text-3xl font-black tracking-tighter ${theme === "dark" ? "text-white" : "text-navy-950"}`}>82%</span>
            <span className="text-[8.5px] font-black text-cyan-400 uppercase tracking-widest mt-0.5">PROTECTED</span>
          </div>
        </div>

        <div className="text-center space-y-1 w-full px-2">
          <p className={`text-[11.5px] font-bold ${theme === "dark" ? "text-slate-350" : "text-slate-600"}`}>
            Your family health cover matches. Add Smart Auto Shield to complete 360° security.
          </p>
          <div className="flex justify-center gap-3 pt-3">
            <span className="inline-flex items-center gap-1 text-[8.5px] text-emerald-450 bg-emerald-950/40 border border-emerald-800/40 py-1 px-3 rounded-full font-black uppercase">
              Health: Safe
            </span>
            <span className="inline-flex items-center gap-1 text-[8.5px] text-amber-500 bg-amber-950/40 border border-amber-800/40 py-1 px-3 rounded-full font-black uppercase">
              Auto: Gap
            </span>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
