"use client";

import { Heart, Car, Globe, Layers } from "lucide-react";
import { motion } from "framer-motion";
import { useTheme } from "@/context/ThemeContext";
import type { NavId } from "../types";

/** Instant-action desks; each routes into the AI advisor. */
const QUICK_ACTIONS = [
  { title: "Protect Vehicle", icon: <Car className="w-5 h-5" />, symbol: "🚗", color: "hover:border-cyan-550/20 hover:shadow-cyan-950/10" },
  { title: "Protect Family", icon: <Heart className="w-5 h-5" />, symbol: "❤️", color: "hover:border-rose-550/20 hover:shadow-rose-950/10" },
  { title: "Travel Nomad", icon: <Globe className="w-5 h-5" />, symbol: "✈", color: "hover:border-purple-550/20 hover:shadow-purple-950/10" },
  { title: "Secure Property", icon: <Layers className="w-5 h-5" />, symbol: "🏠", color: "hover:border-amber-550/20 hover:shadow-amber-950/10" },
];

/** Premium quick-action desk grid. */
export function QuickActionDesks({ setActiveNav }: { setActiveNav: (nav: NavId) => void }) {
  const { theme } = useTheme();

  return (
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
  );
}
