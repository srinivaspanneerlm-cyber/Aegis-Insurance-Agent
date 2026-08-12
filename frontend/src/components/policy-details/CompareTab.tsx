"use client";

import { Scale, ChevronRight } from "lucide-react";
import type { PlanDetails } from "./types";
import { NOT_DISCLOSED } from "@/lib/platformFacts";

interface CompareTabProps {
  plan: PlanDetails;
  onProceed: () => void;
  onProceedAlternative: () => void;
}

/** Tab 4 — side-by-side comparison of the recommended vs alternative plan. */
export function CompareTab({ plan, onProceed, onProceedAlternative }: CompareTabProps) {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-black text-white flex items-center gap-2">
          <Scale className="w-5 h-5 text-cyan-400" />
          <span>Interactive Policy Comparison Engine</span>
        </h2>
        <p className="text-xs text-slate-400 font-semibold mt-1">
          Contrast the underwritten primary recommended plan side-by-side against the budget alternative choice.
        </p>
      </div>

      {plan.alternativePlan ? (
        <div className="overflow-x-auto" style={{ scrollbarWidth: "none" }}>
          <table className="w-full text-xs text-left border-collapse">
            <thead>
              <tr className="border-b border-white/15">
                <th className="py-3 px-4 font-black uppercase tracking-wider text-slate-500 w-1/4">Your details</th>
                <th className="py-3 px-4 text-cyan-400 font-black uppercase tracking-wider bg-cyan-500/5 border-x border-white/5 w-3/8 text-base">
                  🥇 Recommended: {plan.planName}
                </th>
                <th className="py-3 px-4 text-slate-300 font-black uppercase tracking-wider w-3/8">
                  🥈 Alternative: {plan.alternativePlan.planName}
                </th>
              </tr>
            </thead>
            <tbody className="font-semibold text-slate-200 divide-y divide-white/5">
              <tr>
                <td className="py-4.5 px-4 text-slate-400 font-bold uppercase text-[10px]">Monthly Premium</td>
                <td className="py-4.5 px-4 font-mono font-black text-cyan-300 bg-cyan-500/5 border-x border-white/5 text-sm">{plan.premium}</td>
                <td className="py-4.5 px-4 font-mono text-slate-350">{plan.alternativePlan.premium}</td>
              </tr>
              <tr>
                <td className="py-4.5 px-4 text-slate-400 font-bold uppercase text-[10px]">Coverage Limit</td>
                <td className="py-4.5 px-4 font-black bg-cyan-500/5 border-x border-white/5 text-white">{plan.coverage}</td>
                <td className="py-4.5 px-4 text-slate-350">{plan.alternativePlan.coverage}</td>
              </tr>
              <tr>
                <td className="py-4.5 px-4 text-slate-400 font-bold uppercase text-[10px]">Settlement Ratio</td>
                <td className="py-4.5 px-4 text-emerald-400 font-black bg-cyan-500/5 border-x border-white/5">{plan.claimSettlementRatio || NOT_DISCLOSED}</td>
                <td className="py-4.5 px-4 text-slate-350">{plan.alternativePlan.claimSettlementRatio || NOT_DISCLOSED}</td>
              </tr>
              <tr>
                <td className="py-4.5 px-4 text-slate-400 font-bold uppercase text-[10px]">Risk Profiling</td>
                <td className="py-4.5 px-4 bg-cyan-500/5 border-x border-white/5 text-white">{plan.riskLevel || NOT_DISCLOSED}</td>
                <td className="py-4.5 px-4 text-slate-350">{plan.alternativePlan.riskLevel || NOT_DISCLOSED}</td>
              </tr>
              <tr>
                <td className="py-4.5 px-4 text-slate-400 font-bold uppercase text-[10px]">Empanelled Network</td>
                <td className="py-4.5 px-4 bg-cyan-500/5 border-x border-white/5 text-white">{plan.hospitalNetwork || NOT_DISCLOSED}</td>
                <td className="py-4.5 px-4 text-slate-350">{plan.alternativePlan.hospitalNetwork || NOT_DISCLOSED}</td>
              </tr>
              <tr>
                <td className="py-4.5 px-4 text-slate-400 font-bold uppercase text-[10px]">Exclusions Shield</td>
                <td className="py-4.5 px-4 bg-cyan-500/5 border-x border-white/5 text-slate-300">
                  {plan.exclusions?.slice(0, 2).join(", ") || NOT_DISCLOSED}
                </td>
                <td className="py-4.5 px-4 text-slate-350">
                  {plan.alternativePlan.exclusions?.slice(0, 2).join(", ") || NOT_DISCLOSED}
                </td>
              </tr>
              <tr className="border-t border-white/10">
                <td className="py-5 px-4"></td>
                <td className="py-5 px-4 bg-cyan-500/5 border-x border-white/5">
                  <button
                    onClick={onProceed}
                    className="w-full py-3 rounded-xl font-black uppercase text-[10px] tracking-wider bg-cyan-400 text-slate-950 hover:bg-cyan-350 transition-all flex items-center justify-center gap-1 active:scale-95 cursor-pointer shadow-lg"
                  >
                    <span>Select Recommended</span>
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </td>
                <td className="py-5 px-4">
                  <button
                    onClick={onProceedAlternative}
                    className="w-full py-3 rounded-xl font-black uppercase text-[10px] tracking-wider border border-white/10 hover:border-white/20 bg-white/5 hover:bg-white/10 text-white transition-all flex items-center justify-center gap-1 active:scale-95 cursor-pointer"
                  >
                    <span>Select Alternative</span>
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      ) : (
        <div className="text-center py-10 text-slate-500 text-xs font-semibold">
          No alternative budget options compiled for comparison under your coordinates.
        </div>
      )}
    </div>
  );
}
