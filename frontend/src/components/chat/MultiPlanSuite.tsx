"use client";
import React, { memo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Car, Globe, Shield, Activity } from "lucide-react";
import type { MultiPlan, RecommendationData } from "./types";
import { MultiPlanCard } from "./MultiPlanCard";
import { ComparisonView } from "./ComparisonView";

// ── Multi-plan recommendation suite ───────────────────────────────────────────

export const MultiPlanSuite = memo(function MultiPlanSuite({
  data,
  onUIAction,
}: {
  data: RecommendationData;
  onUIAction?: (action: string, planData: RecommendationData) => void;
}) {
  const [viewMode, setViewMode] = useState<"cards" | "compare">("cards");
  const category = (data.category || "health").toLowerCase();
  const plans    = data.plans || [];
  const segment  = data.segment || "Standard";
  const isHealth   = category === "health";
  const isMotor    = category === "motor";
  const isTravelCat = category === "travel";

  const Icon = isMotor ? Car : isHealth ? Activity : isTravelCat ? Globe : Shield;
  const catLabel = isMotor ? "Motor" : isHealth ? "Health" : isTravelCat ? "Travel" : "Insurance";

  const segmentBadge: Record<string, string> = {
    Budget:   "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
    Standard: "bg-blue-500/10    text-blue-400    border-blue-500/20",
    Premium:  "bg-amber-500/10   text-amber-400   border-amber-500/20",
  };

  const handleSelect = (plan: MultiPlan) => {
    const asRec: RecommendationData = {
      planName: plan.plan_name,
      coverage: plan.coverage,
      premium:  plan.premium,
      benefits: plan.benefits,
      score:    plan.scores.overall,
      claimSettlementRatio: plan.claim_ratio,
      riskLevel: plan.risk_level,
      category,
    };
    onUIAction?.("select_plan", asRec);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      className="w-full mt-3 space-y-3"
    >
      {/* Suite header */}
      <div className="flex items-center justify-between px-1">
        <div className="flex items-center gap-2">
          <Icon className="w-4 h-4 text-slate-400" />
          <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">
            {plans.length} Personalized {catLabel} Plans
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className={`text-[8px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full border ${segmentBadge[segment] || segmentBadge.Standard}`}>
            {segment} Tier
          </span>
          {/* View toggle */}
          <div className="flex rounded-lg overflow-hidden border border-white/10 bg-white/[0.03]">
            {(["cards", "compare"] as const).map(mode => (
              <button
                key={mode}
                onClick={() => setViewMode(mode)}
                className={`px-2.5 py-1 text-[8px] font-black uppercase tracking-wider transition-all cursor-pointer ${
                  viewMode === mode
                    ? "bg-white/10 text-white"
                    : "text-slate-500 hover:text-slate-300"
                }`}
              >
                {mode === "cards" ? "Cards" : "Compare"}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Score legend (cards only) */}
      {viewMode === "cards" && (
        <div className="flex items-center gap-3 px-1 text-[8px] font-semibold text-slate-600">
          <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />Budget</span>
          <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-cyan-400" />Coverage</span>
          <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-amber-400" />Risk</span>
          <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-violet-400" />Suitability</span>
        </div>
      )}

      {/* Plan cards OR comparison table */}
      <AnimatePresence mode="wait">
        {viewMode === "cards" ? (
          <motion.div key="cards" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-3">
            {plans.map((plan, i) => (
              <MultiPlanCard
                key={plan.plan_id || i}
                plan={plan}
                category={category}
                index={i}
                onSelect={handleSelect}
              />
            ))}
          </motion.div>
        ) : (
          <motion.div key="compare" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <ComparisonView plans={plans} category={category} onSelect={handleSelect} />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Footer */}
      <p className="text-[8px] text-slate-600 text-center leading-relaxed px-4">
        Plans matched by Aegis AI · Scores based on your profile · Toggle "Compare" for side-by-side view
      </p>
    </motion.div>
  );
});
