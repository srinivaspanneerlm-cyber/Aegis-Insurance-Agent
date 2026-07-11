"use client";
import React, { memo, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  CheckCircle, ArrowRight, Award, ShieldCheck, FileText, Scale,
  Car, Globe, Home, Shield, Activity, Copy, Check, Volume2,
  RefreshCw, ChevronRight, ChevronDown, ChevronUp, Star, XCircle,
} from "lucide-react";

// ── Types ──────────────────────────────────────────────────────────────────────

export interface RecommendationData {
  planName: string;
  coverage: string;
  premium: string;
  benefits: string[];
  reason?: string;
  score?: number;
  claimSettlementRatio?: string;
  riskLevel?: string;
  confidenceScore?: number;
  executiveApproval?: string;
  exclusions?: string[];
  waitingPeriod?: string;
  claimProcess?: string;
  hospitalNetwork?: string;
  premiumBreakdown?: string;
  executiveNotes?: string;
  alternativePlan?: unknown;
  category?: string;
  // Motor fields
  idvValue?: string;
  ownDamageCover?: string;
  thirdPartyCover?: string;
  zeroDep?: string;
  roadsideAssistance?: string;
  engineProtection?: string;
  // Travel fields
  destination?: string;
  medicalCoverage?: string;
  tripCancellation?: string;
  baggageLoss?: string;
  emergencyEvacuation?: string;
  // Property fields
  propertyCoverage?: string;
  fireProtection?: string;
  naturalDisasterCover?: string;
  theftCover?: string;
  structureCover?: string;
  contentsCover?: string;
  // Multi-plan
  type?: string;
  segment?: string;
  plans?: MultiPlan[];
  total_plans?: number;
  recommended?: string;
  risk_summary?: Record<string, number>;
  vehicle_cat?: string;
}

export interface PlanScores {
  overall: number;
  suitability: number;
  budget_match: number;
  coverage_match: number;
  risk_match: number;
}

export interface MultiPlan {
  rank: number;
  plan_id: string;
  plan_name: string;
  segment: string;
  coverage: string;
  coverage_amount?: number;
  premium: string;
  premium_monthly?: number;
  premium_annual?: number;
  cashless_hospitals?: string;
  cashless_garages?: string;
  room_rent?: string;
  icu?: string;
  day_care?: string;
  ped_waiting?: string;
  ncb?: string;
  health_checkup?: string;
  maternity?: string;
  critical_illness?: string;
  ambulance?: string;
  restoration?: string;
  opd?: string;
  claim_process?: string;
  claim_ratio?: string;
  eligibility?: string;
  co_payment?: string;
  // Motor fields
  policy_type?: string;
  zero_dep?: boolean;
  zero_dep_claims?: string;
  engine_protect?: boolean;
  engine_protect_detail?: string;
  rsa?: boolean;
  rsa_services?: string;
  consumables?: boolean;
  return_invoice?: boolean;
  key_protect?: boolean;
  tyre_protect?: boolean;
  battery_cover?: boolean;
  battery_cover_detail?: string;
  idv?: string;
  pa_owner_driver?: string;
  // Property fields
  structure_coverage?: string;
  contents_coverage?: string;
  fire_cover?: boolean;
  fire_detail?: string;
  flood_cover?: boolean;
  flood_detail?: string;
  earthquake_cover?: boolean;
  earthquake_detail?: string;
  storm_cover?: boolean;
  storm_detail?: string;
  theft_cover?: boolean;
  theft_sublimit?: string;
  temp_accommodation?: boolean;
  temp_accommodation_detail?: string;
  electrical_cover?: boolean;
  electrical_detail?: string;
  glass_cover?: boolean;
  public_liability?: boolean;
  public_liability_detail?: string;
  rental_income?: boolean;
  rental_income_detail?: string;
  jewelry_cover?: boolean;
  jewelry_detail?: string;
  all_risk_contents?: boolean;
  accidental_damage?: boolean;
  worldwide_contents?: boolean;
  smart_home_cover?: boolean;
  legal_expenses?: boolean;
  cyber_cover?: boolean;
  outbuildings?: boolean;
  // Travel fields
  travel_scope?: string;
  medical_cover?: boolean;
  medical_cover_amount?: string;
  medical_cover_usd?: string;
  emergency_evacuation?: boolean;
  emergency_evac_amount?: string;
  trip_cancellation?: boolean;
  trip_cancellation_amount?: string;
  trip_delay?: boolean;
  trip_delay_threshold?: string;
  lost_baggage?: boolean;
  baggage_delay?: boolean;
  passport_loss?: boolean;
  personal_liability?: boolean;
  adventure_cover?: boolean;
  adventure_types?: string[];
  pre_existing_cover?: boolean;
  flight_hijack?: boolean;
  kidnap_cover?: boolean;
  annual_multi_trip?: boolean;
  schengen_compliant?: boolean;
  home_care?: boolean;
  business_equipment?: boolean;
  concierge?: boolean;
  // Common
  benefits: string[];
  exclusions?: string[];
  suitable_for?: string[];
  risk_level?: string;
  scores: PlanScores;
  // Recommendation quality
  why_this_plan?: string;
  why_not_others?: string;
  future_benefits?: string;
  claim_experience?: string;
  advantages?: string[];
  limitations?: string[];
}

export interface ChatMsg {
  id: string;
  sender: "user" | "advisor";
  text: string;
  timestamp: string;
  agentName?: string;
  agentDomain?: string;
  transferred?: boolean;
  transferFromName?: string;
  transferToName?: string;
  isStreaming?: boolean;
}

export interface ChatMessageProps {
  message: ChatMsg;
  advisorAvatar?: string;
  advisorTheme?: string;
  onUIAction?: (action: string, planData: RecommendationData) => void;
  onOptionClick?: (text: string) => void;
  onRegenerate?: (msgId: string) => void;
  onVoicePlay?: (text: string) => void;
}

// ── Recommendation parsing ─────────────────────────────────────────────────────

function parseRecommendation(text: string): { data: RecommendationData; cleanedText: string } | null {
  const startTag = "[RECOMMENDATION:";
  const start = text.indexOf(startTag);
  if (start === -1) return null;

  const jsonStart = start + startTag.length;
  if (jsonStart >= text.length) return null;

  // Balance-walk to find the matching closing bracket of the JSON object
  let depth = 0;
  let inString = false;
  let escape = false;
  let jsonEnd = -1;

  for (let i = jsonStart; i < text.length; i++) {
    const ch = text[i];
    if (escape) { escape = false; continue; }
    if (ch === "\\" && inString) { escape = true; continue; }
    if (ch === '"') { inString = !inString; continue; }
    if (inString) continue;
    if (ch === "{" || ch === "[") depth++;
    else if (ch === "}" || ch === "]") {
      depth--;
      if (depth === 0) { jsonEnd = i; break; }
    }
  }

  if (jsonEnd === -1) return null;

  const jsonStr = text.slice(jsonStart, jsonEnd + 1);
  let data: RecommendationData | null = null;
  try { data = JSON.parse(jsonStr); } catch { return null; }
  if (!data) return null;

  // The full tag is [RECOMMENDATION:{...json...}] — ends at jsonEnd+1 (the outer "]")
  const tagEnd = jsonEnd + 1;
  const trailingBracket = text[tagEnd] === "]" ? tagEnd + 1 : tagEnd;
  const fullTag = text.slice(start, trailingBracket);
  const cleanedText = text.replace(fullTag, "").trim();

  return { data, cleanedText };
}

// ── Markdown-aware text renderer ───────────────────────────────────────────────

const MarkdownLine = memo(function MarkdownLine({ text }: { text: string }) {
  if (!text.includes("**") && !text.includes("`")) {
    return <>{text}</>;
  }
  const parts = text.split(/(\*\*[^*]+\*\*|`[^`]+`)/g);
  return (
    <>
      {parts.map((p, i) => {
        if (p.startsWith("**") && p.endsWith("**")) {
          return <strong key={i} className="text-white font-bold">{p.slice(2, -2)}</strong>;
        }
        if (p.startsWith("`") && p.endsWith("`")) {
          return <code key={i} className="px-1 py-0.5 rounded bg-white/5 text-cyan-300 text-[11px] font-mono">{p.slice(1, -1)}</code>;
        }
        return <span key={i}>{p}</span>;
      })}
    </>
  );
});

const FormattedText = memo(function FormattedText({
  text,
  onOptionClick,
}: {
  text: string;
  onOptionClick?: (t: string) => void;
}) {
  const lines = text.split("\n");
  const elements: React.ReactNode[] = [];
  let tableBuffer: string[] = [];

  const flushTable = (key: string) => {
    if (tableBuffer.length < 2) {
      tableBuffer.forEach((l, i) => elements.push(<p key={`${key}-t${i}`} className="text-xs text-slate-400 leading-relaxed">{l}</p>));
      tableBuffer = [];
      return;
    }
    const rows = tableBuffer.filter(l => !l.match(/^\|[\s\-|]+\|$/));
    elements.push(
      <div key={key} className="overflow-x-auto rounded-xl border border-white/5 mt-2 mb-1">
        <table className="w-full text-xs border-collapse">
          <tbody>
            {rows.map((row, ri) => {
              const cells = row.split("|").filter((_, ci) => ci > 0 && ci < row.split("|").length - 1);
              const isHeader = ri === 0;
              return (
                <tr key={ri} className={isHeader ? "bg-white/5" : "border-t border-white/5 hover:bg-white/[0.02]"}>
                  {cells.map((cell, ci) => (
                    <td key={ci} className={`px-3 py-2 ${isHeader ? "font-bold text-white/70 text-[10px] uppercase tracking-wide" : "text-slate-400"}`}>
                      {cell.trim()}
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    );
    tableBuffer = [];
  };

  lines.forEach((line, i) => {
    const t = line.trim();
    const key = `l-${i}`;

    // Table row
    if (t.startsWith("|") && t.endsWith("|")) {
      tableBuffer.push(t);
      return;
    } else if (tableBuffer.length > 0) {
      flushTable(`table-${i}`);
    }

    if (!t) { elements.push(<div key={key} className="h-2" />); return; }

    // H1/H2/H3 headers
    if (t.startsWith("### ")) { elements.push(<p key={key} className="text-xs font-bold text-white/70 mt-2 mb-0.5 uppercase tracking-wide">{t.slice(4)}</p>); return; }
    if (t.startsWith("## "))  { elements.push(<p key={key} className="text-sm font-bold text-white mt-2 mb-1">{t.slice(3)}</p>); return; }
    if (t.startsWith("# "))   { elements.push(<p key={key} className="text-base font-extrabold text-white mt-2 mb-1">{t.slice(2)}</p>); return; }

    // Numbered clickable options: "1. ..."
    const numMatch = t.match(/^(\d+)\.\s(.+)$/);
    if (numMatch) {
      elements.push(
        <button
          key={key}
          onClick={() => onOptionClick?.(numMatch[2])}
          className="w-full text-left flex items-center gap-3 px-4 py-2.5 rounded-2xl border border-white/5 bg-white/[0.02] hover:bg-white/[0.05] hover:border-cyan-500/25 transition-all group cursor-pointer my-0.5"
        >
          <span className="w-6 h-6 rounded-lg bg-white/5 text-[10px] font-black text-white/50 flex items-center justify-center flex-shrink-0 group-hover:bg-cyan-500/15 group-hover:text-cyan-400 transition-colors">
            {numMatch[1]}
          </span>
          <span className="text-xs text-slate-300 flex-1 group-hover:text-white transition-colors">
            <MarkdownLine text={numMatch[2]} />
          </span>
          <ChevronRight className="w-3.5 h-3.5 text-white/15 group-hover:text-cyan-400 group-hover:translate-x-0.5 transition-all" />
        </button>
      );
      return;
    }

    // Bullet points: "- " or "• "
    if (t.startsWith("- ") || t.startsWith("• ")) {
      elements.push(
        <div key={key} className="flex items-start gap-2.5 pl-1 my-0.5">
          <span className="mt-2 w-1.5 h-1.5 rounded-full bg-white/20 flex-shrink-0" />
          <span className="text-xs text-slate-400 leading-relaxed flex-1">
            <MarkdownLine text={t.replace(/^[-•]\s/, "")} />
          </span>
        </div>
      );
      return;
    }

    // Checkmark lines: "✅ ..."
    if (t.startsWith("✅") || t.startsWith("✓")) {
      const content = t.replace(/^[✅✓]\s*/, "");
      elements.push(
        <div key={key} className="flex items-start gap-2 pl-1 my-0.5">
          <CheckCircle className="w-3.5 h-3.5 text-emerald-400 mt-0.5 flex-shrink-0" />
          <span className="text-xs text-slate-350 leading-relaxed flex-1">
            <MarkdownLine text={content} />
          </span>
        </div>
      );
      return;
    }

    // Emoji section headers: "💡 ...", "⚡ ...", "🔑 ...", "🎯 ..."
    if (/^[💡⚡🔑🎯🛡️📊🌍🏠🚗✈️💼]/.test(t)) {
      elements.push(
        <p key={key} className="text-[11px] font-bold text-white/70 mt-3 mb-1 flex items-center gap-1.5 uppercase tracking-wide">
          {t}
        </p>
      );
      return;
    }

    // First line (greeting/opener) — slightly larger
    if (i === 0) {
      elements.push(
        <p key={key} className="text-[13px] font-semibold text-slate-100 leading-relaxed">
          <MarkdownLine text={t} />
        </p>
      );
      return;
    }

    // Normal paragraph
    elements.push(
      <p key={key} className="text-xs text-slate-400 leading-relaxed">
        <MarkdownLine text={t} />
      </p>
    );
  });

  if (tableBuffer.length > 0) flushTable("table-end");

  return <div className="space-y-1.5">{elements}</div>;
});

// ── Score bar ─────────────────────────────────────────────────────────────────

function ScoreBar({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between">
        <span className="text-[9px] text-slate-500 font-bold uppercase tracking-wide">{label}</span>
        <span className={`text-[9px] font-black font-mono ${color}`}>{value}%</span>
      </div>
      <div className="h-1 rounded-full bg-white/5 overflow-hidden">
        <motion.div
          className={`h-full rounded-full ${color.replace("text-", "bg-")}`}
          initial={{ width: 0 }}
          animate={{ width: `${value}%` }}
          transition={{ duration: 0.7, ease: "easeOut", delay: 0.1 }}
        />
      </div>
    </div>
  );
}

// ── Single plan card within multi-plan suite ───────────────────────────────────

const MultiPlanCard = memo(function MultiPlanCard({
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

// ── Comparison view ───────────────────────────────────────────────────────────

const ComparisonView = memo(function ComparisonView({
  plans,
  category,
  onSelect,
}: {
  plans: MultiPlan[];
  category: string;
  onSelect: (plan: MultiPlan) => void;
}) {
  const isHealth   = category === "health";
  const isMotor    = category === "motor";
  const isProperty = category === "property";
  const isTravel   = category === "travel";

  const rankColors = ["text-cyan-400", "text-blue-400", "text-violet-400"];
  const rankBorders = ["border-cyan-500/30", "border-blue-500/20", "border-violet-500/15"];
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

// ── Multi-plan recommendation suite ───────────────────────────────────────────

const MultiPlanSuite = memo(function MultiPlanSuite({
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

// ── Recommendation Card ────────────────────────────────────────────────────────

const RecommendationCard = memo(function RecommendationCard({
  data,
  onUIAction,
}: {
  data: RecommendationData;
  onUIAction?: (action: string, planData: RecommendationData) => void;
}) {
  const rawCat = (data.category || "health").toLowerCase();
  let cat = rawCat;
  if (rawCat.includes("property") || rawCat.includes("home")) cat = "property";
  else if (rawCat.includes("motor") || rawCat.includes("vehicle") || rawCat.includes("car") || rawCat.includes("bike")) cat = "motor";
  else if (rawCat.includes("travel")) cat = "travel";
  else if (rawCat.includes("misc") || rawCat.includes("general") || rawCat.includes("executive")) cat = "miscellaneous";

  const CONFIG: Record<string, { Icon: React.ComponentType<{ className?: string }>; label: string; grad: string; border: string; shadow: string; accent: string }> = {
    health:       { Icon: Activity,  label: "HEALTH MATCH DETECTED",   grad: "from-cyan-400 to-teal-400",    border: "border-cyan-500/25",    shadow: "shadow-[0_12px_32px_rgba(6,182,212,0.12)]",     accent: "text-cyan-400" },
    motor:        { Icon: Car,       label: "MOTOR MATCH DETECTED",    grad: "from-blue-400 to-indigo-400",  border: "border-blue-500/25",    shadow: "shadow-[0_12px_32px_rgba(59,130,246,0.12)]",    accent: "text-blue-400" },
    travel:       { Icon: Globe,     label: "TRAVEL MATCH DETECTED",   grad: "from-amber-400 to-orange-400", border: "border-amber-500/25",   shadow: "shadow-[0_12px_32px_rgba(245,158,11,0.12)]",    accent: "text-amber-400" },
    property:     { Icon: Home,      label: "PROPERTY MATCH DETECTED", grad: "from-emerald-400 to-teal-400", border: "border-emerald-500/25", shadow: "shadow-[0_12px_32px_rgba(16,185,129,0.12)]",    accent: "text-emerald-400" },
    miscellaneous:{ Icon: Shield,    label: "GENERAL MATCH DETECTED",  grad: "from-rose-400 to-pink-400",    border: "border-rose-500/25",    shadow: "shadow-[0_12px_32px_rgba(244,63,94,0.12)]",     accent: "text-rose-400" },
  };

  const cfg = CONFIG[cat] || CONFIG.health;
  const { Icon, label, grad, border, shadow, accent } = cfg;

  const isLowRisk = (data.riskLevel || "").toLowerCase().includes("low");
  const isHighRisk = (data.riskLevel || "").toLowerCase().includes("high") || (data.riskLevel || "").toLowerCase().includes("critical");
  const riskColor = isLowRisk ? "text-emerald-400" : isHighRisk ? "text-rose-400" : "text-amber-400";

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.97, y: 8 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      transition={{ type: "spring", stiffness: 180, damping: 22, delay: 0.05 }}
      className={`w-full max-w-lg rounded-[24px] border-2 ${border} bg-gradient-to-br from-slate-950 via-slate-900/95 to-slate-950 ${shadow} relative overflow-hidden mt-3`}
    >
      {/* Shimmer */}
      <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/[0.03] to-transparent -skew-x-12 pointer-events-none" />

      <div className="relative z-10 p-5 space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Icon className={`w-4 h-4 ${accent}`} />
            <span className={`text-[9px] font-black uppercase tracking-widest bg-gradient-to-r ${grad} bg-clip-text text-transparent`}>{label}</span>
          </div>
          <span className="flex items-center gap-1 text-[9px] font-mono font-black bg-emerald-500/10 text-emerald-400 py-0.5 px-2.5 rounded-full border border-emerald-500/20">
            <Award className="w-2.5 h-2.5" />{data.score || 98}% Fit
          </span>
        </div>

        {/* Plan name + premium */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-[8px] text-slate-500 font-bold uppercase tracking-wide mb-1">Recommended Plan</p>
            <h4 className="text-base font-black text-white leading-tight">{data.planName}</h4>
          </div>
          <div className="text-right flex-shrink-0">
            <p className="text-[8px] text-slate-500 font-bold uppercase tracking-wide mb-1">Premium</p>
            <p className={`text-lg font-black font-mono ${accent}`}>{data.premium}</p>
            <p className="text-[10px] text-slate-400 mt-0.5">{data.coverage} cover</p>
          </div>
        </div>

        {/* Core metrics */}
        <div className="grid grid-cols-3 gap-2 bg-slate-900/50 p-3 rounded-xl border border-white/5">
          {[
            { label: "Claim Ratio", value: data.claimSettlementRatio || "99.1%", color: "text-emerald-400" },
            { label: "Risk Tier",   value: data.riskLevel || "Low Risk",           color: riskColor },
            { label: "Confidence",  value: `${data.confidenceScore || 0.98}/1.0`,  color: "text-cyan-400" },
          ].map(({ label: l, value, color }) => (
            <div key={l} className="text-center py-1">
              <p className="text-[8px] text-slate-500 uppercase font-black mb-0.5">{l}</p>
              <p className={`text-[11px] font-black font-mono ${color}`}>{value}</p>
            </div>
          ))}
        </div>

        {/* Category-specific metrics */}
        {cat === "motor" && (
          <div className="bg-slate-950/50 p-3 rounded-xl border border-white/5 space-y-2 text-xs font-semibold text-slate-300">
            <div className="grid grid-cols-2 gap-3">
              <div><p className="text-[8px] text-slate-500 uppercase font-black mb-0.5">IDV</p><p className="font-mono">{data.idvValue || "₹8,50,000"}</p></div>
              <div className="text-right"><p className="text-[8px] text-slate-500 uppercase font-black mb-0.5">OD / TP</p><p className="font-mono">{data.ownDamageCover || "₹12,500"} / {data.thirdPartyCover || "₹3,500"}</p></div>
            </div>
            <div className="flex gap-2 flex-wrap text-[9px] text-blue-400 uppercase font-black pt-1 border-t border-white/5">
              <span>{data.zeroDep || "Zero Dep"}</span><span className="text-white/10">·</span>
              <span>{data.roadsideAssistance || "Roadside"}</span><span className="text-white/10">·</span>
              <span>{data.engineProtection || "Engine Shield"}</span>
            </div>
          </div>
        )}
        {cat === "travel" && (
          <div className="bg-slate-950/50 p-3 rounded-xl border border-white/5 space-y-2 text-xs font-semibold text-slate-300">
            <div className="grid grid-cols-2 gap-3">
              <div><p className="text-[8px] text-slate-500 uppercase font-black mb-0.5">Destination</p><p>{data.destination || "International"}</p></div>
              <div className="text-right"><p className="text-[8px] text-slate-500 uppercase font-black mb-0.5">Medical / Evac</p><p className="font-mono">{data.medicalCoverage || "$100K"} / {data.emergencyEvacuation || "$50K"}</p></div>
            </div>
            <div className="flex gap-2 flex-wrap text-[9px] text-amber-400 uppercase font-black pt-1 border-t border-white/5">
              <span>Cancel: {data.tripCancellation || "$2,500"}</span><span className="text-white/10">·</span>
              <span>Baggage: {data.baggageLoss || "$1,000"}</span>
            </div>
          </div>
        )}
        {cat === "property" && (
          <div className="bg-slate-950/50 p-3 rounded-xl border border-white/5 space-y-2 text-xs font-semibold text-slate-300">
            <div className="grid grid-cols-2 gap-3">
              <div><p className="text-[8px] text-slate-500 uppercase font-black mb-0.5">Structure</p><p className="font-mono">{data.structureCover || "₹80L"}</p></div>
              <div className="text-right"><p className="text-[8px] text-slate-500 uppercase font-black mb-0.5">Contents</p><p className="font-mono">{data.contentsCover || "₹20L"}</p></div>
            </div>
            <div className="flex gap-2 flex-wrap text-[9px] text-emerald-400 uppercase font-black pt-1 border-t border-white/5">
              <span>{data.fireProtection || "Fire"}</span><span className="text-white/10">·</span>
              <span>{data.naturalDisasterCover || "Disaster"}</span><span className="text-white/10">·</span>
              <span>{data.theftCover || "Theft"}</span>
            </div>
          </div>
        )}

        {/* Executive approval */}
        {data.executiveApproval && (
          <div className="flex items-start gap-2.5 bg-emerald-500/5 p-3 rounded-xl border border-emerald-500/15">
            <ShieldCheck className="w-4 h-4 text-emerald-400 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-[8px] text-emerald-400/70 font-black uppercase tracking-wide">CRO Approval</p>
              <p className="text-[11px] text-slate-400 mt-0.5">{data.executiveApproval}</p>
            </div>
          </div>
        )}

        {/* Benefits */}
        <div className="space-y-1.5">
          <p className="text-[8px] text-slate-500 font-black uppercase tracking-wide">Benefits</p>
          <div className="grid grid-cols-1 gap-1.5">
            {(data.benefits || []).map((b, i) => (
              <div key={i} className="flex items-center gap-2 text-xs">
                <CheckCircle className={`w-3.5 h-3.5 ${accent} flex-shrink-0`} />
                <span className="text-slate-300">{b}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Action buttons */}
        <div className="space-y-2 pt-1">
          <div className="grid grid-cols-2 gap-2">
            <button onClick={() => onUIAction?.("view_details", data)}
              className="py-2.5 rounded-xl text-[10px] font-black uppercase tracking-wider border border-white/10 hover:border-white/20 bg-white/5 hover:bg-white/10 text-slate-300 flex items-center justify-center gap-1.5 transition-all cursor-pointer active:scale-95">
              <FileText className="w-3.5 h-3.5" /> View Details
            </button>
            <button onClick={() => onUIAction?.("compare_plans", data)}
              className="py-2.5 rounded-xl text-[10px] font-black uppercase tracking-wider border border-white/10 hover:border-white/20 bg-white/5 hover:bg-white/10 text-slate-300 flex items-center justify-center gap-1.5 transition-all cursor-pointer active:scale-95">
              <Scale className="w-3.5 h-3.5" /> Compare
            </button>
          </div>
          <button onClick={() => onUIAction?.("select_plan", data)}
            className={`w-full py-2.5 rounded-xl font-black text-[10px] uppercase tracking-wider bg-gradient-to-r ${grad} text-slate-950 flex items-center justify-center gap-2 hover:scale-[1.01] active:scale-95 transition-all cursor-pointer shadow-lg`}>
            <ShieldCheck className="w-3.5 h-3.5" /> Select Plan & Proceed
          </button>
        </div>
      </div>
    </motion.div>
  );
});

// ── Streaming cursor ───────────────────────────────────────────────────────────

export function StreamingCursor() {
  return (
    <motion.span
      className="inline-block w-[2px] h-4 bg-white/60 ml-[1px] align-middle rounded-full"
      animate={{ opacity: [1, 0, 1] }}
      transition={{ duration: 0.8, repeat: Infinity }}
    />
  );
}

// ── Transfer badge ─────────────────────────────────────────────────────────────

function TransferBadge({ from, to }: { from?: string; to?: string }) {
  if (!from && !to) return null;
  return (
    <motion.div
      initial={{ opacity: 0, y: -4 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/5 border border-white/10 text-[9px] text-white/40 font-medium w-fit mb-1.5"
    >
      {from && <span>{from}</span>}
      {from && to && <ArrowRight className="w-3 h-3" />}
      {to && <span className="text-cyan-400">{to}</span>}
    </motion.div>
  );
}

// ── Copy button ────────────────────────────────────────────────────────────────

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const copy = useCallback(() => {
    const clean = text.replace(/\[RECOMMENDATION:\{[\s\S]*?\}\]/g, "").trim();
    navigator.clipboard.writeText(clean).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [text]);

  return (
    <button onClick={copy} className="p-1.5 rounded-lg hover:bg-white/5 text-white/25 hover:text-white/50 transition-colors" title="Copy response">
      <AnimatePresence mode="wait">
        {copied
          ? <motion.div key="check" initial={{ scale: 0 }} animate={{ scale: 1 }}><Check className="w-3.5 h-3.5 text-emerald-400" /></motion.div>
          : <motion.div key="copy" initial={{ scale: 0 }} animate={{ scale: 1 }}><Copy className="w-3.5 h-3.5" /></motion.div>
        }
      </AnimatePresence>
    </button>
  );
}

// ── Main ChatMessage Component ─────────────────────────────────────────────────

const ChatMessage = memo(function ChatMessage({
  message,
  advisorAvatar = "S",
  advisorTheme = "from-emerald-600 to-teal-500",
  onUIAction,
  onOptionClick,
  onRegenerate,
  onVoicePlay,
}: ChatMessageProps) {
  const parsed = parseRecommendation(message.text);
  const displayText = parsed ? parsed.cleanedText : message.text;

  // ── User message ─────────────────────────────────────────────────────────
  if (message.sender === "user") {
    return (
      <motion.div
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex justify-end w-full"
      >
        <div className="max-w-[78%] space-y-1.5 text-right">
          <div className="px-4 py-3 rounded-3xl rounded-br-sm bg-slate-800/70 border border-white/8 text-[13px] font-medium text-slate-200 text-left leading-relaxed shadow-sm">
            {message.text}
          </div>
          <p className="text-[9px] text-slate-600 px-1">{message.timestamp}</p>
        </div>
      </motion.div>
    );
  }

  // ── Advisor message ───────────────────────────────────────────────────────
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.22 }}
      className="flex items-start gap-3 w-full"
    >
      {/* Avatar */}
      <div className={`w-9 h-9 rounded-xl bg-gradient-to-tr ${advisorTheme} text-white font-black text-sm flex items-center justify-center flex-shrink-0 shadow-lg`}>
        {advisorAvatar}
      </div>

      <div className="flex-1 min-w-0 space-y-1.5">
        {/* Agent name + transfer badge */}
        <div className="flex items-center gap-2">
          <p className="text-[10px] font-black uppercase tracking-wider text-slate-500">
            {message.agentName || "Sarah AI"}
          </p>
          {message.transferred && (
            <TransferBadge from={message.transferFromName} to={message.agentName} />
          )}
        </div>

        {/* Message bubble */}
        {displayText.trim() && (
          <div className="rounded-3xl rounded-tl-sm px-5 py-4 border border-white/5 bg-slate-900/60 backdrop-blur-sm shadow-sm">
            <FormattedText
              text={displayText}
              onOptionClick={onOptionClick}
            />
            {/* Streaming cursor */}
            {message.isStreaming && (
              <span className="mt-1 inline-block">
                <StreamingCursor />
              </span>
            )}
          </div>
        )}

        {/* Recommendation card — single or multi-plan */}
        {parsed && !message.isStreaming && (
          parsed.data.type === "multi_plan" && parsed.data.plans?.length
            ? <MultiPlanSuite data={parsed.data} onUIAction={onUIAction} />
            : <RecommendationCard data={parsed.data} onUIAction={onUIAction} />
        )}

        {/* Timestamp + action buttons */}
        {!message.isStreaming && (
          <div className="flex items-center gap-1 px-1">
            <p className="text-[9px] text-slate-600 flex-1">{message.timestamp}</p>
            <CopyButton text={message.text} />
            {onVoicePlay && (
              <button
                onClick={() => onVoicePlay(displayText)}
                className="p-1.5 rounded-lg hover:bg-white/5 text-white/25 hover:text-white/50 transition-colors"
                title="Read aloud"
              >
                <Volume2 className="w-3.5 h-3.5" />
              </button>
            )}
            {onRegenerate && (
              <button
                onClick={() => onRegenerate(message.id)}
                className="p-1.5 rounded-lg hover:bg-white/5 text-white/25 hover:text-white/50 transition-colors"
                title="Regenerate response"
              >
                <RefreshCw className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        )}
      </div>
    </motion.div>
  );
});

export default ChatMessage;
