"use client";
import React, { memo } from "react";
import { motion } from "framer-motion";
import { ShieldCheck } from "lucide-react";
import type { MultiPlan } from "./types";

// ── Comparison view ───────────────────────────────────────────────────────────

export const ComparisonView = memo(function ComparisonView({
  plans,
  category,
  onSelect,
}: {
  plans: MultiPlan[];
  category: string;
  onSelect: (plan: MultiPlan) => void;
}) {
  const isMotor    = category === "motor";
  const isProperty = category === "property";
  const isTravel   = category === "travel";

  const rankColors = ["text-cyan-400", "text-blue-400", "text-violet-400"];
  const rankBgs = ["bg-cyan-500/8", "bg-blue-500/5", "bg-violet-500/5"];

  // Rows for health comparison
  const healthRows: { label: string; key: keyof MultiPlan; highlight?: "high" | "low" }[] = [
    { label: "Coverage",          key: "coverage",          highlight: "high" },
    { label: "Premium",           key: "premium" },
    { label: "Cashless Hospitals",key: "cashless_hospitals", highlight: "high" },
    { label: "Room Rent",         key: "room_rent" },
    { label: "ICU",               key: "icu" },
    { label: "Day Care",          key: "day_care" },
    { label: "PED Waiting",       key: "ped_waiting" },
    { label: "NCB",               key: "ncb" },
    { label: "Maternity",         key: "maternity" },
    { label: "Critical Illness",  key: "critical_illness" },
    { label: "Ambulance",         key: "ambulance" },
    { label: "Restoration",       key: "restoration" },
    { label: "OPD",               key: "opd" },
    { label: "Claim Ratio",       key: "claim_ratio",       highlight: "high" },
    { label: "Co-payment",        key: "co_payment" },
    { label: "Eligibility",       key: "eligibility" },
  ];

  const motorRows: { label: string; key: keyof MultiPlan; highlight?: "high" | "low" }[] = [
    { label: "Policy Type",       key: "policy_type" },
    { label: "Coverage",          key: "coverage" },
    { label: "Premium",           key: "premium" },
    { label: "IDV",               key: "idv" },
    { label: "Zero Dep",          key: "zero_dep_claims" },
    { label: "Engine Protect",    key: "engine_protect_detail" },
    { label: "RSA",               key: "rsa_services" },
    { label: "Consumables",       key: "consumables" },
    { label: "Battery Cover",     key: "battery_cover_detail" },
    { label: "PA Cover",          key: "pa_owner_driver" },
    { label: "Cashless Garages",  key: "cashless_garages",  highlight: "high" },
    { label: "NCB",               key: "ncb" },
    { label: "Claim Process",     key: "claim_process" },
    { label: "Claim Ratio",       key: "claim_ratio",       highlight: "high" },
  ];

  const propertyRows: { label: string; key: keyof MultiPlan; highlight?: "high" | "low" }[] = [
    { label: "Coverage",             key: "coverage",                highlight: "high" },
    { label: "Premium",              key: "premium" },
    { label: "Structure Cover",      key: "structure_coverage",      highlight: "high" },
    { label: "Contents Cover",       key: "contents_coverage",       highlight: "high" },
    { label: "Fire",                 key: "fire_detail" },
    { label: "Flood",                key: "flood_detail" },
    { label: "Earthquake",           key: "earthquake_detail" },
    { label: "Storm / Cyclone",      key: "storm_detail" },
    { label: "Theft",                key: "theft_sublimit" },
    { label: "Temp Accommodation",   key: "temp_accommodation_detail" },
    { label: "Electrical Damage",    key: "electrical_detail" },
    { label: "Public Liability",     key: "public_liability_detail" },
    { label: "Rental Income",        key: "rental_income_detail" },
    { label: "Jewelry / Valuables",  key: "jewelry_detail" },
    { label: "All-Risk Contents",    key: "all_risk_contents" },
    { label: "Claim Process",        key: "claim_process" },
    { label: "Claim Ratio",          key: "claim_ratio",             highlight: "high" },
  ];

  const travelRows: { label: string; key: keyof MultiPlan; highlight?: "high" | "low" }[] = [
    { label: "Coverage",            key: "coverage",                 highlight: "high" },
    { label: "Premium",             key: "premium" },
    { label: "Scope",               key: "travel_scope" },
    { label: "Medical Cover",       key: "medical_cover_amount",     highlight: "high" },
    { label: "Medical (USD/EUR)",   key: "medical_cover_usd" },
    { label: "Emergency Evac",      key: "emergency_evac_amount",    highlight: "high" },
    { label: "Trip Cancellation",   key: "trip_cancellation_amount" },
    { label: "Trip Delay",          key: "trip_delay_threshold" },
    { label: "Lost Baggage",        key: "lost_baggage" },
    { label: "Baggage Delay",       key: "baggage_delay" },
    { label: "Passport Loss",       key: "passport_loss" },
    { label: "Adventure Cover",     key: "adventure_cover" },
    { label: "Pre-Existing (PED)",  key: "pre_existing_cover" },
    { label: "Schengen Compliant",  key: "schengen_compliant" },
    { label: "Annual Multi-Trip",   key: "annual_multi_trip" },
    { label: "Concierge",           key: "concierge" },
    { label: "Claim Ratio",         key: "claim_ratio",              highlight: "high" },
    { label: "Claim Process",       key: "claim_process" },
  ];

  const rows = isTravel ? travelRows : isProperty ? propertyRows : isMotor ? motorRows : healthRows;

  const displayVal = (plan: MultiPlan, key: keyof MultiPlan): string => {
    const v = plan[key];
    if (v === undefined || v === null || v === "") return "—";
    if (v === true)  return "Included";
    if (v === false) return "Not included";
    return String(v);
  };

  // Score row mini-bar
  const ScoreMini = ({ value, color }: { value: number; color: string }) => (
    <div className="flex items-center gap-1.5">
      <div className="flex-1 h-1 rounded-full bg-white/5 overflow-hidden">
        <motion.div
          className={`h-full rounded-full ${color}`}
          initial={{ width: 0 }}
          animate={{ width: `${value}%` }}
          transition={{ duration: 0.6, ease: "easeOut" }}
        />
      </div>
      <span className="text-[9px] font-mono font-black text-white/50 w-6 text-right">{value}</span>
    </div>
  );

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.2 }}
      className="w-full"
    >
      <div className="overflow-x-auto rounded-[18px] border border-white/8 bg-slate-950/60">
        <table className="w-full text-xs border-collapse min-w-[520px]">
          <thead>
            <tr>
              {/* Attribute column */}
              <th className="text-left p-3 pl-4 text-[9px] text-slate-600 font-black uppercase tracking-wide border-b border-white/5 w-28">
                Feature
              </th>
              {/* Plan columns */}
              {plans.map((plan, i) => (
                <th key={i} className={`p-3 border-b border-white/5 text-center ${rankBgs[i]}`}>
                  <div className="space-y-1">
                    <span className={`text-[8px] font-black uppercase tracking-wider ${rankColors[i]}`}>
                      #{plan.rank} {["Best Match","Strong Pick","Alternative"][i]}
                    </span>
                    <p className="text-[11px] font-black text-white leading-tight">{plan.plan_name}</p>
                  </div>
                </th>
              ))}
            </tr>
            {/* Score rows */}
            <tr className="bg-white/[0.015]">
              <td className="p-3 pl-4 text-[9px] text-slate-500 font-black uppercase tracking-wide border-b border-white/5">
                Scores
              </td>
              {plans.map((plan, i) => (
                <td key={i} className={`p-3 border-b border-white/5 ${rankBgs[i]}`}>
                  <div className="space-y-1.5">
                    <ScoreMini value={plan.scores.overall}       color="bg-cyan-500" />
                    <ScoreMini value={plan.scores.budget_match}  color="bg-emerald-500" />
                    <ScoreMini value={plan.scores.coverage_match}color="bg-blue-500" />
                    <ScoreMini value={plan.scores.risk_match}    color="bg-amber-500" />
                  </div>
                </td>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map(({ label, key }) => (
              <tr key={label} className="hover:bg-white/[0.015] transition-colors">
                <td className="p-2.5 pl-4 text-[9px] text-slate-500 font-bold border-b border-white/[0.04] align-top">
                  {label}
                </td>
                {plans.map((plan, i) => {
                  const val = displayVal(plan, key);
                  const isEmpty = val === "—" || val === "Not included";
                  return (
                    <td key={i} className={`p-2.5 text-center text-[9px] border-b border-white/[0.04] align-top ${rankBgs[i]}`}>
                      <span className={isEmpty ? "text-slate-700" : "text-slate-300 font-medium"}>
                        {val}
                      </span>
                    </td>
                  );
                })}
              </tr>
            ))}
            {/* Why this plan row */}
            <tr>
              <td className="p-2.5 pl-4 text-[9px] text-slate-500 font-bold align-top">
                Why Pick This
              </td>
              {plans.map((plan, i) => (
                <td key={i} className={`p-2.5 text-center text-[9px] text-slate-400 italic leading-relaxed align-top ${rankBgs[i]}`}>
                  {plan.why_this_plan || "—"}
                </td>
              ))}
            </tr>
            {/* Select buttons */}
            <tr>
              <td className="p-3 pl-4" />
              {plans.map((plan, i) => (
                <td key={i} className={`p-3 text-center ${rankBgs[i]}`}>
                  <button
                    onClick={() => onSelect(plan)}
                    className={`px-3 py-2 rounded-xl text-[8px] font-black uppercase tracking-wider text-white cursor-pointer active:scale-95 transition-all hover:opacity-90 ${
                      i === 0
                        ? "bg-gradient-to-r from-cyan-500 to-teal-500"
                        : i === 1
                        ? "bg-gradient-to-r from-blue-500 to-indigo-500"
                        : "bg-gradient-to-r from-violet-500 to-purple-500"
                    }`}
                  >
                    <ShieldCheck className="w-3 h-3 inline mr-1" />
                    Select
                  </button>
                </td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>
      <p className="text-[8px] text-slate-600 text-center mt-2">
        Scroll right to see all plans · Scores: Overall / Budget / Coverage / Risk
      </p>
    </motion.div>
  );
});
