"use client";

import Link from "next/link";
import { Sparkles, Check, Lock, ShieldCheck } from "lucide-react";
import { motion } from "framer-motion";
import { Spinner } from "@/components/shared/Spinner";
import { descClass, finalCardBorder } from "./applyTheme";
import type { Recommendation } from "./recommendation";

interface VerdictStepProps {
  loading: boolean;
  underwritingVerdict: Recommendation | null;
  secureId: string;
}

/** Step 4 — underwriting spinner then the recommended-plan verdict card. */
export function VerdictStep({ loading, underwritingVerdict, secureId }: VerdictStepProps) {
  return (
    <motion.div
      key="step4"
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="space-y-6 text-center"
    >
      {loading ? (
        <div className="py-12 space-y-4">
          <div className="relative w-20 h-20 mx-auto">
            <div className="absolute inset-0 rounded-full border-4 border-white/5" />
            <Spinner className="absolute inset-0 border-cyan-400" />
            <Sparkles className="absolute inset-0 m-auto w-8 h-8 text-cyan-400 animate-pulse" />
          </div>
          <h3 className={`font-extrabold text-base text-content`}>Underwriting Dynamic Risk Parameters...</h3>
          <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest animate-pulse">Running advanced actuarial ML rate locks</p>
        </div>
      ) : (
        <div className="space-y-6 text-left">
          <div className="w-14 h-14 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center justify-center mx-auto shadow-inner mb-2">
            <Check className="w-7 h-7 stroke-[3.5]" />
          </div>

          <div className="text-center space-y-2 mb-6">
            <h2 className={`text-2xl sm:text-3xl font-black text-content`}>Actuarial Risk Qualified</h2>
            <p className={`text-xs font-semibold leading-relaxed ${descClass}`}>Your sovereign security shield has been dynamically underwritten. Secure ID allocated successfully.</p>
          </div>

          {/* Recommendation Card */}
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            className={`bg-white rounded-[32px] p-6 sm:p-8 text-slate-900 border-2 shadow-2xl relative overflow-hidden text-left ${finalCardBorder}`}
          >
            {/* Highlighting badge */}
            <div className={`absolute top-0 right-0 text-white font-black text-[9px] uppercase tracking-widest px-4 py-1.5 rounded-bl-2xl bg-navy-900 dark:bg-gradient-to-l dark:from-royal-600 dark:to-cyan-500`}>
              Bespoke AI Match
            </div>

            {/* Title Header */}
            <div className="flex items-center gap-3.5 mb-6">
              <div className="w-12 h-12 rounded-xl bg-slate-100 text-royal-600 flex items-center justify-center border border-slate-200/60 flex-shrink-0">
                <Sparkles className="w-6 h-6 text-royal-500 fill-royal-50" />
              </div>
              <div>
                <h4 className="font-black text-slate-900 text-[18px] leading-tight">
                  {underwritingVerdict?.name}
                </h4>
                <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider mt-1 inline-block">
                  {underwritingVerdict?.claimRatio}
                </span>
              </div>
            </div>

            {/* Limits Row */}
            <div className="grid grid-cols-2 gap-4 py-4 border-y border-slate-100 text-left mb-4">
              <div>
                <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Policy Coverage</span>
                <p className="font-black text-slate-900 text-lg sm:text-xl mt-0.5">{underwritingVerdict?.coverage}</p>
              </div>
              <div>
                <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Premium Package cost</span>
                <p className="font-black text-royal-600 text-lg sm:text-xl mt-0.5">{underwritingVerdict?.premium}</p>
              </div>
            </div>

            {/* Reason */}
            <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-100 text-[11.5px] text-slate-600 leading-relaxed mb-5 font-semibold">
              <strong className="text-slate-900 block mb-0.5">Actuarial Analytics Reason:</strong>
              {underwritingVerdict?.reason}
            </div>

            {/* Key Benefits List */}
            <div className="space-y-3 mb-6">
              <span className="text-[9.5px] text-slate-400 font-bold uppercase tracking-widest block">Sovereign Safeguards Checklist:</span>
              <ul className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-2">
                {underwritingVerdict?.benefits?.map((b: string, bIdx: number) => (
                  <li key={bIdx} className="flex items-start gap-2 text-xs text-slate-700">
                    <Check className="w-4 h-4 text-emerald-600 stroke-[3.5] mt-0.5 flex-shrink-0" />
                    <span className="font-semibold leading-tight">{b}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Secure Lead ID display */}
            <div className="bg-slate-900 text-white rounded-2xl p-4 flex items-center justify-between border border-white/5">
              <div className="flex items-center gap-2">
                <Lock className="w-4 h-4 text-cyan-400" />
                <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Sovereign Verification number</span>
              </div>
              <span className="font-mono text-xs font-bold text-cyan-400">{secureId}</span>
            </div>
          </motion.div>

          <div className="flex items-center justify-center gap-2 text-[10px] text-slate-500 font-bold uppercase tracking-widest pt-4">
            <ShieldCheck className="w-4 h-4 text-emerald-500" />
            <span>Non-binding guidance — not a policy issuance</span>
          </div>

          <Link
            href="/"
            className={`w-full py-4.5 font-black rounded-2xl text-xs uppercase tracking-widest text-center shadow-2xl block transition-all mt-4 border bg-navy-900 hover:bg-navy-950 text-white border-navy-900 dark:bg-white dark:hover:bg-slate-100 dark:text-slate-950 dark:border-white/10`}
          >
            Return to Secure Console
          </Link>
        </div>
      )}
    </motion.div>
  );
}
