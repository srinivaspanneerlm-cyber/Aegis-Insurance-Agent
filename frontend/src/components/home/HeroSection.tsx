"use client";

import Link from "next/link";
import { Shield, ArrowRight, Sparkles, ShieldCheck, User, Activity } from "lucide-react";
import { motion } from "framer-motion";

/** Trust-deck badges shown beneath the hero headline. */
const TRUST_BADGES = [
  { title: "AI-Powered Consultation", icon: <Sparkles className="text-cyan-400" /> },
  { title: "100% Secure & Trusted", icon: <ShieldCheck className="text-emerald-400" /> },
  { title: "Personalized for You", icon: <User className="text-royal-400" /> },
  { title: "24/7 AI Support", icon: <Activity className="text-rose-400" /> },
];

/** Emoji badges that orbit the holographic shield. */
const ORBITING_BADGES = [
  { icon: "🚗", delay: 0, x: -130, y: -70 },
  { icon: "❤️", delay: 1, x: 130, y: -70 },
  { icon: "👪", delay: 2, x: -130, y: 70 },
  { icon: "🔒", delay: 3, x: 130, y: 70 },
];

/** Landing hero: headline + trust deck on the left, holographic shield on the right. */
export function HeroSection({ onOpenLogin }: { onOpenLogin: () => void }) {
  return (
    <section className="relative pt-36 pb-12 flex-grow flex items-center justify-center z-10">
      <div className="max-w-7xl w-full mx-auto px-6 grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">

        {/* LEFT SIDE HERO TEXT */}
        <div className="lg:col-span-6 text-left space-y-6">
          <h1 className="text-4xl sm:text-6xl font-black tracking-tight leading-[1.08]">
            The Future of <br/>
            <span className="bg-gradient-to-r from-purple-500 via-indigo-400 to-cyan-400 bg-clip-text text-transparent">
              AI-Powered
            </span> <br/>
            Insurance Consultation
          </h1>

          <p className="text-slate-400 text-sm font-semibold max-w-lg leading-relaxed">
            Smart. Secure. Personalized. Experience the next generation of insurance guidance with Aegis AI. We audit policy coverage matrices instantly with zero agent cold calls.
          </p>

          <div className="flex items-center gap-3.5 pt-2">
            <button
              onClick={onOpenLogin}
              className={`py-3.5 px-7 rounded-2xl font-black text-xs uppercase tracking-widest shadow-lg flex items-center justify-center gap-2 border transition-all cursor-pointer bg-navy-900 hover:bg-navy-950 text-white border-navy-900 dark:bg-white dark:hover:bg-slate-100 dark:text-slate-950 dark:border-white/10`}
            >
              <span>Access Security Portal</span>
              <ArrowRight className="w-4 h-4" />
            </button>

            <Link
              href="/advisor"
              className={`py-3.5 px-6 rounded-2xl font-bold text-xs uppercase tracking-wider border transition-all bg-white hover:bg-slate-100 text-slate-700 border-slate-200 dark:bg-white/5 dark:hover:bg-white/10 dark:text-white dark:border-white/10`}
            >
              Consult Aegis AI
            </Link>
          </div>

          {/* Trust Deck items below title */}
          <div className="grid grid-cols-2 gap-4 pt-6 max-w-xl">
            {TRUST_BADGES.map((badge, idx) => (
              <div
                key={idx}
                className={`p-3.5 rounded-2xl border flex items-center gap-3 transition-all bg-white border-slate-200 shadow-sm hover:shadow-md dark:bg-white/[0.01] dark:border-white/5 dark:hover:bg-white/[0.03] dark:shadow-none dark:hover:shadow-none`}
              >
                <div className={`w-8 h-8 rounded-xl flex items-center justify-center bg-royal-50 border border-royal-100 shadow-inner dark:bg-white/5 dark:border dark:border-white/10 dark:shadow-none`}>
                  {badge.icon}
                </div>
                <span className={`text-[10px] font-black uppercase tracking-wider text-slate-700 dark:text-slate-300`}>
                  {badge.title}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* RIGHT SIDE HERO HOLOGRAPHIC SHIELD VISUAL */}
        <div className="lg:col-span-6 flex justify-center items-center relative">
          <div className="relative w-full max-w-lg aspect-square flex items-center justify-center">

            {/* Spinning dashboard outer rings */}
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ repeat: Infinity, duration: 35, ease: "linear" }}
              className={`absolute w-[80%] h-[80%] rounded-full border border-dashed opacity-20 border-royal-500 dark:border-cyan-400`}
            />
            <motion.div
              animate={{ rotate: -360 }}
              transition={{ repeat: Infinity, duration: 25, ease: "linear" }}
              className={`absolute w-[60%] h-[60%] rounded-full border border-double opacity-25 border-indigo-400 dark:border-purple-400 dark:animate-pulse`}
            />

            {/* Glowing Background Light Shaft */}
            <div className="absolute bottom-1/4 left-1/2 -translate-x-1/2 w-48 h-80 bg-gradient-to-t from-cyan-500/10 via-purple-500/5 to-transparent blur-2xl rounded-t-full pointer-events-none" />

            {/* Holographic glowing Shield center */}
            <motion.div
              animate={{ y: [0, -12, 0] }}
              transition={{ repeat: Infinity, duration: 5, ease: "easeInOut" }}
              className={`relative w-44 h-44 rounded-[40px] flex flex-col items-center justify-center border-2 transition-all bg-white border-royal-400 text-royal-650 shadow-[0_15px_35px_rgba(59,130,246,0.15)] dark:bg-slate-900/60 dark:border-cyan-400/40 dark:text-cyan-300 dark:shadow-[0_0_50px_rgba(6,182,212,0.4)]`}
            >
              <Shield className="w-20 h-20 stroke-[1.8]" />
              <span className="absolute text-2xl font-black text-white font-sans mt-[-4px]">A</span>

              {/* Simulated Family Silhouette sitting inside the shield beam */}
              <div className="absolute bottom-4 flex items-end gap-1 opacity-80 pointer-events-none">
                {/* Father figure */}
                <div className="w-1.5 h-6 bg-cyan-300 rounded-full" />
                {/* Daughter figure */}
                <div className="w-1 h-3 bg-cyan-200 rounded-full" />
                {/* Mother figure */}
                <div className="w-1.5 h-5.5 bg-cyan-300 rounded-full" />
                {/* Son figure */}
                <div className="w-1 h-3.5 bg-cyan-200 rounded-full" />
              </div>
            </motion.div>

            {/* Floating orbiting badges around the shield */}
            {ORBITING_BADGES.map((badge, idx) => (
              <motion.div
                key={idx}
                animate={{ y: [badge.y, badge.y - 8, badge.y] }}
                transition={{ repeat: Infinity, duration: 4, delay: badge.delay, ease: "easeInOut" }}
                style={{ left: `calc(50% + ${badge.x}px - 22px)`, top: `calc(50% + ${badge.y}px - 22px)` }}
                className={`absolute w-11 h-11 rounded-xl flex items-center justify-center text-lg border transition-all bg-white border-slate-200 text-slate-800 shadow-md dark:bg-slate-900 dark:border-white/10 dark:text-white dark:shadow-[0_0_15px_rgba(255,255,255,0.05)]`}
              >
                {badge.icon}
              </motion.div>
            ))}

          </div>
        </div>

      </div>
    </section>
  );
}
