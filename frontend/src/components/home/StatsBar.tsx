"use client";

import { Users, ShieldCheck, Headphones, Award, Star } from "lucide-react";
import { AnimatedCounter } from "@/components/shared/AnimatedCounter";

/** Headline platform stats. `decimals` renders tenths (48 → "4.8"). */
const STATS = [
  { value: 50000, suffix: "+", label: "Happy Customers", icon: <Users className="w-4.5 h-4.5" />, color: "bg-purple-650/10 text-purple-400 border-purple-500/20" },
  { value: 95, suffix: "%", label: "Customer Satisfaction", icon: <ShieldCheck className="w-4.5 h-4.5" />, color: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" },
  { value: 24, suffix: "/7", label: "AI Assistance", icon: <Headphones className="w-4.5 h-4.5" />, color: "bg-blue-500/10 text-blue-400 border-blue-500/20" },
  { value: 120, suffix: "Cr+", label: "Coverage Guided", icon: <Award className="w-4.5 h-4.5" />, color: "bg-amber-500/10 text-amber-400 border-amber-500/20" },
  { value: 48, suffix: "/5", label: "Rating on Platform", icon: <Star className="w-4.5 h-4.5" />, color: "bg-pink-500/10 text-pink-400 border-pink-500/20", decimals: 1 },
];

/** Full-width statistics capsule bar with animated counters. */
export function StatsBar() {
  return (
    <section className="relative px-6 pb-16 z-10">
      <div className={`max-w-7xl mx-auto p-6 rounded-[28px] border flex flex-col md:flex-row items-center justify-between gap-6 transition-all duration-300 bg-white border-slate-200 shadow-premium dark:bg-slate-950/60 dark:border-white/5 dark:shadow-2xl`}>
        {STATS.map((stat, idx) => (
          <div key={idx} className="flex items-center gap-4 text-left w-full md:w-auto justify-start md:justify-center border-r last:border-0 border-white/5 pr-4 last:pr-0">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center border ${stat.color}`}>
              {stat.icon}
            </div>
            <div>
              <h3 className={`text-xl font-mono font-black text-content leading-none`}>
                <AnimatedCounter value={stat.value} suffix={stat.suffix} decimals={stat.decimals} incrementDivisor={80} minStepMs={24} />
              </h3>
              <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider mt-1 block">
                {stat.label}
              </span>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
