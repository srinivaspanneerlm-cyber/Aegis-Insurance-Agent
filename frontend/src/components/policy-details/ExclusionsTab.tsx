"use client";

import { ShieldAlert, ShieldCheck, Clock, Signature } from "lucide-react";
import type { PlanDetails } from "./types";

/** Tab 3 — exclusions, CRO sign-off, and claim process journey. */
export function ExclusionsTab({ plan }: { plan: PlanDetails }) {
  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-xl font-black text-white flex items-center gap-2">
          <ShieldAlert className="w-5 h-5 text-rose-400" />
          <span>Exclusions & Underwriting Mandates</span>
        </h2>
        <p className="text-xs text-slate-400 font-semibold mt-1">
          Complete transparency regarding non-covered risks and waiting criteria before formal validation checks.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Exclusions list */}
        <div className="space-y-4">
          <h3 className="text-xs font-black uppercase tracking-wider text-rose-400 flex items-center gap-1.5">
            <ShieldAlert className="w-4 h-4" />
            <span>Standard Non-Covered Exclusions</span>
          </h3>
          <ul className="space-y-2.5">
            {(plan.exclusions || ["Cosmetic procedures", "Experimental medicines"]).map((ex, i) => (
              <li key={i} className="flex items-start gap-2.5 text-xs text-slate-300">
                <span className="w-1.5 h-1.5 rounded-full bg-rose-500/80 mt-2 flex-shrink-0" />
                <span className="font-semibold leading-relaxed">{ex}</span>
              </li>
            ))}
          </ul>

          {/* Waiting period panel */}
          {plan.waitingPeriod && (
            <div className="p-4 rounded-2xl bg-amber-500/5 border border-amber-500/15 flex items-start gap-3 mt-4 text-left">
              <Clock className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
              <div className="space-y-1 text-xs">
                <span className="font-black text-amber-400 uppercase tracking-wide text-[9px] block">Waiting Period Mandate</span>
                <p className="text-slate-350 font-semibold leading-relaxed">{plan.waitingPeriod}</p>
              </div>
            </div>
          )}
        </div>

        {/* Visual CRO sign-off */}
        <div className="p-5 rounded-3xl bg-slate-950/60 border border-white/5 flex flex-col justify-between text-left space-y-4">
          <div>
            <span className="text-[9px] font-black uppercase tracking-widest text-emerald-400 flex items-center gap-1.5 bg-emerald-500/10 py-1 px-3.5 rounded-full border border-emerald-500/20 w-fit">
              <ShieldCheck className="w-3.5 h-3.5 stroke-[2.2]" />
              <span>Audit Cleared</span>
            </span>
            <h4 className="text-xs font-black text-white mt-3">Chief Risk Officer Audit Pass</h4>
            <p className="text-[11px] text-slate-400 leading-relaxed font-semibold mt-1">
              &quot;{plan.executiveApproval || "Underwritten under premium guidelines. All standard parameters fully validated."}&quot;
            </p>
          </div>

          {/* Signature box */}
          <div className="border-t border-white/5 pt-4 flex items-center justify-between">
            <div className="space-y-0.5">
              <span className="text-[8px] text-slate-500 uppercase font-black block">Sign-off Index</span>
              <span className="text-[10px] text-slate-300 font-bold block font-mono">CRO-991-SARAH-AI</span>
            </div>
            <div className="flex items-center gap-2 text-cyan-400/70 select-none">
              <Signature className="w-5 h-5" />
              <span className="font-serif italic text-xs">Sarah AI Signature</span>
            </div>
          </div>
        </div>
      </div>

      {/* Claim process journey */}
      {plan.claimProcess && (
        <div className="space-y-3 pt-4 border-t border-white/5">
          <h3 className="text-xs font-black uppercase tracking-wider text-slate-500">Empanelled Fast-track Claims Process</h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {plan.claimProcess.split(". ").map((step, i) => (
              <div key={i} className="p-4 rounded-2xl bg-slate-950/30 border border-white/5 text-xs relative text-left">
                <span className="absolute right-4 top-3 text-[10px] font-black font-mono text-cyan-500/30">Step {i + 1}</span>
                <h4 className="font-bold text-white mb-1">
                  {i === 0 ? "Claim Notification" : i === 1 ? "Assessor Clearance" : "Direct Payout Settlement"}
                </h4>
                <p className="text-[11px] text-slate-400 leading-relaxed">{step}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
