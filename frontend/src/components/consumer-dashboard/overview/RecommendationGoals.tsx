"use client";

import { Sparkles, Clock, Heart, Car } from "lucide-react";
import { useTheme } from "@/context/ThemeContext";

/** Personalized protection goals: active + AI-recommended coverage cards. */
export function RecommendationGoals() {
  const { theme } = useTheme();

  return (
    <div className="space-y-4 text-left">
      <div className="flex items-center justify-between border-b border-white/5 pb-2">
        <h3 className={`font-black text-sm tracking-widest uppercase ${theme === "dark" ? "text-white" : "text-navy-950"}`}>Personalized Protection Goals</h3>
        <span className="text-[9.5px] bg-purple-950/40 text-purple-300 font-extrabold uppercase px-3 py-1 rounded-full border border-purple-800/40">
          Matrix Coverage Suggestions
        </span>
      </div>

      {/* Memory & Recommendations Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
        {/* Recommendation Card 1: Active Health Shield */}
        <div className={`rounded-3xl p-6 border flex flex-col justify-between group text-slate-350 shadow-2xl hover:border-purple-550/20 transition-all text-left ${
          theme === "dark" ? "bg-slate-900/40 border-white/5" : "bg-white border-slate-200"
        }`}>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="w-10 h-10 rounded-xl bg-rose-950/40 text-rose-450 border border-rose-800/30 flex items-center justify-center">
                <Heart className="w-5.5 h-5.5 fill-rose-500 stroke-[2]" />
              </div>
              <span className="bg-emerald-950/40 text-emerald-400 border border-emerald-800/40 font-bold py-1 px-3.5 rounded-full text-[9px] uppercase tracking-wider leading-none">
                ACTIVE 🔒
              </span>
            </div>
            <div>
              <h4 className={`font-black text-sm group-hover:text-purple-400 transition-colors leading-tight truncate ${theme === "dark" ? "text-white" : "text-navy-950"}`}>
                Aegis Supreme Health Shield
              </h4>
              <p className="text-[10px] text-slate-500 font-bold mt-1">Claim Desk Sync: 100% Verified</p>
              {/* Memory connection hook */}
              <p className="text-[10.5px] text-slate-450 mt-2 font-semibold leading-relaxed">
                Sarah AI locked premium rate limits secure until 2027.
              </p>
            </div>
          </div>

          <div className="pt-4 border-t border-white/5 mt-5 flex items-baseline justify-between">
            <div>
              <span className="text-[9px] font-bold text-slate-500 uppercase tracking-widest block">Coverage</span>
              <span className={`text-xs font-black mt-0.5 block ${theme === "dark" ? "text-white" : "text-navy-900"}`}>₹1 Crore Cover</span>
            </div>
            <div className="text-right">
              <span className="text-[9px] font-bold text-slate-500 uppercase tracking-widest block">Premium Rate</span>
              <span className="text-xs font-black text-purple-400 mt-0.5 block">₹850/mo</span>
            </div>
          </div>
        </div>

        {/* Recommendation Card 2: Suggested Auto Shield */}
        <div className={`rounded-3xl p-6 border flex flex-col justify-between group text-slate-350 shadow-2xl hover:border-cyan-550/20 transition-all text-left relative ${
          theme === "dark" ? "bg-slate-900/40 border-white/5" : "bg-white border-slate-200"
        }`}>
          {/* Animated Border Beam glow */}
          <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-purple-500 via-cyan-400 to-indigo-500 animate-pulse" />

          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="w-10 h-10 rounded-xl bg-cyan-950/40 text-cyan-400 border border-cyan-800/30 flex items-center justify-center">
                <Car className="w-5.5 h-5.5 stroke-[2]" />
              </div>
              <span className="bg-purple-950/40 text-purple-300 border border-purple-800/30 font-black py-1.5 px-3.5 rounded-full text-[9px] uppercase tracking-wider leading-none flex items-center gap-1 shadow-glow animate-pulse">
                <Sparkles className="w-2.5 h-2.5 text-cyan-400" />
                <span>AI RECOMMENDED</span>
              </span>
            </div>
            <div>
              <h4 className={`font-black text-sm group-hover:text-cyan-400 transition-colors leading-tight truncate ${theme === "dark" ? "text-white" : "text-navy-950"}`}>
                Aegis Smart Auto Shield
              </h4>
              <p className="text-[10px] text-slate-550 font-bold mt-1">Recommended: Zero depreciation</p>
              {/* Supportive non-salesy message */}
              <p className="text-[10.5px] text-slate-450 mt-2 font-semibold leading-relaxed">
                Protect your daily travel vectors. Locks in zero-depreciation coverage and 24/7 recovery.
              </p>
            </div>
          </div>

          <div className="pt-4 border-t border-white/5 mt-5 flex items-baseline justify-between">
            <div>
              <span className="text-[9px] font-bold text-slate-500 uppercase tracking-widest block">Sizing Guide</span>
              <span className={`text-xs font-black mt-0.5 block ${theme === "dark" ? "text-white" : "text-navy-900"}`}>₹25 Lakh Cover</span>
            </div>
            <div className="text-right">
              <span className="text-[9px] font-bold text-slate-500 uppercase tracking-widest block">Premium Est.</span>
              <span className="text-xs font-black text-cyan-450 mt-0.5 block">₹450/mo</span>
            </div>
          </div>
        </div>
      </div>

      {/* Interactive AI Memory status logs (human-like AI experience) */}
      <div className={`p-4 rounded-2xl border text-[11px] font-bold flex items-center justify-between gap-3 text-left ${
        theme === "dark" ? "bg-white/[0.01] border-white/5 text-slate-500" : "bg-slate-100/50 border-slate-200 text-slate-500"
      }`}>
        <div className="flex items-center gap-2">
          <Clock className="w-3.5 h-3.5 text-purple-500/60" />
          <span>
            Sarah AI memories synced: Last time you explored family protection plans on May 25, 2026.
          </span>
        </div>
        <span className="text-[8.5px] text-cyan-400/80 font-mono tracking-wider">BLOCK #0x4A7B</span>
      </div>
    </div>
  );
}
