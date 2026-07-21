"use client";

import { Sparkles } from "lucide-react";
import { motion } from "framer-motion";
import { cardVariants } from "./variants";

/** Personalized hero banner with holographic glow and a security-node summary. */
export function HeroBanner({ clientName }: { clientName: string }) {
  return (
    <motion.div
      variants={cardVariants}
      className={`rounded-[32px] p-6 sm:p-10 border relative overflow-hidden text-left group shadow-2xl transition-all duration-300 bg-gradient-to-r from-purple-50 via-white to-cyan-50 border-slate-200/80 shadow-premium dark:bg-gradient-to-r dark:from-purple-950/40 dark:via-slate-900/40 dark:to-indigo-950/40 dark:border-white/5 dark:shadow-purple-950/10`}
    >
      {/* Holographic background element animations */}
      <div className="absolute top-[-50%] right-[-10%] w-80 h-80 rounded-full bg-purple-550/10 blur-3xl pointer-events-none group-hover:scale-110 transition-transform duration-700" />
      <div className="absolute bottom-[-50%] left-[-10%] w-80 h-80 rounded-full bg-cyan-400/5 blur-3xl pointer-events-none" />

      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-8 relative z-10">
        <div className="space-y-4 max-w-xl">
          {/* Greeting tags */}
          <span className="inline-flex items-center gap-1.5 text-[9px] font-black uppercase tracking-widest text-cyan-400 bg-cyan-950/40 py-1.5 px-4 rounded-full border border-cyan-800/30">
            <Sparkles className="w-3.5 h-3.5 text-cyan-400 animate-pulse" />
            <span>AI Co-Pilot Protection Online</span>
          </span>

          <h2 className={`text-2.5xl sm:text-4.5xl font-black tracking-tight leading-none text-content`}>
            Welcome Back, {clientName} 👋
          </h2>

          <p className={`text-xs sm:text-[13.5px] leading-relaxed font-semibold text-slate-600 dark:text-slate-350`}>
            Your personalized protection insights and AI recommendations are ready. Aegis risk models have validated your coverage limits across health & assets.
          </p>
        </div>

        {/* Quick Telemetry Summary */}
        <div className={`flex items-center gap-4 border rounded-2xl p-4.5 self-start lg:self-center shadow-lg backdrop-blur-md transition-all duration-300 bg-white/80 border-slate-200 dark:bg-white/[0.02] dark:border-white/10`}>
          <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-ping shadow-glow" />
          <div className="text-left space-y-1">
            <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest leading-none">Security Node</p>
            <p className={`text-xs font-black mt-1 leading-none text-content`}>ECDSA Sync Secured</p>
            <p className="text-[9.5px] text-cyan-400 font-extrabold uppercase tracking-widest">Vault Active</p>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
