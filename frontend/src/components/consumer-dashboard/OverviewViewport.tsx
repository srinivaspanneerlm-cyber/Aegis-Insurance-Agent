"use client";

import { RefObject } from "react";
import {
  Sparkles, Clock, MessageSquare, ArrowRight, Heart, Car, ChevronRight,
  ShieldCheck, Globe, Layers,
} from "lucide-react";
import { motion } from "framer-motion";
import { useTheme } from "@/context/ThemeContext";
import type { NavId, DashboardMessage } from "./types";

const containerVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.1 } },
} as const;

const cardVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { type: "spring" as const, stiffness: 70, damping: 15 },
  },
} as const;

/** Instant-action desks; each routes into the AI advisor. */
const QUICK_ACTIONS = [
  { title: "Protect Vehicle", icon: <Car className="w-5 h-5" />, symbol: "🚗", color: "hover:border-cyan-550/20 hover:shadow-cyan-950/10" },
  { title: "Protect Family", icon: <Heart className="w-5 h-5" />, symbol: "❤️", color: "hover:border-rose-550/20 hover:shadow-rose-950/10" },
  { title: "Travel Nomad", icon: <Globe className="w-5 h-5" />, symbol: "✈", color: "hover:border-purple-550/20 hover:shadow-purple-950/10" },
  { title: "Secure Property", icon: <Layers className="w-5 h-5" />, symbol: "🏠", color: "hover:border-amber-550/20 hover:shadow-amber-950/10" },
];

interface OverviewViewportProps {
  clientName: string;
  clientArchetype: string;
  archetypeExplanation: string;
  chatMessages: DashboardMessage[];
  isTyping: boolean;
  chatInput: string;
  setChatInput: (value: string) => void;
  handleSendMessage: (e: React.FormEvent) => void;
  chatEndRef: RefObject<HTMLDivElement>;
  setActiveNav: (nav: NavId) => void;
}

/** Primary overview console (nav: "dashboard"). */
export function OverviewViewport({
  clientName, clientArchetype, archetypeExplanation,
  chatMessages, isTyping, chatInput, setChatInput, handleSendMessage, chatEndRef,
  setActiveNav,
}: OverviewViewportProps) {
  const { theme } = useTheme();

  return (
    <motion.div
      key="dashboard"
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      exit="hidden"
      className="space-y-8"
    >
      {/* 1. Personalized Hero Section with Futuristic Glow & Animation */}
      <motion.div
        variants={cardVariants}
        className={`rounded-[32px] p-6 sm:p-10 border relative overflow-hidden text-left group shadow-2xl transition-all duration-300 ${
          theme === "dark"
            ? "bg-gradient-to-r from-purple-950/40 via-slate-900/40 to-indigo-950/40 border-white/5 shadow-purple-950/10"
            : "bg-gradient-to-r from-purple-50 via-white to-cyan-50 border-slate-200/80 shadow-premium"
        }`}
      >
        {/* Holographic background element animations */}
        <div className="absolute top-[-50%] right-[-10%] w-80 h-80 rounded-full bg-purple-550/10 blur-3xl pointer-events-none group-hover:scale-110 transition-transform duration-700" />
        <div className="absolute bottom-[-50%] left-[-10%] w-80 h-80 rounded-full bg-cyan-400/5 blur-3xl pointer-events-none" />

        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-8 relative z-10">
          <div className="space-y-4 max-w-xl">
            {/* Greeting tags */}
            <span className="inline-flex items-center gap-1.5 text-[9px] font-black uppercase tracking-widest text-cyan-400 bg-cyan-950/40 py-1.5 px-4 rounded-full border border-cyan-800/30">
              <Sparkles className="w-3.5 h-3.5 text-cyan-400 animate-pulse" />
              <span>AI Co-Pilot Protection Online</span>
            </span>

            <h2 className={`text-2.5xl sm:text-4.5xl font-black tracking-tight leading-none ${theme === "dark" ? "text-white" : "text-navy-950"}`}>
              Welcome Back, {clientName} 👋
            </h2>

            <p className={`text-xs sm:text-[13.5px] leading-relaxed font-semibold ${theme === "dark" ? "text-slate-350" : "text-slate-600"}`}>
              Your personalized protection insights and AI recommendations are ready. Aegis risk models have validated your coverage limits across health & assets.
            </p>
          </div>

          {/* Quick Telemetry Summary */}
          <div className={`flex items-center gap-4 border rounded-2xl p-4.5 self-start lg:self-center shadow-lg backdrop-blur-md transition-all duration-300 ${
            theme === "dark" ? "bg-white/[0.02] border-white/10" : "bg-white/80 border-slate-200"
          }`}>
            <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-ping shadow-glow" />
            <div className="text-left space-y-1">
              <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest leading-none">Security Node</p>
              <p className={`text-xs font-black mt-1 leading-none ${theme === "dark" ? "text-white" : "text-navy-900"}`}>ECDSA Sync Secured</p>
              <p className="text-[9.5px] text-cyan-400 font-extrabold uppercase tracking-widest">Vault Active</p>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Sub sections splits */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

        {/* Left Column (lg:col-span-2): Chat, Memory, and Recommendations */}
        <div className="lg:col-span-2 space-y-8">

          {/* 2. Sarah AI Advisor & Recommendation Summary Block */}
          <motion.div
            variants={cardVariants}
            className={`rounded-[32px] border p-6 sm:p-8 space-y-6 text-left relative overflow-hidden flex flex-col justify-between min-h-[460px] ${
              theme === "dark" ? "bg-slate-900/40 border-white/5 shadow-2xl" : "bg-white border-slate-200 shadow-premium"
            }`}
          >
            <div className="flex items-center justify-between border-b border-white/5 pb-4 flex-shrink-0">
              <div className="flex items-center gap-3.5">
                {/* Pulsing Sarah Avatar */}
                <div className="relative">
                  <div className="w-11 h-11 rounded-xl bg-gradient-to-tr from-purple-650 to-indigo-650 text-white flex items-center justify-center shadow-md">
                    <Sparkles className="w-6 h-6 fill-white animate-pulse" />
                  </div>
                  <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-emerald-500 border-2 border-slate-900 rounded-full" />
                </div>
                <div>
                  <h3 className={`text-sm font-black leading-none ${theme === "dark" ? "text-white" : "text-navy-950"}`}>Sarah AI Advisor</h3>
                  {/* Glowing recommendation badge */}
                  <span className="inline-flex items-center gap-1 text-[8.5px] text-purple-400 font-extrabold uppercase tracking-widest mt-1.5 leading-none">
                    <span className="w-1.5 h-1.5 bg-purple-500 rounded-full animate-ping" />
                    <span>AI Optimized Underwriting</span>
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-1.5 text-[9px] text-slate-400 bg-white/5 border border-white/10 py-1.5 px-3 rounded-full font-bold">
                <Clock className="w-3.5 h-3.5 text-purple-400" />
                <span>Audit Active</span>
              </div>
            </div>

            {/* AI Advisor Speech Block (Memory and Recommendations) */}
            <div className={`p-4.5 rounded-2xl border text-[12px] leading-relaxed font-semibold text-left ${
              theme === "dark" ? "bg-purple-950/15 border-purple-500/20 text-slate-300" : "bg-purple-50/50 border-purple-100 text-slate-700"
            }`}>
              <p className="flex items-start gap-2">
                <span className="text-purple-400 text-sm mt-0.5">✦</span>
                <span>
                  <strong>Sarah AI prepared:</strong> Based on your profile and family priorities, I have audited your active coverages. Your Supreme Health Shield is fully locked, but we detected a key coverage gap in your vehicle assets.
                </span>
              </p>
            </div>

            {/* Chat messages */}
            <div className="flex-grow my-2 overflow-y-auto space-y-4 max-h-[200px] pr-2 text-left">
              {chatMessages.map((msg) => {
                const isAI = msg.sender === "ai";
                return (
                  <div
                    key={msg.id}
                    className={`flex gap-3 max-w-[85%] ${isAI ? "mr-auto text-left" : "ml-auto flex-row-reverse text-right"}`}
                  >
                    <div className={`w-8 h-8 rounded-lg flex-shrink-0 flex items-center justify-center font-bold text-xs ${
                      isAI ? "bg-purple-650/20 text-purple-300 border border-purple-500/20" : "bg-purple-650 text-white"
                    }`}>
                      {isAI ? "S" : "U"}
                    </div>
                    <div className={`p-4 rounded-2xl text-[12px] leading-relaxed font-semibold ${
                      isAI
                        ? (theme === "dark" ? "bg-white/[0.02] border border-white/5 text-slate-300" : "bg-slate-50 border border-slate-150 text-slate-700")
                        : "bg-purple-650 text-white shadow-sm"
                    }`}>
                      {msg.text}
                    </div>
                  </div>
                );
              })}

              {isTyping && (
                <div className="flex gap-3 max-w-[80%] mr-auto">
                  <div className="w-8 h-8 rounded-lg bg-purple-650/20 text-purple-300 border border-purple-500/20 flex items-center justify-center font-bold text-xs">
                    S
                  </div>
                  <div className={`p-4 rounded-2xl flex items-center gap-1.5 shadow-sm border ${
                    theme === "dark" ? "bg-white/[0.02] border-white/5" : "bg-slate-50 border-slate-150"
                  }`}>
                    <span className="w-1.5 h-1.5 bg-purple-400 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                    <span className="w-1.5 h-1.5 bg-purple-400 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                    <span className="w-1.5 h-1.5 bg-purple-400 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
                  </div>
                </div>
              )}
              <div ref={chatEndRef} />
            </div>

            {/* Chat input controls */}
            <form onSubmit={handleSendMessage} className={`flex gap-2 border rounded-2xl p-2.5 flex-shrink-0 transition-colors duration-300 ${
              theme === "dark" ? "bg-white/[0.02] border-white/10" : "bg-slate-100 border-slate-200"
            }`}>
              <input
                type="text"
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                placeholder="Ask Sarah about coverage limits, vehicle riders, or claims matching..."
                className={`flex-1 bg-transparent px-3 outline-none text-[12px] font-semibold ${
                  theme === "dark" ? "text-white placeholder-slate-500" : "text-navy-950 placeholder-slate-400"
                }`}
              />
              <button
                type="submit"
                className="bg-purple-650 hover:bg-purple-600 text-white py-2 px-4.5 rounded-xl font-bold text-xs flex items-center gap-1.5 transition-all cursor-pointer border border-purple-500/20 shadow-glow"
              >
                <span>Ask</span>
                <ChevronRight className="w-4 h-4" />
              </button>
            </form>
          </motion.div>

          {/* 3. Continue Conversation Section with Advisor details & History memory */}
          <motion.div
            variants={cardVariants}
            className={`rounded-[24px] border p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition-all duration-300 ${
              theme === "dark" ? "bg-slate-900/30 border-white/5 hover:border-purple-550/20" : "bg-white border-slate-200 shadow-premium"
            }`}
          >
            <div className="flex items-center gap-3.5 text-left">
              <div className="w-9 h-9 rounded-xl bg-purple-950/40 text-purple-400 flex items-center justify-center border border-purple-800/30 flex-shrink-0">
                <MessageSquare className="w-5 h-5 text-purple-400" />
              </div>
              <div>
                <p className={`text-xs font-black ${theme === "dark" ? "text-white" : "text-navy-950"}`}>Continue Your AI Consultation</p>
                <p className="text-[11.5px] text-slate-500 font-semibold mt-0.5">Resume your family health protection session with Sarah AI.</p>
              </div>
            </div>

            <button
              onClick={() => setActiveNav("advisor")}
              className="bg-purple-650 hover:bg-purple-600 text-white font-bold py-2.5 px-4.5 rounded-xl text-[10.5px] uppercase tracking-wider flex items-center justify-center gap-1.5 transition-all cursor-pointer border border-purple-500/20 self-start sm:self-center shadow-glow"
            >
              <span>Resume Dialogue</span>
              <ArrowRight className="w-4 h-4 animate-pulse" />
            </button>
          </motion.div>

          {/* 4. Personalized Recommendations System */}
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

        </div>

        {/* Right Column (lg:col-span-1): Score, Profile archetype, and Quick Actions */}
        <div className="space-y-8 text-left">

          {/* 5. Holographic Protection Score Circle Widget */}
          <motion.div
            variants={cardVariants}
            className={`rounded-[32px] border p-6 sm:p-7 shadow-2xl space-y-6 relative overflow-hidden transition-all duration-300 ${
              theme === "dark" ? "bg-slate-900/40 border-white/5 shadow-purple-950/5" : "bg-white border-slate-200 shadow-premium"
            }`}
          >
            <div className="absolute top-[-30%] left-[-20%] w-40 h-40 rounded-full bg-cyan-500/5 blur-2xl pointer-events-none" />

            <div className="border-b border-white/5 pb-3">
              <h4 className={`font-black text-xs sm:text-sm uppercase tracking-wider flex items-center gap-1.5 ${theme === "dark" ? "text-white" : "text-navy-950"}`}>
                <ShieldCheck className="w-4.5 h-4.5 text-purple-400" />
                <span>Protection Core Score</span>
              </h4>
            </div>

            <div className="flex flex-col items-center justify-center py-4 space-y-5">
              {/* Circular Progress Ring with glow */}
              <div className="relative w-36 h-36 flex items-center justify-center">
                {/* Inner tech ring details */}
                <div className="absolute inset-2.5 rounded-full border border-dashed border-white/10 animate-spin" style={{ animationDuration: "35s" }} />
                <div className="absolute inset-5 rounded-full border border-white/5" />

                <svg className="w-full h-full transform -rotate-90">
                  <circle cx="72" cy="72" r="58" fill="transparent" stroke={theme === "dark" ? "rgba(255,255,255,0.04)" : "rgba(15,23,42,0.04)"} strokeWidth="7" />
                  <motion.circle
                    cx="72"
                    cy="72"
                    r="58"
                    fill="transparent"
                    stroke="url(#purpleCyanGrad)"
                    strokeWidth="7"
                    strokeDasharray="364"
                    initial={{ strokeDashoffset: 364 }}
                    animate={{ strokeDashoffset: 65 }} // 82% filled
                    transition={{ duration: 1.8, ease: "easeOut", delay: 0.3 }}
                    strokeLinecap="round"
                  />
                  <defs>
                    <linearGradient id="purpleCyanGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                      <stop offset="0%" stopColor="#a855f7" />
                      <stop offset="100%" stopColor="#06b6d4" />
                    </linearGradient>
                  </defs>
                </svg>
                <div className="absolute flex flex-col items-center justify-center text-center">
                  <span className={`text-3xl font-black tracking-tighter ${theme === "dark" ? "text-white" : "text-navy-950"}`}>82%</span>
                  <span className="text-[8.5px] font-black text-cyan-400 uppercase tracking-widest mt-0.5">PROTECTED</span>
                </div>
              </div>

              <div className="text-center space-y-1 w-full px-2">
                <p className={`text-[11.5px] font-bold ${theme === "dark" ? "text-slate-350" : "text-slate-600"}`}>
                  Your family health cover matches. Add Smart Auto Shield to complete 360° security.
                </p>
                <div className="flex justify-center gap-3 pt-3">
                  <span className="inline-flex items-center gap-1 text-[8.5px] text-emerald-450 bg-emerald-950/40 border border-emerald-800/40 py-1 px-3 rounded-full font-black uppercase">
                    Health: Safe
                  </span>
                  <span className="inline-flex items-center gap-1 text-[8.5px] text-amber-500 bg-amber-950/40 border border-amber-800/40 py-1 px-3 rounded-full font-black uppercase">
                    Auto: Gap
                  </span>
                </div>
              </div>
            </div>
          </motion.div>

          {/* 6. Dynamic User Profile Insight Card (Archetype Card) */}
          <motion.div
            variants={cardVariants}
            className={`rounded-[32px] border p-6 sm:p-7 shadow-2xl space-y-5 relative overflow-hidden transition-all duration-300 ${
              theme === "dark" ? "bg-slate-900/40 border-white/5" : "bg-white border-slate-200 shadow-premium"
            }`}
          >
            {/* Top neon edge */}
            <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-purple-650 via-cyan-400 to-indigo-650" />

            <div className="border-b border-white/5 pb-3">
              <span className="text-[8px] font-black text-purple-400 uppercase tracking-widest block mb-0.5">AI Profile Insights</span>
              <h4 className={`text-xs sm:text-sm font-black uppercase tracking-wider ${theme === "dark" ? "text-white" : "text-navy-950"}`}>
                Sovereign Risk Archetype
              </h4>
            </div>

            <div className="space-y-4">
              {/* Dynamic Archetype Title */}
              <div className={`p-4 rounded-2xl border text-left space-y-2 relative overflow-hidden ${
                theme === "dark" ? "bg-white/[0.01] border-white/5" : "bg-slate-50 border-slate-150 shadow-inner"
              }`}>
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-purple-550 animate-pulse shadow-glow" />
                  <p className={`text-[12.5px] font-black leading-none ${theme === "dark" ? "text-cyan-300" : "text-purple-650"}`}>
                    &quot;{clientArchetype}&quot;
                  </p>
                </div>
                <p className={`text-[11.5px] leading-relaxed font-semibold ${theme === "dark" ? "text-slate-400" : "text-slate-600"}`}>
                  {archetypeExplanation}
                </p>
              </div>

              {/* Visual Telemetry Bars */}
              <div className="space-y-3.5">
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-[9px] font-black text-slate-500 uppercase tracking-wider">
                    <span>Family Protection Priority</span>
                    <span className="text-purple-450">95%</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-white/5 overflow-hidden">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: "95%" }}
                      transition={{ duration: 1.5, ease: "easeOut" }}
                      className="h-full bg-purple-550 rounded-full"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-[9px] font-black text-slate-500 uppercase tracking-wider">
                    <span>Risk Minimization Index</span>
                    <span className="text-cyan-400">80%</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-white/5 overflow-hidden">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: "80%" }}
                      transition={{ duration: 1.5, ease: "easeOut", delay: 0.2 }}
                      className="h-full bg-cyan-450 rounded-full"
                    />
                  </div>
                </div>
              </div>
            </div>
          </motion.div>

          {/* 7. Premium Quick-Action Cards Section */}
          <div className="space-y-4 text-left">
            <h4 className={`font-black text-xs sm:text-sm uppercase tracking-widest ${theme === "dark" ? "text-slate-400" : "text-navy-950"}`}>
              Instant Protection Desks
            </h4>

            <div className="grid grid-cols-2 gap-4">
              {QUICK_ACTIONS.map((act, i) => (
                <motion.button
                  whileHover={{ y: -4, scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  key={i}
                  onClick={() => setActiveNav("advisor")}
                  className={`p-4 border rounded-[22px] flex flex-col items-center justify-center text-center gap-3 transition-all duration-300 relative group cursor-pointer shadow-md ${
                    theme === "dark"
                      ? `bg-slate-900/40 border-white/5 ${act.color}`
                      : `bg-white border-slate-200/80 hover:border-slate-350`
                  }`}
                >
                  <div className="w-10 h-10 rounded-xl bg-purple-950/40 text-purple-400 border border-purple-800/30 flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
                    {act.icon}
                  </div>
                  <span className={`text-[10px] font-black uppercase tracking-widest leading-none ${theme === "dark" ? "text-slate-300" : "text-navy-950"}`}>
                    {act.title}
                  </span>
                </motion.button>
              ))}
            </div>
          </div>

        </div>

      </div>
    </motion.div>
  );
}
