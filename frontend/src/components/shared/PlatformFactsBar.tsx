"use client";

import type { ReactNode } from "react";
import { ShieldCheck, Users, LayoutGrid, Headphones } from "lucide-react";
import { AnimatedCounter } from "@/components/shared/AnimatedCounter";
import { PLATFORM_FACTS } from "@/lib/platformFacts";

/**
 * Presentation (icon + accent) for each verified fact, keyed by its label.
 * The values, labels and descriptions come from PLATFORM_FACTS — the single
 * source of repo-derived, publishable facts (Step 4.1.1) — so this strip can
 * never drift back into invented marketing numbers the way the old per-page
 * hand-authored stat arrays did.
 */
const FACT_STYLE: Record<string, { icon: ReactNode; accent: string }> = {
  "Curated Plans": {
    icon: <ShieldCheck className="w-4.5 h-4.5" />,
    accent: "bg-royal-500/10 text-royal-400 border-royal-500/20",
  },
  "Specialist AI Advisors": {
    icon: <Users className="w-4.5 h-4.5" />,
    accent: "bg-purple-650/10 text-purple-400 border-purple-500/20",
  },
  "Insurance Categories": {
    icon: <LayoutGrid className="w-4.5 h-4.5" />,
    accent: "bg-cyan-500/10 text-cyan-400 border-cyan-500/20",
  },
  "Advisor Availability": {
    icon: <Headphones className="w-4.5 h-4.5" />,
    accent: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
  },
};

const FALLBACK_STYLE = { icon: null, accent: "bg-white/5 text-slate-400 border-white/10" };

/** A whole-number fact counts up; anything else (e.g. "24/7") shows as-is. */
function FactValue({ value }: { value: string }) {
  return /^\d+$/.test(value) ? (
    <AnimatedCounter value={Number(value)} incrementDivisor={80} minStepMs={24} />
  ) : (
    <>{value}</>
  );
}

/**
 * Full-width capsule strip of verified platform facts, shared by the landing
 * and About marketing pages. `className` carries page-specific vertical spacing.
 */
export function PlatformFactsBar({ className = "" }: { className?: string }) {
  return (
    <section className={`relative px-6 z-10 ${className}`}>
      <div className="max-w-7xl mx-auto p-6 rounded-[28px] border grid grid-cols-2 md:grid-cols-4 gap-x-6 gap-y-7 transition-all duration-300 bg-white border-slate-200 shadow-premium dark:bg-slate-950/60 dark:border-white/5 dark:shadow-2xl">
        {PLATFORM_FACTS.map((fact) => {
          const style = FACT_STYLE[fact.label] ?? FALLBACK_STYLE;
          return (
            <div key={fact.label} className="flex items-start gap-3.5 text-left">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center border flex-shrink-0 ${style.accent}`}>
                {style.icon}
              </div>
              <div className="min-w-0">
                <h3 className="text-xl font-mono font-black text-content leading-none">
                  <FactValue value={fact.value} />
                </h3>
                <span className="text-[10px] text-content-muted font-bold uppercase tracking-wider mt-1.5 block">
                  {fact.label}
                </span>
                <p className="text-[10px] text-slate-500 font-medium mt-1.5 leading-snug">
                  {fact.desc}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
