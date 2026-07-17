"use client";

import Link from "next/link";
import {
  Sparkles, Heart, Car, Plane, Home as HomeIcon,
  ArrowRight, Shield,
} from "lucide-react";
import { motion } from "framer-motion";
import { useTheme } from "@/context/ThemeContext";

/** Icons that orbit the holographic AI shield in the hero visual. */
const ORBITING_BADGES = [
  { icon: <Car className="w-4 h-4" />, delay: 0, x: -120, y: -70, color: "text-cyan-400" },
  { icon: <Heart className="w-4 h-4" />, delay: 1, x: 120, y: -70, color: "text-purple-400" },
  { icon: <Plane className="w-4 h-4" />, delay: 2, x: -120, y: 70, color: "text-rose-400" },
  { icon: <HomeIcon className="w-4 h-4" />, delay: 3, x: 120, y: 70, color: "text-emerald-400" },
];

/** About page hero: headline copy on the left, animated AI orb on the right. */
export function AboutHero() {
  const { theme } = useTheme();

  return (
    <section className="relative pt-36 pb-20 flex-grow flex items-center justify-center z-10">
      <div className="max-w-7xl w-full mx-auto px-6 grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">

        {/* LEFT SIDE HERO TEXT */}
        <div className="lg:col-span-6 text-left space-y-6">
          <span className="inline-flex items-center gap-1.5 text-cyan-400 bg-cyan-950/30 border border-cyan-800/40 py-1.5 px-4 rounded-full text-xs font-bold uppercase tracking-widest">
            <Sparkles className="w-3.5 h-3.5 stroke-[2.2]" />
            <span>Aegis Operations Command</span>
          </span>

          <h1 className="text-4xl sm:text-6xl font-black tracking-tight leading-[1.08]">
            Revolutionizing <br/>
            <span className="bg-gradient-to-r from-purple-500 via-indigo-400 to-cyan-400 bg-clip-text text-transparent">
              Insurance Through
            </span> <br/>
            Artificial Intelligence
          </h1>

          <p className="text-slate-400 text-sm font-semibold max-w-lg leading-relaxed">
            Aegis AI combines intelligent AI conversations, automation, and personalized protection guidance to redefine the future of insurance consultation.
          </p>

          <div className="flex items-center gap-4 pt-2">
            <a
              href="#vision"
              className={`py-3.5 px-7 rounded-2xl font-black text-xs uppercase tracking-widest shadow-lg flex items-center justify-center gap-2 border transition-all cursor-pointer ${
                theme === "dark"
                  ? "bg-white hover:bg-slate-100 text-slate-950 border-white/10"
                  : "bg-navy-900 hover:bg-navy-950 text-white border-navy-900"
              }`}
            >
              <span>Explore Our Vision</span>
              <ArrowRight className="w-4 h-4" />
            </a>

            <Link
              href="/advisor"
              className={`py-3.5 px-6 rounded-2xl font-bold text-xs uppercase tracking-wider border transition-all ${
                theme === "dark" ? "bg-white/5 hover:bg-white/10 text-white border-white/10" : "bg-white hover:bg-slate-100 text-slate-700 border-slate-200"
              }`}
            >
              Launch Consult
            </Link>
          </div>
        </div>

        {/* RIGHT SIDE FUTURISTIC STARTUP VISUAL */}
        <div className="lg:col-span-6 flex justify-center items-center relative">
          <div className="relative w-full max-w-md aspect-square flex items-center justify-center">

            {/* Orb rings spinning */}
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ repeat: Infinity, duration: 40, ease: "linear" }}
              className={`absolute w-[85%] h-[85%] rounded-full border border-dashed opacity-10 ${
                theme === "dark" ? "border-cyan-400" : "border-royal-500"
              }`}
            />
            <motion.div
              animate={{ rotate: -360 }}
              transition={{ repeat: Infinity, duration: 30, ease: "linear" }}
              className={`absolute w-[65%] h-[65%] rounded-full border border-double opacity-20 ${
                theme === "dark" ? "border-purple-400" : "border-indigo-400"
              }`}
            />

            {/* Glowing Background Light Shaft */}
            <div className="absolute w-52 h-52 bg-gradient-to-tr from-cyan-500/10 via-purple-500/10 to-transparent blur-3xl rounded-full" />

            {/* Holographic Glowing AI Shield */}
            <motion.div
              animate={{ y: [0, -10, 0] }}
              transition={{ repeat: Infinity, duration: 6, ease: "easeInOut" }}
              className={`relative w-48 h-48 rounded-[38px] flex flex-col items-center justify-center border-2 transition-all ${
                theme === "dark"
                  ? "bg-slate-900/70 border-cyan-500/40 text-cyan-300 shadow-[0_0_40px_rgba(6,182,212,0.3)]"
                  : "bg-white border-royal-400 text-royal-650 shadow-[0_15px_30px_rgba(59,130,246,0.1)]"
              }`}
            >
              <Shield className="w-24 h-24 stroke-[1.5]" />
              <span className="absolute text-4xl font-extrabold text-white mt-[-2px]">A</span>

              {/* Floating internal dots */}
              <div className="absolute bottom-6 flex gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-ping" />
                <span className="w-1.5 h-1.5 rounded-full bg-purple-400 animate-pulse" />
                <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-ping" />
              </div>
            </motion.div>

            {/* Floating Orbiting Insurance Icons */}
            {ORBITING_BADGES.map((badge, idx) => (
              <motion.div
                key={idx}
                animate={{ y: [badge.y, badge.y - 8, badge.y] }}
                transition={{ repeat: Infinity, duration: 4.5, delay: badge.delay, ease: "easeInOut" }}
                style={{ left: `calc(50% + ${badge.x}px - 20px)`, top: `calc(50% + ${badge.y}px - 20px)` }}
                className={`absolute w-10 h-10 rounded-xl flex items-center justify-center border transition-all ${
                  theme === "dark"
                    ? "bg-slate-900 border-white/10 shadow-[0_0_15px_rgba(255,255,255,0.03)]"
                    : "bg-white border-slate-200 shadow-premium"
                }`}
              >
                <div className={badge.color}>{badge.icon}</div>
              </motion.div>
            ))}
          </div>
        </div>

      </div>
    </section>
  );
}
