"use client";

import { Car, Plane, Home as HomeIcon, Heart, Award, ShieldCheck } from "lucide-react";
import type { PlanDetails } from "./types";

/** Category icon derived from the plan's category or name keywords. */
function CategoryIcon({ plan }: { plan: PlanDetails }) {
  const name = plan.planName.toLowerCase();
  const cat = (plan.category || "").toLowerCase();
  if (cat === "motor" || name.includes("motor") || name.includes("drive") || name.includes("car") || name.includes("wheeler")) return <Car className="w-8 h-8 text-blue-400" />;
  if (cat === "travel" || name.includes("global") || name.includes("voyage") || name.includes("nomad") || name.includes("travel") || name.includes("trip")) return <Plane className="w-8 h-8 text-amber-400" />;
  if (cat === "property" || name.includes("home") || name.includes("fortress") || name.includes("brick") || name.includes("property")) return <HomeIcon className="w-8 h-8 text-emerald-400" />;
  return <Heart className="w-8 h-8 text-purple-400" />;
}

interface DetailsHeroProps {
  plan: PlanDetails;
  onProceed: () => void;
}

/** Underwriter header hero card: category icon, score, name, premium, and CTA. */
export function DetailsHero({ plan, onProceed }: DetailsHeroProps) {
  return (
    <div className="rounded-[36px] bg-gradient-to-r from-slate-900 via-slate-900/95 to-slate-950 border border-white/5 p-6 sm:p-8 flex flex-col md:flex-row justify-between items-start md:items-center gap-6 shadow-[0_12px_40px_rgba(0,0,0,0.4)]">
      <div className="flex items-center gap-4 text-left">
        <div className="w-16 h-16 rounded-[22px] bg-white/5 border border-white/10 flex items-center justify-center shadow-inner">
          <CategoryIcon plan={plan} />
        </div>
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[9px] font-black tracking-widest uppercase px-2 py-0.5 rounded-md bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
              Aegis Premium
            </span>
            <span className="flex items-center gap-1 text-[9px] font-mono font-black uppercase bg-emerald-500/15 text-emerald-400 py-0.5 px-2 rounded-full border border-emerald-500/20">
              <Award className="w-2.5 h-2.5" />
              {plan.score || 98}% Match Score
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-white mt-1 leading-tight">{plan.planName}</h1>
          <p className="text-xs text-slate-400 font-semibold mt-0.5">Coverage Boundary: <span className="text-white font-extrabold">{plan.coverage}</span></p>
        </div>
      </div>

      {/* Quick Actions Panel */}
      <div className="flex flex-col sm:flex-row gap-4 w-full md:w-auto items-stretch sm:items-center">
        <div className="text-left sm:text-right bg-slate-950/40 px-5 py-3 rounded-2xl border border-white/5">
          <span className="text-[9px] text-slate-500 font-black uppercase tracking-wider block">Your premium</span>
          <span className="text-xl font-black text-cyan-400 font-mono">{plan.premium}</span>
          <span className="text-[10px] text-slate-400 font-medium block">All-inclusive projection</span>
        </div>
        <button
          onClick={onProceed}
          className="py-4 px-6 rounded-2xl font-black text-xs uppercase tracking-widest bg-gradient-to-r from-cyan-400 to-cyan-500 hover:from-cyan-350 hover:to-cyan-455 text-slate-950 flex items-center justify-center gap-2 transition-all shadow-[0_4px_20px_rgba(6,182,212,0.25)] hover:scale-[1.01] active:scale-95 touch-manipulation select-none cursor-pointer border border-cyan-300/20"
        >
          <ShieldCheck className="w-4 h-4" />
          <span>Lock & Transmit Plan</span>
        </button>
      </div>
    </div>
  );
}
