"use client";
import { memo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { CheckCircle, ShieldCheck, ChevronDown, ChevronUp, Star } from "lucide-react";
import type { MultiPlan } from "./types";
import { ScoreBar } from "./ScoreBar";
import { getRankConfig } from "./multiPlan/rankConfig";
import { ExpandedDetails } from "./multiPlan/ExpandedDetails";

// ── Single plan card within multi-plan suite ───────────────────────────────────

export const MultiPlanCard = memo(function MultiPlanCard({
  plan,
  category,
  index,
  onSelect,
  showRank = true,
}: {
  plan: MultiPlan;
  category: string;
  index: number;
  onSelect: (plan: MultiPlan) => void;
  /** Rank badge and position number. Off when the plan is shown on its own —
   *  "Best Match" only means something next to the matches it beat. */
  showRank?: boolean;
}) {
  const [expanded, setExpanded] = useState(false);

  const rankConfig = getRankConfig(index);
  const scores = plan.scores;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, delay: index * 0.08 }}
      className={`rounded-[20px] ${rankConfig.border} ${rankConfig.glow} bg-slate-950/80 overflow-hidden`}
    >
      {/* Card header */}
      <div className="p-4">
        {/* Rank + plan name row */}
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="flex items-center gap-2.5">
            {showRank && (
              <>
                <div className={`w-6 h-6 rounded-lg ${rankConfig.scoreBg} flex items-center justify-center flex-shrink-0`}>
                  {index === 0
                    ? <Star className={`w-3.5 h-3.5 ${rankConfig.scoreText}`} />
                    : <span className={`text-[9px] font-black ${rankConfig.scoreText}`}>#{plan.rank}</span>
                  }
                </div>
                <div>
                  <span className={`text-[8px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full border ${rankConfig.badge}`}>
                    {rankConfig.label}
                  </span>
                </div>
              </>
            )}
          </div>
          {/* Overall score */}
          <div className={`flex-shrink-0 px-2.5 py-1 rounded-xl ${rankConfig.scoreBg} border border-white/5`}>
            <p className="text-[8px] text-slate-500 font-black uppercase tracking-wide text-center leading-none mb-0.5">Match</p>
            <p className={`text-sm font-black font-mono ${rankConfig.scoreText} text-center leading-none`}>{scores.overall}%</p>
          </div>
        </div>

        {/* Plan name + coverage/premium */}
        <div className="mb-3">
          <h4 className="text-[13px] font-black text-white leading-tight mb-1">{plan.plan_name}</h4>
          <div className="flex items-center gap-3">
            <span className="text-xs font-mono font-bold text-slate-300">{plan.coverage}</span>
            <span className="text-white/15">·</span>
            <span className={`text-xs font-black font-mono ${rankConfig.scoreText}`}>{plan.premium}</span>
            {plan.claim_ratio && (
              <>
                <span className="text-white/15">·</span>
                <span className="text-[9px] text-emerald-400 font-bold">{plan.claim_ratio} CSR</span>
              </>
            )}
          </div>
        </div>

        {/* Score bars — 2×2 grid */}
        <div className="grid grid-cols-2 gap-x-4 gap-y-2 mb-3 p-2.5 rounded-xl bg-white/[0.02] border border-white/5">
          <ScoreBar label="Budget" value={scores.budget_match}  color="text-emerald-400" />
          <ScoreBar label="Coverage" value={scores.coverage_match} color="text-cyan-400" />
          <ScoreBar label="Risk"   value={scores.risk_match}    color="text-amber-400" />
          <ScoreBar label="Fit"    value={scores.suitability}   color="text-violet-400" />
        </div>

        {/* Why this plan */}
        {plan.why_this_plan && (
          <p className="text-[10px] text-slate-400 italic leading-relaxed mb-3">
            {plan.why_this_plan}
          </p>
        )}

        {/* Top benefits (3 max) */}
        <div className="space-y-1 mb-3">
          {plan.benefits.slice(0, expanded ? undefined : 3).map((b, i) => (
            <div key={i} className="flex items-center gap-2 text-[10px]">
              <CheckCircle className={`w-3 h-3 ${rankConfig.scoreText} flex-shrink-0`} />
              <span className="text-slate-400">{b}</span>
            </div>
          ))}
        </div>

        {/* Expanded details */}
        <AnimatePresence>
          {expanded && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.2 }}
              className="overflow-hidden"
            >
              <ExpandedDetails plan={plan} category={category} />
            </motion.div>
          )}
        </AnimatePresence>

        {/* Expand toggle + action */}
        <div className="flex items-center gap-2 mt-3">
          <button
            onClick={() => setExpanded(x => !x)}
            className="flex items-center gap-1 text-[9px] font-black text-slate-500 hover:text-slate-300 transition-colors uppercase tracking-wide"
          >
            {expanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
            {expanded ? "Less" : "Full Details"}
          </button>
          <div className="flex-1" />
          <button
            onClick={() => onSelect(plan)}
            className={`px-4 py-2 rounded-xl text-[9px] font-black uppercase tracking-wider bg-gradient-to-r ${rankConfig.btnGrad} text-white flex items-center gap-1.5 hover:opacity-90 active:scale-95 transition-all cursor-pointer`}
          >
            <ShieldCheck className="w-3 h-3" />
            Select Plan
          </button>
        </div>
      </div>
    </motion.div>
  );
});
