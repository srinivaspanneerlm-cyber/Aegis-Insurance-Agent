"use client";

import { User, Phone, Mail, Lock, ArrowRight } from "lucide-react";
import { motion } from "framer-motion";
import { descClass, labelClass, inputClass } from "./applyTheme";

interface ContactStepProps {
  fullName: string;
  setFullName: (v: string) => void;
  phone: string;
  setPhone: (v: string) => void;
  email: string;
  setEmail: (v: string) => void;
  onBack: () => void;
  onSubmit: () => void;
}

/** Step 3 — collect legal contact details before underwriting. */
export function ContactStep({
  fullName, setFullName, phone, setPhone, email, setEmail, onBack, onSubmit,
}: ContactStepProps) {
  return (
    <motion.div
      key="step3"
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 10 }}
      className="space-y-6 text-left"
    >
      <div className="space-y-2">
        <h2 className={`text-2xl sm:text-3xl font-extrabold tracking-tight text-content`}>Legal Verification Lock</h2>
        <p className={`text-xs font-semibold leading-relaxed ${descClass}`}>Enter your contact credentials to verify pre-approved risk limits and generate the qualified secure Lead ID.</p>
      </div>

      {/* Full Name */}
      <div className="space-y-2">
        <label className={`text-[10px] font-bold uppercase tracking-widest block ${labelClass}`}>Full Legal Name (Matching ID):</label>
        <div className="relative">
          <input
            type="text"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            placeholder="Aravind Sharma"
            className={`w-full py-4 pl-11 pr-4 rounded-xl border outline-none text-xs font-semibold transition-all ${inputClass}`}
          />
          <User className="absolute left-4 top-1/2 -translate-y-1/2 w-4.5 h-4.5 text-slate-400" />
        </div>
      </div>

      {/* Phone */}
      <div className="space-y-2">
        <label className={`text-[10px] font-bold uppercase tracking-widest block ${labelClass}`}>Secure Mobile (For OTP and CSR Alerts):</label>
        <div className="relative">
          <input
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="9876543210"
            className={`w-full py-4 pl-11 pr-4 rounded-xl border outline-none text-xs font-semibold transition-all ${inputClass}`}
          />
          <Phone className="absolute left-4 top-1/2 -translate-y-1/2 w-4.5 h-4.5 text-slate-400" />
        </div>
      </div>

      {/* Email */}
      <div className="space-y-2">
        <label className={`text-[10px] font-bold uppercase tracking-widest block ${labelClass}`}>Policy Dispatch Email:</label>
        <div className="relative">
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="aravind@corporate.com"
            className={`w-full py-4 pl-11 pr-4 rounded-xl border outline-none text-xs font-semibold transition-all ${inputClass}`}
          />
          <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4.5 h-4.5 text-slate-400" />
        </div>
      </div>

      {/* Encrypted Notice */}
      <div className={`p-4 rounded-2xl border flex items-start gap-3 bg-slate-100/50 border-slate-200 dark:bg-white/[0.02] dark:border-white/5`}>
        <Lock className="w-5 h-5 text-emerald-500 flex-shrink-0 mt-0.5" />
        <p className={`text-[10px] font-semibold leading-normal ${descClass}`}>
          By submitting, you authorize Aegis AI to construct a secure pre-underwritten profile in accordance with DPDP security protocols. Zero spam guaranteed.
        </p>
      </div>

      <div className="flex gap-4">
        <button
          onClick={onBack}
          className={`py-4 px-6 border rounded-2xl font-bold text-xs uppercase tracking-widest transition-colors cursor-pointer border-slate-200 bg-white text-slate-600 hover:bg-slate-100 shadow-sm dark:border-white/10 dark:hover:bg-white/5 dark:text-slate-400 dark:shadow-none`}
        >
          Back
        </button>
        <button
          onClick={onSubmit}
          className={`flex-grow py-4 rounded-2xl font-black text-xs uppercase tracking-widest shadow-2xl flex items-center justify-center gap-2 border transition-all cursor-pointer bg-navy-900 hover:bg-navy-950 text-white border-navy-900 dark:bg-gradient-to-r dark:from-royal-500 dark:to-cyan-500 dark:hover:from-royal-600 dark:hover:to-cyan-600 dark:border-white/10 dark:text-white`}
        >
          <span>Submit & Underwrite Risk</span>
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>
    </motion.div>
  );
}
