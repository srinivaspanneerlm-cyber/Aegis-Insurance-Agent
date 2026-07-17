"use client";

import { Dispatch, SetStateAction } from "react";
import { Sliders, Settings } from "lucide-react";
import { motion } from "framer-motion";

/** Automation Triggers panel: simulated actuarial + database operations (nav: "automation"). */
export function AutomationViewport({ setLogs }: { setLogs: Dispatch<SetStateAction<string[]>> }) {
  return (
    <motion.div
      key="automation"
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -15 }}
      className="bg-slate-900/60 border border-cyan-500/20 rounded-[32px] p-6 sm:p-8 space-y-6"
    >
      <div className="border-b border-white/5 pb-4">
        <h3 className="font-extrabold text-white text-base">Automation Triggers Panel</h3>
        <p className="text-xs text-slate-400 mt-1 font-semibold">Simulate operational workflows and inspect fallback actuarial parameters.</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
        <div className="p-6 bg-slate-950 border border-white/5 rounded-3xl space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-purple-950 text-purple-400 flex items-center justify-center">
              <Sliders className="w-5 h-5" />
            </div>
            <h4 className="text-xs font-black text-white uppercase tracking-wider">Actuarial Parameter Tuning</h4>
          </div>
          <p className="text-[11px] text-slate-450 leading-relaxed font-semibold">
            Enforce strict premium payout algorithms dynamically across the consumer conversational interface when they request pricing.
          </p>
          <div className="pt-2">
            <button
              onClick={() => {
                setLogs((prev) => ["ACTUARIAL: Modified baseline recovery indexes to 1.15 coefficient.", ...prev]);
              }}
              className="py-2.5 px-4 bg-purple-600 hover:bg-purple-500 text-white rounded-xl transition-all font-black text-[10px] uppercase tracking-widest cursor-pointer"
            >
              Adjust Liability Coeff
            </button>
          </div>
        </div>

        <div className="p-6 bg-slate-950 border border-white/5 rounded-3xl space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-teal-950 text-teal-400 flex items-center justify-center">
              <Settings className="w-5 h-5" />
            </div>
            <h4 className="text-xs font-black text-white uppercase tracking-wider">Underwriting Database Cleansing</h4>
          </div>
          <p className="text-[11px] text-slate-450 leading-relaxed font-semibold">
            Sync webhook queues, optimize schema partitions, and secure deleted assets files within standard compliance schedules.
          </p>
          <div className="pt-2">
            <button
              onClick={() => {
                setLogs((prev) => ["DATABASE: Compacted partitioned keys in lead ledger tables (saved 12.4 MB).", ...prev]);
              }}
              className="py-2.5 px-4 bg-teal-600 hover:bg-teal-500 text-slate-950 rounded-xl transition-all font-black text-[10px] uppercase tracking-widest cursor-pointer"
            >
              Compact Leads Tables
            </button>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
