"use client";

import { motion } from "framer-motion";
import { ShieldCheck } from "lucide-react";
import { useTheme } from "@/context/ThemeContext";
import { cardVariants } from "./variants";
import type { IntelligenceReport } from "@aegis/intelligence";

interface ProtectionScoreCardProps {
  report: IntelligenceReport | null;
  loading: boolean;
  error: string | null;
}

/** Circumference of the r=58 ring, so the dash offset is derived rather than guessed. */
const RING = 2 * Math.PI * 58;

/**
 * How complete this person's protection is.
 *
 * The number is `profileCompleteness` from the intelligence engine, not a score
 * invented here. It used to read a fixed 82% with two hardcoded status pills,
 * which is the worst kind of dashboard: it looked personal, it never changed,
 * and a customer acting on it would have been acting on nothing.
 *
 * When the report has not arrived, or the profile is too thin to analyse, the
 * card says so instead of showing a plausible number. A percentage a customer
 * cannot act on is worse than an honest blank.
 */
export function ProtectionScoreCard({ report, loading, error }: ProtectionScoreCardProps) {
  const { theme } = useTheme();

  const percent = report?.profileCompleteness ?? 0;
  const offset = RING - (RING * percent) / 100;
  const gaps = report?.gaps ?? [];
  const critical = gaps.filter((gap) => gap.severity === "CRITICAL" || gap.severity === "HIGH");

  return (
    <motion.div
      variants={cardVariants}
      className="rounded-[32px] border p-6 sm:p-7 shadow-2xl space-y-6 relative overflow-hidden transition-all duration-300 bg-white border-slate-200 shadow-premium dark:bg-slate-900/40 dark:border-white/5 dark:shadow-purple-950/5"
    >
      <div className="absolute top-[-30%] left-[-20%] w-40 h-40 rounded-full bg-cyan-500/5 blur-2xl pointer-events-none" />

      <div className="border-b border-white/5 pb-3">
        <h4 className="font-black text-xs sm:text-sm uppercase tracking-wider flex items-center gap-1.5 text-content">
          <ShieldCheck className="w-4.5 h-4.5 text-purple-400" />
          Protection profile
        </h4>
      </div>

      <div className="flex flex-col items-center justify-center py-4 space-y-5">
        <div className="relative w-36 h-36 flex items-center justify-center">
          <div
            className="absolute inset-2.5 rounded-full border border-dashed border-white/10 animate-spin motion-reduce:animate-none"
            style={{ animationDuration: "35s" }}
          />
          <div className="absolute inset-5 rounded-full border border-white/5" />

          <svg className="w-full h-full transform -rotate-90" aria-hidden="true">
            <circle
              cx="72"
              cy="72"
              r="58"
              fill="transparent"
              stroke={theme === "dark" ? "rgba(255,255,255,0.04)" : "rgba(15,23,42,0.04)"}
              strokeWidth="7"
            />
            <motion.circle
              cx="72"
              cy="72"
              r="58"
              fill="transparent"
              stroke="url(#purpleCyanGrad)"
              strokeWidth="7"
              strokeDasharray={RING}
              initial={{ strokeDashoffset: RING }}
              animate={{ strokeDashoffset: loading ? RING : offset }}
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

          {/* The ring is decorative; this text is what a screen reader reads. */}
          <div
            className="absolute flex flex-col items-center justify-center text-center"
            role="status"
            aria-live="polite"
          >
            <span className="text-3xl font-black tracking-tighter text-content">
              {loading || error ? "—" : `${percent}%`}
            </span>
            <span className="text-[8.5px] font-black text-cyan-400 uppercase tracking-widest mt-0.5">
              {loading ? "Loading" : error ? "Unavailable" : "Profile complete"}
            </span>
          </div>
        </div>

        <div className="text-center space-y-1 w-full px-2">
          <p className="text-[11.5px] font-bold text-slate-600 dark:text-slate-350">
            {error
              ? "We could not load your protection profile just now."
              : loading
                ? "Working out where you stand…"
                : (report?.nextBestAction.summary ??
                  "Tell us a little about yourself and we will show you where you stand.")}
          </p>

          {/* One pill per real gap, capped at two. Nothing is shown when the
              engine found nothing — an empty state is the honest answer. */}
          {!loading && !error && critical.length > 0 ? (
            <ul className="flex flex-wrap justify-center gap-3 pt-3">
              {critical.slice(0, 2).map((gap) => (
                <li
                  key={`${gap.domain}-${gap.kind}`}
                  className="inline-flex items-center gap-1 text-[8.5px] text-amber-500 bg-amber-950/40 border border-amber-800/40 py-1 px-3 rounded-full font-black uppercase"
                >
                  {gap.domain}: gap
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      </div>
    </motion.div>
  );
}
