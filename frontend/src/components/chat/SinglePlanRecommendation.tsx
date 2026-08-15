"use client";
import React, { memo } from "react";
import { motion } from "framer-motion";
import { Car, Globe, Shield, Activity, Info } from "lucide-react";
import type { MultiPlan, RecommendationData } from "./types";
import { MultiPlanCard } from "./MultiPlanCard";

// ── The one plan the engine recommended ───────────────────────────────────────
//
// Deliberately not a shortlist. The advisor asked what the customer needed,
// the engine scored the catalogue against it, and this is the answer — so the
// card carries no rank badge, no "1 of 3", and no compare toggle sitting next
// to it inviting a decision the customer already asked us to make. The
// alternatives are still there; they arrive when they are asked for.

const CATEGORY_META: Record<string, { Icon: typeof Shield; label: string }> = {
  health: { Icon: Activity, label: "Health" },
  motor:  { Icon: Car,      label: "Motor" },
  travel: { Icon: Globe,    label: "Travel" },
};

export const SinglePlanRecommendation = memo(function SinglePlanRecommendation({
  data,
  onUIAction,
}: {
  data: RecommendationData;
  onUIAction?: (action: string, planData: RecommendationData) => void;
}) {
  const category = (data.category || "health").toLowerCase();
  const plan = data.plans?.[0];
  const { Icon, label } = CATEGORY_META[category] ?? { Icon: Shield, label: "Insurance" };

  if (!plan) return null;

  const handleSelect = (selected: MultiPlan) => {
    onUIAction?.("select_plan", {
      planName: selected.plan_name,
      coverage: selected.coverage,
      premium:  selected.premium,
      benefits: selected.benefits,
      score:    selected.scores.overall,
      claimSettlementRatio: selected.claim_ratio,
      riskLevel: selected.risk_level,
      category,
    });
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      className="w-full mt-3 space-y-3"
    >
      <div className="flex items-center gap-2 px-1">
        <Icon className="w-4 h-4 text-slate-400" />
        <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">
          Recommended {label} Plan
        </span>
      </div>

      <MultiPlanCard
        plan={plan}
        category={category}
        index={0}
        onSelect={handleSelect}
        showRank={false}
      />

      {/* Why the engine chose it — the same reasons the advisor just explained,
          written down so they survive the scroll. */}
      {!!data.reason_codes?.length && (
        <div className="rounded-2xl border border-white/5 bg-white/[0.02] p-3.5 space-y-2">
          <div className="flex items-center gap-1.5">
            <Info className="w-3 h-3 text-slate-500" />
            <span className="text-[9px] font-black uppercase tracking-widest text-slate-500">
              Why this plan
            </span>
          </div>
          <ul className="space-y-1.5">
            {data.reason_codes.map((reason, i) => (
              <li key={i} className="flex gap-2 text-[10px] leading-relaxed text-slate-400">
                <span className="text-slate-600">•</span>
                <span>{reason}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {data.alternatives_available && (
        <p className="px-1 text-[10px] leading-relaxed text-slate-500">
          Other plans were considered. Ask if you&apos;d like to see how the
          next-best option compares.
        </p>
      )}
    </motion.div>
  );
});
