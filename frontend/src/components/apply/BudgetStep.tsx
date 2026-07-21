"use client";

import { Check, ArrowRight } from "lucide-react";
import { motion } from "framer-motion";
import { descClass, labelClass, budgetBtnClass, priorityBtnClass } from "./applyTheme";

interface BudgetStepProps {
  budgetTier: string;
  setBudgetTier: (tier: string) => void;
  priorities: string[];
  togglePriority: (p: string) => void;
  onBack: () => void;
  onNext: () => void;
}

/** Step 2 — pick a premium budget tier and priority add-ons. */
export function BudgetStep({ budgetTier, setBudgetTier, priorities, togglePriority, onBack, onNext }: BudgetStepProps) {
  return (
    <motion.div
      key="step2"
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 10 }}
      className="space-y-6 text-left"
    >
      <div className="space-y-2">
        <h2 className={`text-2xl sm:text-3xl font-extrabold tracking-tight text-content`}>Underwriting Core Metrics</h2>
        <p className={`text-xs font-semibold leading-relaxed ${descClass}`}>Establish your financial guidelines and select primary liability priorities.</p>
      </div>

      {/* Budget Selector */}
      <div className="space-y-3">
        <label className={`text-[10px] font-bold uppercase tracking-widest block ${labelClass}`}>Target Monthly Premium Tier:</label>
        <div className="grid grid-cols-3 gap-3">
          {[
            { id: "basic", label: "Core Guard", price: "₹300 - ₹500" },
            { id: "medium", label: "Family Shield", price: "₹500 - ₹1,000" },
            { id: "premium", label: "Royal Global", price: "₹2,000+" }
          ].map((t) => (
            <button
              key={t.id}
              onClick={() => setBudgetTier(t.id)}
              className={`p-3.5 rounded-xl border text-center transition-all cursor-pointer ${budgetBtnClass(budgetTier === t.id)}`}
            >
              <span className="text-xs font-black block leading-none">{t.label}</span>
              <span className="text-[9px] font-bold opacity-75 mt-1.5 inline-block">{t.price}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Priorities Tags Selection */}
      <div className="space-y-3">
        <label className={`text-[10px] font-bold uppercase tracking-widest block ${labelClass}`}>Premium Priority Add-Ons:</label>
        <div className="flex flex-col gap-2">

          {[
            { id: "room-limit", title: "Zero Room Rent Caps", desc: "No limits on private suite room selections." },
            { id: "pre-illness", title: "Day-1 Pre-Existing Illness", desc: "Covers historical diabetes, blood pressure, etc. instantly." },
            { id: "global-medevac", title: "Global Emergency Medevac", desc: "Worldwide critical air medical evacuation support." },
            { id: "low-copay", title: "Absolute Zero Co-Pay", desc: "No deductions on qualified cashless payouts." }
          ].map((p) => {
            const isChecked = priorities.includes(p.id);
            return (
              <button
                key={p.id}
                onClick={() => togglePriority(p.id)}
                className={`p-3.5 rounded-xl border flex items-center justify-between text-left transition-all cursor-pointer ${priorityBtnClass(isChecked)}`}
              >
                <div className="pr-4 leading-normal">
                  <span className={`text-xs font-bold block text-content`}>{p.title}</span>
                  <span className="text-[9px] font-semibold text-slate-500 mt-0.5 inline-block">{p.desc}</span>
                </div>
                <div className={`w-5 h-5 rounded-md flex items-center justify-center border transition-all ${
                  isChecked ? "bg-royal-500 border-royal-500 text-white" : "border-slate-350"
                }`}>
                  {isChecked && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                </div>
              </button>
            );
          })}

        </div>
      </div>

      <div className="flex gap-4">
        <button
          onClick={onBack}
          className={`py-4 px-6 border rounded-2xl font-bold text-xs uppercase tracking-widest transition-colors cursor-pointer border-slate-200 bg-white text-slate-600 hover:bg-slate-100 shadow-sm dark:border-white/10 dark:hover:bg-white/5 dark:text-slate-400 dark:shadow-none`}
        >
          Back
        </button>
        <button
          onClick={onNext}
          className={`flex-grow py-4 rounded-2xl font-black text-xs uppercase tracking-widest shadow-2xl flex items-center justify-center gap-2 transition-all cursor-pointer bg-navy-900 hover:bg-navy-950 text-white dark:bg-white dark:hover:bg-slate-100 dark:text-slate-950`}
        >
          <span>Proceed to Verification</span>
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>
    </motion.div>
  );
}
