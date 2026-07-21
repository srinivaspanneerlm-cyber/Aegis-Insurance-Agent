"use client";

import { User, Heart, Users, Award, Check, ArrowRight } from "lucide-react";
import { motion } from "framer-motion";
import { descClass, familyBtnClass } from "./applyTheme";

interface FamilyStepProps {
  familyConfig: string[];
  toggleFamily: (member: string) => void;
  onNext: () => void;
}

/** Step 1 — choose which family members the policy pool should cover. */
export function FamilyStep({ familyConfig, toggleFamily, onNext }: FamilyStepProps) {
  return (
    <motion.div
      key="step1"
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 10 }}
      className="space-y-6 text-left"
    >
      <div className="space-y-2">
        <h2 className={`text-2xl sm:text-3xl font-extrabold tracking-tight text-content`}>Family Protection Setup</h2>
        <p className={`text-xs font-semibold leading-relaxed ${descClass}`}>Specify the members you seek to shelter. Aegis designs unified policy pools to cover multiple lives.</p>
      </div>

      {/* Visual Member Toggles */}
      <div className="grid grid-cols-2 gap-4">

        {/* Self */}
        <div className={`p-4.5 rounded-2xl flex items-center gap-3.5 relative border bg-royal-50 border-royal-500/40 shadow-sm dark:bg-white/5 dark:border-royal-500/40 dark:shadow-none`}>
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center border bg-white text-royal-650 border-royal-150 shadow-inner dark:bg-royal-500/20 dark:text-royal-400 dark:border-royal-500/30 dark:shadow-none`}>
            <User className="w-5 h-5" />
          </div>
          <div className="text-left">
            <span className={`text-xs font-bold block text-content`}>Self (Primary)</span>
            <span className="text-[9px] text-emerald-500 font-bold uppercase">Mandatory Lock</span>
          </div>
          <div className="absolute top-2.5 right-2.5 w-4.5 h-4.5 rounded-full bg-royal-500 text-white flex items-center justify-center">
            <Check className="w-3 h-3 stroke-[3]" />
          </div>
        </div>

        {/* Spouse */}
        <button
          onClick={() => toggleFamily("spouse")}
          className={`p-4.5 rounded-2xl flex items-center gap-3.5 relative transition-all border text-left cursor-pointer ${familyBtnClass(familyConfig.includes("spouse"))}`}
        >
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center border ${
            familyConfig.includes("spouse")
              ? "bg-cyan-500/20 text-cyan-500 border-cyan-500/30"
              : "bg-white/5 text-slate-400 border-white/5"
          }`}>
            <Heart className="w-5 h-5" />
          </div>
          <div className="text-left">
            <span className={`text-xs font-bold block text-content`}>Spouse</span>
            <span className="text-[9px] text-slate-500 font-bold uppercase">Partner Shield</span>
          </div>
          {familyConfig.includes("spouse") && (
            <div className="absolute top-2.5 right-2.5 w-4.5 h-4.5 rounded-full bg-cyan-500 text-slate-950 flex items-center justify-center">
              <Check className="w-3 h-3 stroke-[3]" />
            </div>
          )}
        </button>

        {/* Kids */}
        <button
          onClick={() => toggleFamily("kids")}
          className={`p-4.5 rounded-2xl flex items-center gap-3.5 relative transition-all border text-left cursor-pointer ${familyBtnClass(familyConfig.includes("kids"))}`}
        >
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center border ${
            familyConfig.includes("kids")
              ? "bg-pink-400/20 text-pink-500 border-pink-400/30"
              : "bg-white/5 text-slate-400 border-white/5"
          }`}>
            <Users className="w-5 h-5" />
          </div>
          <div className="text-left">
            <span className={`text-xs font-bold block text-content`}>Kids (Children)</span>
            <span className="text-[9px] text-slate-500 font-bold uppercase">Generational Lock</span>
          </div>
          {familyConfig.includes("kids") && (
            <div className="absolute top-2.5 right-2.5 w-4.5 h-4.5 rounded-full bg-pink-500 text-white flex items-center justify-center">
              <Check className="w-3 h-3 stroke-[3]" />
            </div>
          )}
        </button>

        {/* Parents */}
        <button
          onClick={() => toggleFamily("parents")}
          className={`p-4.5 rounded-2xl flex items-center gap-3.5 relative transition-all border text-left cursor-pointer ${familyBtnClass(familyConfig.includes("parents"))}`}
        >
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center border ${
            familyConfig.includes("parents")
              ? "bg-amber-400/20 text-amber-500 border-amber-400/30"
              : "bg-white/5 text-slate-400 border-white/5"
          }`}>
            <Award className="w-5 h-5" />
          </div>
          <div className="text-left">
            <span className={`text-xs font-bold block text-content`}>Senior Parents</span>
            <span className="text-[9px] text-slate-500 font-bold uppercase">Elder Care Shield</span>
          </div>
          {familyConfig.includes("parents") && (
            <div className="absolute top-2.5 right-2.5 w-4.5 h-4.5 rounded-full bg-amber-500 text-white flex items-center justify-center">
              <Check className="w-3 h-3 stroke-[3]" />
            </div>
          )}
        </button>

      </div>

      <button
        onClick={onNext}
        className={`w-full py-4 rounded-2xl font-black text-xs uppercase tracking-widest shadow-2xl flex items-center justify-center gap-2 transition-all cursor-pointer mt-4 bg-navy-900 hover:bg-navy-950 text-white dark:bg-white dark:hover:bg-slate-100 dark:text-slate-950`}
      >
        <span>Configure Budget & Goals</span>
        <ArrowRight className="w-4 h-4" />
      </button>
    </motion.div>
  );
}
