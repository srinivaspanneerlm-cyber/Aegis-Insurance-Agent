"use client";

import { Check } from "lucide-react";
import { motion } from "framer-motion";

/** Claim tracking steps (nav: "claims"). */
const CLAIM_STEPS = [
  { step: 1, label: "Document Dispatch", desc: "Aegis Cloud verified", status: "done" },
  { step: 2, label: "Hospital Desk Match", desc: "Cashless match cleared", status: "done" },
  { step: 3, label: "Final Validation", desc: "Auditing items now", status: "active" },
  { step: 4, label: "Settlement Settled", desc: "Direct payout desk", status: "pending" },
];

/** Secure claim safe-track portal. */
export function ClaimsViewport() {
  return (
    <motion.div
      key="claims"
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -15 }}
      className={`border shadow-2xl rounded-[32px] p-6 sm:p-8 text-left space-y-6 bg-white border-slate-200 dark:bg-slate-900/40 dark:border-white/5`}
    >
      <div className="border-b border-white/5 pb-4">
        <h3 className={`font-black text-base text-content`}>Secure Claim Safe-Track Portal</h3>
        <p className="text-xs text-slate-400 mt-1 font-medium">Track the status of your claims, all in one place.</p>
      </div>

      <div className={`p-6 border rounded-3xl space-y-6 bg-slate-50 border-slate-150 dark:bg-white/[0.01] dark:border-white/5`}>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/5 pb-4">
          <div>
            <span className="text-[9px] text-cyan-400 font-extrabold uppercase tracking-widest bg-cyan-950/40 border border-cyan-800/40 py-1 px-3.5 rounded-full inline-block leading-none">
              Admitted under Hospital Shield
            </span>
            <h4 className={`text-base font-black mt-2 text-content`}>Cashless Inpatient Claim #AEG-CLM-901</h4>
          </div>
          <div className="text-left sm:text-right">
            <p className="text-xs text-slate-500 font-bold uppercase tracking-wider">Target Settlement</p>
            <p className="text-sm font-extrabold text-purple-400 mt-1">₹1,45,000 (Fully Approved)</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 relative">
          {CLAIM_STEPS.map((st) => (
            <div key={st.step} className={`p-4 border rounded-2xl flex flex-col justify-between text-left space-y-3 relative group bg-white border-slate-200 dark:bg-slate-900/60 dark:border-white/5`}>
              <div className="flex items-center justify-between">
                <div className={`w-7 h-7 rounded-lg flex items-center justify-center font-bold text-xs ${
                  st.status === "done"
                    ? "bg-emerald-950/40 text-emerald-400 border border-emerald-800/40"
                    : st.status === "active"
                    ? "bg-cyan-950/40 text-cyan-400 border border-cyan-800/40 animate-pulse"
                    : "bg-white/5 text-slate-550 border border-slate-200"
                }`}>
                  {st.status === "done" ? <Check className="w-4 h-4 stroke-[3]" /> : st.step}
                </div>
                <span className={`text-[8.5px] font-black uppercase tracking-widest ${
                  st.status === "done" ? "text-emerald-400" : st.status === "active" ? "text-cyan-400 animate-pulse" : "text-slate-550"
                }`}>
                  {st.status === "done" ? "Cleared" : st.status === "active" ? "Auditing" : "Pending"}
                </span>
              </div>
              <div>
                <p className={`text-[11px] font-extrabold leading-tight text-content`}>{st.label}</p>
                <p className="text-[9px] text-slate-500 mt-1 font-semibold leading-none">{st.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </motion.div>
  );
}
