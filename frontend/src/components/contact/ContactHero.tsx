"use client";

import Link from "next/link";
import { Sparkles, MessageSquare, Clock } from "lucide-react";
import { motion } from "framer-motion";

/** Contact page hero: Sri AI intro copy with the holographic advisor card. */
export function ContactHero({ onOpenChat }: { onOpenChat: () => void }) {
  return (
    <section className="relative pt-36 pb-12 flex-grow flex items-center justify-center z-10">
      <div className="max-w-7xl w-full mx-auto px-6 grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">

        {/* LEFT SIDE HERO TEXT */}
        <div className="lg:col-span-6 text-left space-y-6">
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 text-purple-400 bg-purple-950/30 border border-purple-800/40 py-1.5 px-4 rounded-full text-xs font-bold uppercase tracking-widest leading-none">
              <Sparkles className="w-3.5 h-3.5 stroke-[2.2]" />
              <span>Executive Command Console</span>
            </span>
            <span className="inline-flex items-center gap-1.5 text-emerald-400 bg-emerald-950/30 border border-emerald-800/40 py-1.5 px-3 rounded-full text-[10px] font-black uppercase tracking-wider leading-none">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              <span>Active cover</span>
            </span>
          </div>

          <h1 className="text-4xl sm:text-6xl font-black tracking-tight leading-[1.08]">
            Sri AI <br/>
            <span className="bg-gradient-to-r from-purple-500 via-indigo-400 to-cyan-400 bg-clip-text text-transparent">
              Chief Executive
            </span> <br/>
            AI Advisor
          </h1>

          <p className="text-slate-400 text-sm font-semibold max-w-lg leading-relaxed">
            Executive AI intelligence designed to provide intelligent support, consultation guidance, and AI-powered assistance across the Aegis AI ecosystem.
          </p>

          <div className="flex items-center gap-4 pt-2">
            <button
              type="button"
              onClick={onOpenChat}
              className={`py-3.5 px-7 rounded-2xl font-black text-xs uppercase tracking-widest shadow-lg flex items-center justify-center gap-2 border transition-all cursor-pointer bg-navy-900 hover:bg-navy-950 text-white border-navy-900 dark:bg-white dark:hover:bg-slate-100 dark:text-slate-950 dark:border-white/10`}
            >
              <MessageSquare className="w-4 h-4" />
              <span>Talk With Sri AI</span>
            </button>

            <Link
              href="/policies"
              className={`py-3.5 px-6 rounded-2xl font-bold text-xs uppercase tracking-wider border transition-all bg-white hover:bg-slate-100 text-slate-700 border-slate-200 dark:bg-white/5 dark:hover:bg-white/10 dark:text-white dark:border-white/10`}
            >
              Policies Gateway
            </Link>
          </div>
        </div>

        {/* RIGHT SIDE HOLOGRAPHIC EXECUTIVE VISUAL */}
        <div className="lg:col-span-6 flex justify-center items-center relative">
          <div className="relative w-full max-w-md aspect-square flex items-center justify-center">

            {/* Rotating dashboard lines */}
            <motion.div
              animate={{ rotate: -360 }}
              transition={{ repeat: Infinity, duration: 35, ease: "linear" }}
              className={`absolute w-[90%] h-[90%] rounded-full border border-dashed opacity-10 border-indigo-400 dark:border-purple-400`}
            />
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ repeat: Infinity, duration: 25, ease: "linear" }}
              className={`absolute w-[70%] h-[70%] rounded-full border border-double opacity-20 border-purple-400 dark:border-cyan-400`}
            />

            {/* Glowing Background Light Shaft */}
            <div className="absolute w-56 h-56 bg-gradient-to-tr from-purple-500/10 via-cyan-500/10 to-transparent blur-3xl rounded-full" />

            {/* Holographic Glowing AI Leadership Profile Card */}
            <motion.div
              animate={{ y: [0, -12, 0] }}
              transition={{ repeat: Infinity, duration: 5, ease: "easeInOut" }}
              className={`relative w-64 p-6 rounded-[32px] border-2 flex flex-col items-center justify-center transition-all bg-white border-purple-300 text-purple-700 shadow-[0_15px_30px_rgba(168,85,247,0.1)] dark:bg-slate-900/80 dark:border-purple-500/40 dark:text-purple-300 dark:shadow-[0_0_40px_rgba(168,85,247,0.25)]`}
            >
              {/* Hologram Avatar Orb */}
              <div className="w-20 h-20 rounded-full border-2 border-dashed border-purple-400 p-1 flex items-center justify-center relative mb-4">
                <div className="absolute inset-0 rounded-full bg-purple-500/10 animate-pulse" />
                <div className="w-16 h-16 rounded-full bg-gradient-to-tr from-purple-650 to-cyan-500 flex items-center justify-center font-black text-xl text-white shadow-lg relative z-10">
                  SAI
                </div>
                {/* Glowing core indicator */}
                <span className="absolute bottom-1 right-1 w-3.5 h-3.5 bg-emerald-500 rounded-full border-2 border-slate-900 shadow-glow animate-pulse z-20" />
              </div>

              <div className="text-center space-y-2">
                <div className="flex items-center justify-center gap-1">
                  <h3 className="text-base font-black text-white leading-none">Sri AI</h3>
                  <Sparkles className="w-3.5 h-3.5 text-purple-400" />
                </div>
                <span className="text-[9px] text-purple-400 font-extrabold uppercase tracking-widest block leading-none">
                  Chief Executive AI Advisor
                </span>

                <div className="pt-3 border-t border-white/5 flex items-center justify-center gap-1.5 text-[9px] text-slate-500 font-bold uppercase tracking-wider">
                  <Clock className="w-3.5 h-3.5 text-purple-400" />
                  <span>🟢 ONLINE & ACTIVE</span>
                </div>
              </div>
            </motion.div>

            {/* Floating ambient telemetry particles */}
            <div className="absolute top-1/4 left-1/4 w-2 h-2 rounded-full bg-purple-400 animate-ping" />
            <div className="absolute bottom-1/4 right-1/4 w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />
          </div>
        </div>

      </div>
    </section>
  );
}
