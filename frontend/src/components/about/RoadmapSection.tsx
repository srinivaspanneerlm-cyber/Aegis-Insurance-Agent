"use client";

import { useState } from "react";
import { Activity, Flame } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

/**
 * Engineering roadmap: a clickable timeline on the left drives a detail panel
 * on the right.
 *
 * The list labels and the expanded detail copy differ intentionally (e.g.
 * "Conversational Automation" vs "Conversational Insurance Automation"), so
 * each milestone carries both. Previously these lived in separate index-aligned
 * arrays that had to be kept in lockstep by hand — consolidating them into one
 * array removes that fragile coupling while rendering identically.
 */
interface RoadmapMilestone {
  listTitle: string;
  listDesc: string;
  phase: string;
  detailTitle: string;
  detailDesc: string;
}

const MILESTONES: RoadmapMilestone[] = [
  {
    listTitle: "Voice AI Consultation",
    listDesc: "Full sovereign voice-signature underwriter streams.",
    phase: "Phase 1",
    detailTitle: "Voice AI Consultation",
    detailDesc: "Enabling seamless, encrypted real-time vocal consultation feeds inside Aegis Command. Actuarial engines perform complex biometric checks and voice signature lockdowns instantly.",
  },
  {
    listTitle: "Conversational Automation",
    listDesc: "Heuristic-guided dynamic document verifications.",
    phase: "Phase 2",
    detailTitle: "Conversational Insurance Automation",
    detailDesc: "Automating static policy verification templates into direct, multi-turn conversational intakes. Dynamic telemetry scanners compile user inputs and automatically clearance checklists.",
  },
  {
    listTitle: "AI Workflow Automation",
    listDesc: "Claim settlements triggered by AI execution nodes.",
    phase: "Phase 3",
    detailTitle: "AI Workflow Automation",
    detailDesc: "Deploying sovereign workflow agents capable of orchestrating instant cashless approvals, vehicle depreciation calculations, and emergency evacuations with zero manual delays.",
  },
  {
    listTitle: "Personalized Protection Systems",
    listDesc: "Real-time risk allocation dials matching life shifts.",
    phase: "Phase 4",
    detailTitle: "Personalized AI Protection Systems",
    detailDesc: "Developing persistent context engines that track household risk parameters and dynamically scale protection boundaries in real-time as users secure new properties or family layers.",
  },
  {
    listTitle: "Autonomous Recommendations",
    listDesc: "Sovereign machine-learning underwritten portfolios.",
    phase: "Phase 5",
    detailTitle: "Autonomous Insurance Recommendations",
    detailDesc: "Launching deep statistical machine-learning underwriters that perform mathematical risk evaluation and recommend custom protection packages autonomously.",
  },
  {
    listTitle: "End-to-End Processing",
    listDesc: "Claims, lockups, payouts, and billing cleared inside vault.",
    phase: "Phase 6",
    detailTitle: "End-to-End AI Insurance Processing",
    detailDesc: "Enabling the entire claim loop—from consultation intake to qualify lead conversion, cashless hospital bed settlement, and safe premium payment locks—all within the secure vault.",
  },
];

/** Interactive future roadmap section. */
export function RoadmapSection() {
  const [activeRoadmap, setActiveRoadmap] = useState(0);
  const active = MILESTONES[activeRoadmap];

  return (
    <section className="relative px-6 py-16 z-10">
      <div className="max-w-5xl mx-auto space-y-12 text-center">
        <div className="space-y-3">
          <span className="inline-flex items-center gap-1.5 text-cyan-400 bg-cyan-950/30 border border-cyan-800/40 py-1.5 px-4 rounded-full text-xs font-bold uppercase tracking-widest animate-pulse">
            <Activity className="w-3.5 h-3.5" />
            <span>Projected Milestones</span>
          </span>
          <h2 className="text-3xl font-black tracking-tight text-white leading-none">Engineering Roadmap</h2>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center text-left">
          {/* TIMELINE LIST (Cols 1-5) */}
          <div className="lg:col-span-5 flex flex-col gap-3">
            {MILESTONES.map((item, idx) => {
              const isActive = activeRoadmap === idx;
              return (
                <button
                  key={idx}
                  onClick={() => setActiveRoadmap(idx)}
                  className={`p-3.5 rounded-2xl flex items-center justify-between border text-left transition-all cursor-pointer ${
                    isActive
                      ? "bg-gradient-to-r from-cyan-950/40 to-slate-900 border-cyan-500/40 text-cyan-300"
                      : "bg-white/[0.01] border-white/5 text-slate-400 hover:bg-white/5"
                  }`}
                >
                  <div className="flex items-center gap-3.5">
                    <span className={`w-6 h-6 rounded-lg flex items-center justify-center text-[10px] font-black ${
                      isActive ? "bg-cyan-500 text-slate-950 shadow-glow" : "bg-white/5 border border-white/10 text-slate-400"
                    }`}>
                      {idx + 1}
                    </span>
                    <div>
                      <h4 className="text-xs font-black text-white">{item.listTitle}</h4>
                      <span className="text-[8.5px] font-bold uppercase tracking-wider text-slate-500">{item.phase}</span>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>

          {/* TIMELINE BRIEF VISUAL (Cols 6-12) */}
          <div className="lg:col-span-7">
            <AnimatePresence mode="wait">
              <motion.div
                key={activeRoadmap}
                initial={{ opacity: 0, x: 10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -10 }}
                transition={{ duration: 0.25 }}
                className="p-8 rounded-[32px] border border-cyan-500/20 bg-slate-900/40 text-white shadow-[0_0_30px_rgba(6,182,212,0.06)] relative overflow-hidden"
              >
                <div className="absolute top-0 right-0 w-32 h-32 rounded-full bg-cyan-500/5 blur-2xl" />

                <div className="space-y-6 relative z-10 text-left">
                  <div className="flex items-center justify-between border-b border-white/5 pb-4">
                    <span className="text-[9.5px] font-black uppercase tracking-widest text-cyan-400 bg-cyan-950/40 py-1.5 px-3.5 rounded-full border border-cyan-500/20">
                      Roadmap Stage 0{activeRoadmap + 1}
                    </span>
                    <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">
                      Lock Target: Q{activeRoadmap + 1} 2027
                    </span>
                  </div>

                  <div className="space-y-2">
                    <h3 className="text-2xl font-black text-white">{active.detailTitle}</h3>
                    <p className="text-slate-300 text-xs sm:text-sm leading-relaxed font-semibold">{active.detailDesc}</p>
                  </div>

                  <div className="pt-6 border-t border-white/5 flex items-center justify-between text-[10px] text-slate-500 font-bold uppercase tracking-wider">
                    <span className="flex items-center gap-1">
                      <Flame className="w-3.5 h-3.5 text-cyan-400 animate-pulse" />
                      <span>Calibrating Pipeline Nodes</span>
                    </span>
                    <span className="text-cyan-400">IN DEVELOPMENT</span>
                  </div>
                </div>
              </motion.div>
            </AnimatePresence>
          </div>
        </div>
      </div>
    </section>
  );
}
