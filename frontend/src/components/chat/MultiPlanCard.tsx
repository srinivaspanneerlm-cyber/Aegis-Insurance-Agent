"use client";
import React, { memo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { CheckCircle, ShieldCheck, ChevronDown, ChevronUp, Star, XCircle } from "lucide-react";
import type { MultiPlan } from "./types";
import { ScoreBar } from "./ScoreBar";

// ── Single plan card within multi-plan suite ───────────────────────────────────

export const MultiPlanCard = memo(function MultiPlanCard({
  plan,
  category,
  index,
  onSelect,
}: {
  plan: MultiPlan;
  category: string;
  index: number;
  onSelect: (plan: MultiPlan) => void;
}) {
  const [expanded, setExpanded] = useState(false);

  const isHealth   = category === "health";
  const isMotor    = category === "motor";
  const isProperty = category === "property";
  const isTravel   = category === "travel";

  const rankConfig = [
    {
      label: "Best Match",
      badge: "bg-amber-500/15 text-amber-400 border-amber-500/25",
      border: "border-2 border-cyan-500/35",
      glow: "shadow-[0_4px_24px_rgba(6,182,212,0.10)]",
      scoreBg: "bg-cyan-500/10",
      scoreText: "text-cyan-400",
      btnGrad: "from-cyan-500 to-teal-500",
      rankDot: "bg-amber-400",
    },
    {
      label: "Strong Pick",
      badge: "bg-slate-500/15 text-slate-400 border-slate-500/25",
      border: "border border-white/10",
      glow: "",
      scoreBg: "bg-blue-500/10",
      scoreText: "text-blue-400",
      btnGrad: "from-blue-500 to-indigo-500",
      rankDot: "bg-slate-400",
    },
    {
      label: "Alternative",
      badge: "bg-violet-500/10 text-violet-400 border-violet-500/20",
      border: "border border-white/8",
      glow: "",
      scoreBg: "bg-violet-500/10",
      scoreText: "text-violet-400",
      btnGrad: "from-violet-500 to-purple-500",
      rankDot: "bg-violet-400",
    },
  ][index] ?? {
    label: "Option", badge: "", border: "border border-white/8",
    glow: "", scoreBg: "", scoreText: "text-white", btnGrad: "from-slate-500 to-slate-600",
    rankDot: "bg-white/30",
  };

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
              <div className="border-t border-white/5 pt-3 space-y-3">
                {/* Health-specific details */}
                {isHealth && (
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      { label: "Cashless Hospitals", value: plan.cashless_hospitals },
                      { label: "Room Rent",           value: plan.room_rent },
                      { label: "ICU",                 value: plan.icu },
                      { label: "Day Care",            value: plan.day_care },
                      { label: "PED Waiting",         value: plan.ped_waiting },
                      { label: "NCB",                 value: plan.ncb },
                      { label: "Health Checkup",      value: plan.health_checkup },
                      { label: "Maternity",           value: plan.maternity },
                      { label: "Critical Illness",    value: plan.critical_illness },
                      { label: "Ambulance",           value: plan.ambulance },
                      { label: "Restoration",         value: plan.restoration },
                      { label: "OPD",                 value: plan.opd },
                      { label: "Co-payment",          value: plan.co_payment },
                      { label: "Eligibility",         value: plan.eligibility },
                    ].filter(r => r.value).map(({ label, value }) => (
                      <div key={label} className="bg-white/[0.02] rounded-lg p-2">
                        <p className="text-[8px] text-slate-600 font-bold uppercase tracking-wide mb-0.5">{label}</p>
                        <p className="text-[10px] text-slate-300 font-semibold">{value}</p>
                      </div>
                    ))}
                  </div>
                )}

                {/* Motor-specific details */}
                {isMotor && (
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      { label: "Policy Type",      value: plan.policy_type },
                      { label: "IDV",              value: plan.idv },
                      { label: "Zero Dep",         value: plan.zero_dep ? `Yes — ${plan.zero_dep_claims || ""}` : "No" },
                      { label: "Engine Protect",   value: plan.engine_protect ? "Yes" : "No" },
                      { label: "RSA",              value: plan.rsa ? "Yes" : "No" },
                      { label: "Consumables",      value: plan.consumables ? "Included" : "Not included" },
                      { label: "Return Invoice",   value: plan.return_invoice ? "Included" : "No" },
                      { label: "Battery Cover",    value: plan.battery_cover ? (plan.battery_cover_detail || "Yes") : "N/A" },
                      { label: "PA Owner-Driver",  value: plan.pa_owner_driver },
                      { label: "Cashless Garages", value: plan.cashless_garages },
                      { label: "NCB",              value: plan.ncb },
                      { label: "Claim Process",    value: plan.claim_process },
                    ].filter(r => r.value && r.value !== "No" && r.value !== "Not included" && r.value !== "N/A" || ["Policy Type","IDV","Cashless Garages","NCB","Claim Process"].includes(r.label)).filter(r => r.value).map(({ label, value }) => (
                      <div key={label} className="bg-white/[0.02] rounded-lg p-2">
                        <p className="text-[8px] text-slate-600 font-bold uppercase tracking-wide mb-0.5">{label}</p>
                        <p className="text-[10px] text-slate-300 font-semibold">{String(value)}</p>
                      </div>
                    ))}
                  </div>
                )}

                {/* Property-specific details */}
                {isProperty && (
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      { label: "Structure Cover",      value: plan.structure_coverage },
                      { label: "Contents Cover",       value: plan.contents_coverage },
                      { label: "Fire",                 value: plan.fire_cover ? (plan.fire_detail || "Included") : "Not included" },
                      { label: "Flood",                value: plan.flood_cover ? (plan.flood_detail || "Included") : "Not included" },
                      { label: "Earthquake",           value: plan.earthquake_cover ? (plan.earthquake_detail || "Included") : "Not included" },
                      { label: "Storm / Cyclone",      value: plan.storm_cover ? (plan.storm_detail || "Included") : "Not included" },
                      { label: "Theft",                value: plan.theft_cover ? (plan.theft_sublimit || "Included") : "Not included" },
                      { label: "Temp Accommodation",   value: plan.temp_accommodation ? (plan.temp_accommodation_detail || "Included") : "Not included" },
                      { label: "Electrical Damage",    value: plan.electrical_cover ? (plan.electrical_detail || "Included") : "Not included" },
                      { label: "Glass Cover",          value: plan.glass_cover ? "Included" : "Not included" },
                      { label: "Public Liability",     value: plan.public_liability ? (plan.public_liability_detail || "Included") : "Not included" },
                      { label: "Rental Income",        value: plan.rental_income ? (plan.rental_income_detail || "Included") : "Not included" },
                      { label: "Jewelry / Valuables",  value: plan.jewelry_cover ? (plan.jewelry_detail || "Included") : "Not included" },
                      { label: "All-Risk Contents",    value: plan.all_risk_contents ? "Included" : "Not included" },
                      { label: "Claim Process",        value: plan.claim_process },
                      { label: "Eligibility",          value: plan.eligibility },
                    ].filter(r => r.value && r.value !== "Not included").map(({ label, value }) => (
                      <div key={label} className="bg-white/[0.02] rounded-lg p-2">
                        <p className="text-[8px] text-slate-600 font-bold uppercase tracking-wide mb-0.5">{label}</p>
                        <p className="text-[10px] text-slate-300 font-semibold">{String(value)}</p>
                      </div>
                    ))}
                  </div>
                )}

                {/* Travel-specific details */}
                {isTravel && (
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      { label: "Scope",             value: plan.travel_scope },
                      { label: "Medical Cover",      value: plan.medical_cover_amount },
                      { label: "Medical (USD)",      value: plan.medical_cover_usd },
                      { label: "Emergency Evac",     value: plan.emergency_evacuation ? (plan.emergency_evac_amount || "Included") : "Not included" },
                      { label: "Trip Cancellation",  value: plan.trip_cancellation ? (plan.trip_cancellation_amount || "Included") : "Not included" },
                      { label: "Trip Delay",         value: plan.trip_delay ? (plan.trip_delay_threshold || "Included") : "Not included" },
                      { label: "Lost Baggage",       value: plan.lost_baggage ? "Included" : "Not included" },
                      { label: "Baggage Delay",      value: plan.baggage_delay ? "Included" : "Not included" },
                      { label: "Passport Loss",      value: plan.passport_loss ? "Included" : "Not included" },
                      { label: "Personal Liability", value: plan.personal_liability ? "Included" : "Not included" },
                      { label: "Adventure Cover",    value: plan.adventure_cover ? (plan.adventure_types?.join(", ") || "Included") : "Not included" },
                      { label: "Pre-Existing (PED)", value: plan.pre_existing_cover ? "Declared PED Covered" : "Not covered" },
                      { label: "Schengen",           value: plan.schengen_compliant ? "Compliant" : "Not Schengen" },
                      { label: "Annual Multi-Trip",  value: plan.annual_multi_trip ? "Available" : "Per-trip only" },
                      { label: "Flight Hijack",      value: plan.flight_hijack ? "Included" : "Not included" },
                      { label: "Concierge",          value: plan.concierge ? "Included" : "Not included" },
                      { label: "Claim Process",      value: plan.claim_process },
                      { label: "Eligibility",        value: plan.eligibility },
                    ].filter(r => r.value && r.value !== "Not included" && r.value !== "Not covered" && r.value !== "Not Schengen" && r.value !== "Per-trip only" && r.value !== "Not covered"
                      || ["Scope","Medical Cover","Claim Process","Eligibility"].includes(r.label)
                    ).filter(r => r.value).map(({ label, value }) => (
                      <div key={label} className="bg-white/[0.02] rounded-lg p-2">
                        <p className="text-[8px] text-slate-600 font-bold uppercase tracking-wide mb-0.5">{label}</p>
                        <p className="text-[10px] text-slate-300 font-semibold">{String(value)}</p>
                      </div>
                    ))}
                  </div>
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
