"use client";
import React, { memo } from "react";
import { motion } from "framer-motion";
import { CheckCircle, ArrowRight, Award, ShieldCheck, FileText, Scale, Car, Globe, Home, Shield, Activity } from "lucide-react";

interface RecommendationData {
  planName: string;
  coverage: string;
  premium: string;
  benefits: string[];
  reason?: string;
  score: number;
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
  alternativePlan?: any;
  category?: string;
  idvValue?: string;
  ownDamageCover?: string;
  thirdPartyCover?: string;
  zeroDep?: string;
  roadsideAssistance?: string;
  engineProtection?: string;
  destination?: string;
  medicalCoverage?: string;
  tripCancellation?: string;
  baggageLoss?: string;
  emergencyEvacuation?: string;
  propertyCoverage?: string;
  fireProtection?: string;
  naturalDisasterCover?: string;
  theftCover?: string;
  structureCover?: string;
  contentsCover?: string;
}

interface AIChatMessageProps {
  text: string;
  advisorName: string;
  advisorAvatar: string;
  advisorTheme: string;
  timestamp: string;
  theme: "dark" | "light";
  onApplyPlan?: (planName: string) => void;
  onOptionClick?: (optionText: string) => void;
  onUIAction?: (action: string, planData: RecommendationData) => void;
}

function parseRecommendation(text: string): { data: RecommendationData; cleanedText: string } | null {
  const startTag = "[RECOMMENDATION:";
  const start = text.indexOf(startTag);
  if (start === -1) return null;
  const jsonStart = start + startTag.length;
  
  // Find matching closing bracket ']' starting from the end
  const end = text.lastIndexOf("]");
  if (end === -1 || end < jsonStart) return null;
  
  const jsonStr = text.slice(jsonStart, end);
  try {
    const data = JSON.parse(jsonStr);
    const fullTag = text.slice(start, end + 1);
    const cleanedText = text.replace(fullTag, "").trim();
    return { data, cleanedText };
  } catch {
    // Fallback parsing logic
    const end2 = text.indexOf("}]", jsonStart);
    if (end2 === -1) return null;
    const jsonStr2 = text.slice(jsonStart, end2 + 1);
    try {
      const data2 = JSON.parse(jsonStr2);
      const fullTag2 = text.slice(start, end2 + 2);
      const cleanedText2 = text.replace(fullTag2, "").trim();
      return { data: data2, cleanedText: cleanedText2 };
    } catch {
      return null;
    }
  }
}

// Renders structured AI text into readable sections (fully memoized)
const FormattedText = memo(function FormattedText({
  text,
  theme,
  onOptionClick,
}: {
  text: string;
  theme: "dark" | "light";
  onOptionClick?: (optionText: string) => void;
}) {
  const isDark = theme === "dark";
  const lines = text.split("\n");

  return (
    <div className="space-y-3">
      {lines.map((line, i) => {
        const trimmed = line.trim();
        if (!trimmed) return <div key={i} className="h-1" />;

        // Numbered option lines: "1. Budget-friendly plans" — these are clickable selection triggers
        if (/^\d+\.\s/.test(trimmed)) {
          const num = trimmed.match(/^(\d+)\.\s(.*)/)!;
          const optionLabel = num[2];
          return (
            <button
              key={i}
              onClick={() => onOptionClick?.(optionLabel)}
              className={`w-full text-left flex items-center gap-3.5 px-4 py-3 rounded-2xl border transition-all duration-200 cursor-pointer group active:scale-95 active:shadow-[0_0_12px_rgba(6,182,212,0.3)] touch-manipulation select-none ${
                isDark
                  ? "bg-slate-950/40 border-white/5 hover:bg-white/[0.03] hover:border-cyan-500/35 hover:shadow-[0_0_15px_rgba(6,182,212,0.12)]"
                  : "bg-slate-50 border-slate-200 hover:bg-royal-50/50 hover:border-royal-400/35 shadow-sm"
              }`}
            >
              <span className={`w-6.5 h-6.5 rounded-xl flex items-center justify-center text-[10px] font-black flex-shrink-0 transition-colors duration-200 ${
                isDark ? "bg-cyan-500/10 text-cyan-400 group-hover:bg-cyan-500/25" : "bg-royal-100 text-royal-700 group-hover:bg-royal-200"
              }`}>
                {num[1]}
              </span>
              <span className={`text-xs font-semibold flex-grow transition-colors ${isDark ? "text-slate-300 group-hover:text-white" : "text-slate-700 group-hover:text-slate-900"}`}>{optionLabel}</span>
              <ArrowRight className={`w-3.5 h-3.5 opacity-0 group-hover:opacity-100 transition-all duration-200 translate-x-[-4px] group-hover:translate-x-0 ${isDark ? "text-cyan-450" : "text-royal-600"}`} />
            </button>
          );
        }

        // Bullet lines starting with • or -
        if (trimmed.startsWith("•") || trimmed.startsWith("-")) {
          const content = trimmed.replace(/^[•\-]\s*/, "");
          return (
            <div key={i} className="flex items-start gap-2.5 pl-1.5">
              <span className={`mt-2 w-1.5 h-1.5 rounded-full flex-shrink-0 ${isDark ? "bg-cyan-400 animate-pulse" : "bg-royal-500"}`} />
              <span className={`text-xs leading-relaxed ${isDark ? "text-slate-400" : "text-slate-655"}`}>{content}</span>
            </div>
          );
        }

        // Checkmark lines: "✅ ..."
        if (trimmed.startsWith("✅")) {
          const content = trimmed.replace(/^✅\s*/, "");
          if (content.endsWith(":")) {
            return (
              <p key={i} className={`text-xs font-black mt-1 uppercase tracking-wider ${isDark ? "text-slate-200" : "text-slate-800"}`}>
                ✅ {content}
              </p>
            );
          }
          return (
            <div key={i} className="flex items-start gap-2.5 pl-1.5">
              <CheckCircle className={`w-4 h-4 mt-0.5 flex-shrink-0 ${isDark ? "text-emerald-400" : "text-emerald-500"}`} />
              <span className={`text-xs leading-relaxed ${isDark ? "text-slate-350" : "text-slate-650"}`}>{content}</span>
            </div>
          );
        }

        // 💡 section headers
        if (trimmed.startsWith("💡") || trimmed.startsWith("⚡") || trimmed.startsWith("🔑") || trimmed.startsWith("🎯")) {
          return (
            <p key={i} className={`text-xs font-black mt-2.5 uppercase tracking-wide flex items-center gap-1.5 ${isDark ? "text-slate-200" : "text-slate-850"}`}>
              <span>{trimmed.substring(0, 2)}</span>
              <span>{trimmed.substring(2)}</span>
            </p>
          );
        }

        // Bold text wrapped in **
        if (trimmed.includes("**")) {
          const parts = trimmed.split(/\*\*(.*?)\*\*/g);
          return (
            <p key={i} className={`text-xs leading-relaxed ${isDark ? "text-slate-350" : "text-slate-650"}`}>
              {parts.map((part, pi) =>
                pi % 2 === 1
                  ? <strong key={pi} className={isDark ? "text-white font-extrabold" : "text-slate-900 font-extrabold"}>{part}</strong>
                  : part
              )}
            </p>
          );
        }

        // First line treatment — slightly larger greeting
        if (i === 0) {
          return (
            <p key={i} className={`text-xs sm:text-[13px] font-bold leading-relaxed ${isDark ? "text-slate-100" : "text-slate-800"}`}>
              {trimmed}
            </p>
          );
        }

        // Normal paragraph
        return (
          <p key={i} className={`text-xs leading-relaxed ${isDark ? "text-slate-355" : "text-slate-600"}`}>
            {trimmed}
          </p>
        );
      })}
    </div>
  );
});

// Holographic recommendation card (fully memoized)
const RecommendationCard = memo(function RecommendationCard({
  data,
  onApply,
  onUIAction,
}: {
  data: RecommendationData;
  onApply?: (planName: string) => void;
  onUIAction?: (action: string, planData: RecommendationData) => void;
}) {
  const handleViewDetails = () => {
    localStorage.setItem("selectedPlanDetails", JSON.stringify(data));
    if (onUIAction) {
      onUIAction("view_details", data);
    } else {
      window.location.href = "/policies/details";
    }
  };

  const handleCompare = () => {
    localStorage.setItem("selectedPlanDetails", JSON.stringify(data));
    if (onUIAction) {
      onUIAction("compare_plans", data);
    } else {
      window.location.href = "/policies/details?compare=true";
    }
  };

  const handleSelectPlan = () => {
    if (onUIAction) {
      onUIAction("select_plan", data);
    } else {
      onApply?.(data.planName);
    }
  };

  // Determine and normalize category variables (support 'home-property', 'home_property', etc.)
  const rawCat = (data.category || "health").toLowerCase();
  let cat = rawCat;
  // Normalize common variants to UI categories
  if (rawCat.includes("property") || rawCat.includes("home-property") || rawCat.includes("home_property")) {
    cat = "property";
  } else if (rawCat.includes("motor") || rawCat.includes("vehicle") || rawCat.includes("car") || rawCat.includes("bike") || rawCat.includes("two-wheeler")) {
    cat = "motor";
  } else if (rawCat.includes("travel") || rawCat.includes("destination") || rawCat.includes("international") || rawCat.includes("domestic")) {
    cat = "travel";
  } else if (rawCat.includes("misc") || rawCat.includes("miscellaneous") || rawCat.includes("general")) {
    cat = "miscellaneous";
  } else {
    cat = rawCat;
  }
  let CategoryIcon = Activity;
  let categoryLabel = "HOLOGRAPHIC MATCH DETECTED";
  let themeGradient = "from-cyan-400 to-purple-400";
  let cardBorder = "border-cyan-500/25";
  let cardShadow = "shadow-[0_15px_40px_rgba(6,182,212,0.15)]";
  let textTheme = "text-cyan-400";
  
  if (cat === "motor") {
    CategoryIcon = Car;
    categoryLabel = "MOTOR MATCH DETECTED";
    themeGradient = "from-blue-400 to-indigo-400";
    cardBorder = "border-blue-500/25";
    cardShadow = "shadow-[0_15px_40px_rgba(59,130,246,0.15)]";
    textTheme = "text-blue-400";
  } else if (cat === "travel") {
    CategoryIcon = Globe;
    categoryLabel = "TRAVEL MATCH DETECTED";
    themeGradient = "from-amber-400 to-orange-400";
    cardBorder = "border-amber-500/25";
    cardShadow = "shadow-[0_15px_40px_rgba(245,158,11,0.15)]";
    textTheme = "text-amber-400";
  } else if (cat === "property") {
    CategoryIcon = Home;
    categoryLabel = "PROPERTY MATCH DETECTED";
    themeGradient = "from-emerald-400 to-teal-400";
    cardBorder = "border-emerald-500/25";
    cardShadow = "shadow-[0_15px_40px_rgba(16,185,129,0.15)]";
    textTheme = "text-emerald-400";
  } else if (cat === "miscellaneous") {
    CategoryIcon = Shield;
    categoryLabel = "GENERAL MATCH DETECTED";
    themeGradient = "from-pink-400 to-rose-400";
    cardBorder = "border-pink-500/25";
    cardShadow = "shadow-[0_15px_40px_rgba(244,63,94,0.15)]";
    textTheme = "text-pink-400";
  }

  // Determine risk badge color
  const isLowRisk = (data.riskLevel || "").toLowerCase().includes("low");
  const isHighRisk = (data.riskLevel || "").toLowerCase().includes("high") || (data.riskLevel || "").toLowerCase().includes("critical");
  const riskColor = isLowRisk ? "text-emerald-400 bg-emerald-500/10 border-emerald-500/20" : isHighRisk ? "text-rose-400 bg-rose-500/10 border-rose-500/20" : "text-amber-400 bg-amber-500/10 border-amber-500/20";

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.96, y: 12 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      transition={{ type: "spring", stiffness: 150, damping: 20, delay: 0.05 }}
      className={`w-full max-w-lg rounded-[28px] border-2 ${cardBorder} bg-gradient-to-br from-slate-950 via-slate-900/95 to-slate-950 text-white ${cardShadow} relative overflow-hidden mt-3`}
    >
      {/* Shimmer Overlay */}
      <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/[0.04] to-transparent -skew-x-12 pointer-events-none" />
      <div className={`absolute top-0 right-0 w-32 h-32 rounded-full bg-cyan-400/5 blur-2xl pointer-events-none`} />

      <div className="relative z-10 p-5 sm:p-6 space-y-5 text-left">
        {/* Header Badge */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CategoryIcon className={`w-4.5 h-4.5 ${textTheme} animate-pulse`} />
            <span className={`text-[10px] font-black uppercase tracking-widest bg-gradient-to-r ${themeGradient} bg-clip-text text-transparent`}>
              {categoryLabel}
            </span>
          </div>
          <span className="flex items-center gap-1 text-[9px] font-mono font-black uppercase bg-emerald-500/15 text-emerald-400 py-1 px-3 rounded-full border border-emerald-500/25">
            <Award className="w-3 h-3" />
            {data.score || 98}% Fit
          </span>
        </div>

        {/* Plan Name + Pricing */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-[8.5px] text-slate-500 font-bold uppercase tracking-wider mb-1">Underwritten Plan</p>
            <h4 className="text-base font-black text-white leading-tight">{data.planName}</h4>
          </div>
          <div className="text-right">
            <p className="text-[8.5px] text-slate-500 font-bold uppercase tracking-wider mb-1">Target Premium</p>
            <p className={`text-lg font-black ${textTheme} font-mono`}>{data.premium}</p>
            <p className="text-[10px] text-slate-400 font-semibold mt-0.5">Cover limit: {data.coverage}</p>
          </div>
        </div>

        {/* Core Underwriting Metrics */}
        <div className="grid grid-cols-3 gap-2 bg-slate-900/60 p-3 rounded-2xl border border-white/5 text-[11px] font-semibold">
          <div className="text-center py-1">
            <p className="text-[8px] text-slate-500 uppercase font-black mb-0.5">Claim Ratio</p>
            <p className="text-emerald-400 font-black">{data.claimSettlementRatio || "99.1%"}</p>
          </div>
          <div className="text-center py-1 border-x border-white/5">
            <p className="text-[8px] text-slate-500 uppercase font-black mb-0.5">Risk Tier</p>
            <span className={`inline-block text-[10px] font-bold px-1.5 rounded ${riskColor.split(" ")[0]}`}>
              {data.riskLevel || "Low Risk"}
            </span>
          </div>
          <div className="text-center py-1">
            <p className="text-[8px] text-slate-500 uppercase font-black mb-0.5">Confidence</p>
            <p className={`text-cyan-400 font-mono font-black`}>{data.confidenceScore || 0.98}/1.0</p>
          </div>
        </div>

        {/* Category Specific Metrics Grid */}
        {cat === "motor" && (
          <div className="grid grid-cols-2 gap-3 bg-slate-950/60 p-3.5 rounded-2xl border border-white/5 text-[11px] font-semibold text-slate-300">
            <div>
              <p className="text-[8px] text-slate-500 uppercase font-black mb-0.5">Insured Declared Value (IDV)</p>
              <p className="text-white font-mono">{data.idvValue || "₹8,50,000"}</p>
            </div>
            <div className="text-right">
              <p className="text-[8px] text-slate-500 uppercase font-black mb-0.5">Damage / Third Party</p>
              <p className="text-white font-mono">{data.ownDamageCover || "₹12,500/year"} / {data.thirdPartyCover || "₹3,500/year"}</p>
            </div>
            <div className="col-span-2 pt-1 border-t border-white/5 flex gap-2 flex-wrap text-[9px] text-blue-450 uppercase font-black">
              <span>{data.zeroDep || "Zero Depreciation"}</span>
              <span className="text-slate-600">•</span>
              <span>{data.roadsideAssistance || "Roadside Assist"}</span>
              <span className="text-slate-600">•</span>
              <span>{data.engineProtection || "Engine Shield"}</span>
            </div>
          </div>
        )}

        {cat === "travel" && (
          <div className="grid grid-cols-2 gap-3 bg-slate-950/60 p-3.5 rounded-2xl border border-white/5 text-[11px] font-semibold text-slate-300">
            <div>
              <p className="text-[8px] text-slate-500 uppercase font-black mb-0.5">Destination</p>
              <p className="text-white">{data.destination || "International Cover"}</p>
            </div>
            <div className="text-right">
              <p className="text-[8px] text-slate-500 uppercase font-black mb-0.5">Medical / Evacuation</p>
              <p className="text-white font-mono">{data.medicalCoverage || "$100,000"} / {data.emergencyEvacuation || "$50,000"}</p>
            </div>
            <div className="col-span-2 pt-1 border-t border-white/5 flex gap-2 flex-wrap text-[9px] text-amber-450 uppercase font-black">
              <span>Trip Cancel: {data.tripCancellation || "$2,500"}</span>
              <span className="text-slate-600">•</span>
              <span>Baggage Loss: {data.baggageLoss || "$1,000"}</span>
            </div>
          </div>
        )}

        {cat === "property" && (
          <div className="grid grid-cols-2 gap-3 bg-slate-950/60 p-3.5 rounded-2xl border border-white/5 text-[11px] font-semibold text-slate-300">
            <div>
              <p className="text-[8px] text-slate-500 uppercase font-black mb-0.5">Structure Cover</p>
              <p className="text-white font-mono">{data.structureCover || "₹80 Lakhs"}</p>
            </div>
            <div className="text-right">
              <p className="text-[8px] text-slate-500 uppercase font-black mb-0.5">Contents Cover</p>
              <p className="text-white font-mono">{data.contentsCover || "₹20 Lakhs"}</p>
            </div>
            <div className="col-span-2 pt-1 border-t border-white/5 flex gap-2 flex-wrap text-[9px] text-emerald-450 uppercase font-black">
              <span>{data.fireProtection || "Fire Cover"}</span>
              <span className="text-slate-600">•</span>
              <span>{data.naturalDisasterCover || "Disaster Protection"}</span>
              <span className="text-slate-600">•</span>
              <span>{data.theftCover || "Burglary & Theft"}</span>
            </div>
          </div>
        )}

        {/* Executive Approval Badge */}
        {data.executiveApproval && (
          <div className="flex items-start gap-2.5 bg-emerald-500/5 p-3 rounded-2xl border border-emerald-500/15">
            <ShieldCheck className="w-5 h-5 text-emerald-400 flex-shrink-0 mt-0.5" />
            <div className="text-[11.5px] leading-relaxed">
              <span className="font-extrabold text-emerald-400 uppercase tracking-wider text-[9px] block">CRO EXECUTIVE APPROVAL STATUS</span>
              <p className="text-slate-350 font-medium">{data.executiveApproval}</p>
            </div>
          </div>
        )}

        {/* Benefits */}
        <div className="space-y-2">
          <p className="text-[8.5px] text-slate-500 font-bold uppercase tracking-wider">Qualified Underwriter Benefits</p>
          <div className="grid grid-cols-1 gap-2">
            {data.benefits.map((b, i) => (
              <div key={i} className="flex items-start gap-2 text-xs">
                <CheckCircle className={`w-4 h-4 ${textTheme} flex-shrink-0 mt-0.5`} />
                <span className="text-slate-300 font-semibold">{b}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Interactive Action Buttons */}
        <div className="space-y-2.5 pt-2">
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={handleViewDetails}
              className="py-3 px-4 rounded-2xl text-[11px] font-black uppercase tracking-widest border border-white/10 hover:border-white/20 bg-white/5 hover:bg-white/10 text-slate-200 hover:text-white flex items-center justify-center gap-1.5 transition-all duration-200 cursor-pointer active:scale-95 touch-manipulation select-none"
            >
              <FileText className="w-4.5 h-4.5" />
              <span>View Details</span>
            </button>
            <button
              onClick={handleCompare}
              className="py-3 px-4 rounded-2xl text-[11px] font-black uppercase tracking-widest border border-white/10 hover:border-white/20 bg-white/5 hover:bg-white/10 text-slate-200 hover:text-white flex items-center justify-center gap-1.5 transition-all duration-200 cursor-pointer active:scale-95 touch-manipulation select-none"
            >
              <Scale className="w-4.5 h-4.5" />
              <span>Compare Plan</span>
            </button>
          </div>
          <button
            onClick={handleSelectPlan}
            className={`w-full py-3 rounded-2xl font-black text-xs uppercase tracking-widest bg-gradient-to-r ${themeGradient} text-slate-950 flex items-center justify-center gap-2 transition-all duration-200 shadow-[0_8px_25px_rgba(6,182,212,0.15)] hover:scale-[1.01] active:scale-95 active:shadow-[0_0_15px_rgba(6,182,212,0.3)] touch-manipulation select-none cursor-pointer border border-white/10`}
          >
            <ShieldCheck className="w-4 h-4" />
            <span>Select Plan & Proceed</span>
          </button>
        </div>
      </div>
    </motion.div>
  );
});

// Primary Chat Message Container (fully memoized)
const AIChatMessage = memo(function AIChatMessage({
  text,
  advisorName,
  advisorAvatar,
  advisorTheme,
  timestamp,
  theme,
  onApplyPlan,
  onOptionClick,
  onUIAction,
}: AIChatMessageProps) {
  const isDark = theme === "dark";
  const parsed = parseRecommendation(text);
  const displayText = parsed ? parsed.cleanedText : text;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, ease: "easeOut" }}
      className="flex items-start gap-3 w-full"
    >
      {/* Avatar */}
      <div className={`w-9 h-9 rounded-xl bg-gradient-to-tr ${advisorTheme} text-white font-black text-sm flex items-center justify-center flex-shrink-0 shadow-lg`}>
        {advisorAvatar}
      </div>

      <div className="flex-1 space-y-1.5 min-w-0 text-left">
        {/* Advisor Name Label */}
        <p className={`text-[10px] font-black uppercase tracking-wider ${isDark ? "text-slate-500" : "text-slate-400"}`}>{advisorName}</p>

        {/* Message Card */}
        {displayText.trim() && (
          <div className={`rounded-3xl rounded-tl-lg px-5 py-4 border text-[13px] leading-relaxed font-semibold transition-all duration-300 ${
            isDark
              ? "bg-slate-900/60 border-white/5 backdrop-blur-md text-slate-300 shadow-sm"
              : "bg-white border-slate-200 text-slate-700 shadow-sm"
          }`}>
            <FormattedText text={displayText} theme={theme} onOptionClick={onOptionClick} />
          </div>
        )}

        {/* Recommendation Card */}
        {parsed && (
          <RecommendationCard data={parsed.data} onApply={onApplyPlan} onUIAction={onUIAction} />
        )}

        {/* Timestamp */}
        <p className={`text-[9.5px] px-1.5 ${isDark ? "text-slate-600" : "text-slate-450"}`}>{timestamp}</p>
      </div>
    </motion.div>
  );
});

export default AIChatMessage;
