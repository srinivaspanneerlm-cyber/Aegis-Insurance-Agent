import { XCircle } from "lucide-react";
import type { MultiPlan } from "../types";
import { PlanDetailGrid } from "./PlanDetailGrid";
import { detailRowsFor } from "./detailRows";

const CATEGORIES_WITH_GRID = ["health", "motor", "property", "travel"];

/** The expanded portion of a plan card: category grid + narrative blocks. */
export function ExpandedDetails({ plan, category }: { plan: MultiPlan; category: string }) {
  return (
    <div className="border-t border-white/5 pt-3 space-y-3">
      {/* Category-specific detail grid */}
      {CATEGORIES_WITH_GRID.includes(category) && (
        <PlanDetailGrid rows={detailRowsFor(category, plan)} />
      )}

      {/* Exclusions */}
      {plan.exclusions && plan.exclusions.length > 0 && (
        <div>
          <p className="text-[8px] text-slate-500 font-black uppercase tracking-wide mb-1.5">Limitations</p>
          <div className="space-y-1">
            {plan.exclusions.map((e, i) => (
              <div key={i} className="flex items-center gap-2 text-[10px]">
                <XCircle className="w-3 h-3 text-rose-400/50 flex-shrink-0" />
                <span className="text-slate-500">{e}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Why not others */}
      {plan.why_not_others && (
        <div className="p-2.5 rounded-xl bg-slate-900/50 border border-white/5">
          <p className="text-[8px] text-slate-500 font-black uppercase tracking-wide mb-1">Why Not Others</p>
          <p className="text-[9px] text-slate-400 leading-relaxed">{plan.why_not_others}</p>
        </div>
      )}

      {/* Future benefits */}
      {plan.future_benefits && (
        <div className="p-2.5 rounded-xl bg-emerald-500/5 border border-emerald-500/10">
          <p className="text-[8px] text-emerald-400 font-black uppercase tracking-wide mb-1">Future Benefits</p>
          <p className="text-[9px] text-slate-400 leading-relaxed">{plan.future_benefits}</p>
        </div>
      )}

      {/* Claim experience */}
      {plan.claim_experience && (
        <div className="p-2.5 rounded-xl bg-blue-500/5 border border-blue-500/10">
          <p className="text-[8px] text-blue-400 font-black uppercase tracking-wide mb-1">Claim Experience</p>
          <p className="text-[9px] text-slate-400 leading-relaxed">{plan.claim_experience}</p>
        </div>
      )}
    </div>
  );
}
