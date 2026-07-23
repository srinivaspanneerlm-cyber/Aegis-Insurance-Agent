"use client";

import { motion } from "framer-motion";
import { cardVariants } from "./variants";

interface ArchetypeCardProps {
  clientArchetype: string;
  archetypeExplanation: string;
}

/** Dynamic risk-archetype insight card with telemetry bars. */
export function ArchetypeCard({ clientArchetype, archetypeExplanation }: ArchetypeCardProps) {
  return (
    <motion.div
      variants={cardVariants}
      className={`rounded-[32px] border p-6 sm:p-7 shadow-2xl space-y-5 relative overflow-hidden transition-all duration-300 bg-white border-slate-200 shadow-premium dark:bg-slate-900/40 dark:border-white/5 dark:shadow-none`}
    >
      {/* Top neon edge */}
      <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-purple-650 via-cyan-400 to-indigo-650" />

      <div className="border-b border-white/5 pb-3">
        <span className="text-[8px] font-black text-purple-400 uppercase tracking-widest block mb-0.5">AI Profile Insights</span>
        <h4 className={`text-xs sm:text-sm font-black uppercase tracking-wider text-content`}>
          Your Risk Profile
        </h4>
      </div>

      <div className="space-y-4">
        {/* Dynamic Archetype Title */}
        <div className={`p-4 rounded-2xl border text-left space-y-2 relative overflow-hidden bg-slate-50 border-slate-150 shadow-inner dark:bg-white/[0.01] dark:border-white/5 dark:shadow-none`}>
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-purple-550 animate-pulse shadow-glow" />
            <p className={`text-[12.5px] font-black leading-none text-purple-650 dark:text-cyan-300`}>
              &quot;{clientArchetype}&quot;
            </p>
          </div>
          <p className={`text-[11.5px] leading-relaxed font-semibold text-content-muted`}>
            {archetypeExplanation}
          </p>
        </div>

        {/* Visual Telemetry Bars */}
        <div className="space-y-3.5">
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-[9px] font-black text-slate-500 uppercase tracking-wider">
              <span>Family Protection Priority</span>
              <span className="text-purple-450">95%</span>
            </div>
            <div className="h-1.5 rounded-full bg-white/5 overflow-hidden">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: "95%" }}
                transition={{ duration: 1.5, ease: "easeOut" }}
                className="h-full bg-purple-550 rounded-full"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-[9px] font-black text-slate-500 uppercase tracking-wider">
              <span>Risk Minimization Index</span>
              <span className="text-cyan-400">80%</span>
            </div>
            <div className="h-1.5 rounded-full bg-white/5 overflow-hidden">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: "80%" }}
                transition={{ duration: 1.5, ease: "easeOut", delay: 0.2 }}
                className="h-full bg-cyan-450 rounded-full"
              />
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
