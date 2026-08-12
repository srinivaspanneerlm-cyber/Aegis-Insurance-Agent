"use client";
import React, { memo } from "react";
import { motion } from "framer-motion";
import {
  CheckCircle, Award, ShieldCheck, FileText, Scale,
  Car, Globe, Home, Shield, Activity,
} from "lucide-react";
import type { RecommendationData } from "./types";
import { NOT_DISCLOSED } from "@/lib/platformFacts";

// ── Recommendation Card ────────────────────────────────────────────────────────

export const RecommendationCard = memo(function RecommendationCard({
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
            { label: "Claims actually paid", value: data.claimSettlementRatio || NOT_DISCLOSED, color: "text-emerald-400" },
            { label: "Risk Tier",   value: data.riskLevel || NOT_DISCLOSED,           color: riskColor },
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
              <div><p className="text-[8px] text-slate-500 uppercase font-black mb-0.5">IDV</p><p className="font-mono">{data.idvValue || NOT_DISCLOSED}</p></div>
              <div className="text-right"><p className="text-[8px] text-slate-500 uppercase font-black mb-0.5">OD / TP</p><p className="font-mono">{data.ownDamageCover || NOT_DISCLOSED} / {data.thirdPartyCover || NOT_DISCLOSED}</p></div>
            </div>
            <div className="flex gap-2 flex-wrap text-[9px] text-blue-400 uppercase font-black pt-1 border-t border-white/5">
              <span>{data.zeroDep || NOT_DISCLOSED}</span><span className="text-white/10">·</span>
              <span>{data.roadsideAssistance || NOT_DISCLOSED}</span><span className="text-white/10">·</span>
              <span>{data.engineProtection || NOT_DISCLOSED}</span>
            </div>
          </div>
        )}
        {cat === "travel" && (
          <div className="bg-slate-950/50 p-3 rounded-xl border border-white/5 space-y-2 text-xs font-semibold text-slate-300">
            <div className="grid grid-cols-2 gap-3">
              <div><p className="text-[8px] text-slate-500 uppercase font-black mb-0.5">Destination</p><p>{data.destination || NOT_DISCLOSED}</p></div>
              <div className="text-right"><p className="text-[8px] text-slate-500 uppercase font-black mb-0.5">Medical / Evac</p><p className="font-mono">{data.medicalCoverage || NOT_DISCLOSED} / {data.emergencyEvacuation || NOT_DISCLOSED}</p></div>
            </div>
            <div className="flex gap-2 flex-wrap text-[9px] text-amber-400 uppercase font-black pt-1 border-t border-white/5">
              <span>Cancel: {data.tripCancellation || NOT_DISCLOSED}</span><span className="text-white/10">·</span>
              <span>Baggage: {data.baggageLoss || NOT_DISCLOSED}</span>
            </div>
          </div>
        )}
        {cat === "property" && (
          <div className="bg-slate-950/50 p-3 rounded-xl border border-white/5 space-y-2 text-xs font-semibold text-slate-300">
            <div className="grid grid-cols-2 gap-3">
              <div><p className="text-[8px] text-slate-500 uppercase font-black mb-0.5">Structure</p><p className="font-mono">{data.structureCover || NOT_DISCLOSED}</p></div>
              <div className="text-right"><p className="text-[8px] text-slate-500 uppercase font-black mb-0.5">Contents</p><p className="font-mono">{data.contentsCover || NOT_DISCLOSED}</p></div>
            </div>
            <div className="flex gap-2 flex-wrap text-[9px] text-emerald-400 uppercase font-black pt-1 border-t border-white/5">
              <span>{data.fireProtection || NOT_DISCLOSED}</span><span className="text-white/10">·</span>
              <span>{data.naturalDisasterCover || NOT_DISCLOSED}</span><span className="text-white/10">·</span>
              <span>{data.theftCover || NOT_DISCLOSED}</span>
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
