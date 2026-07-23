"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { usePurchase } from "@/context/PurchaseContext";
import {
  ShieldCheck, User, Calendar, Activity, FileCheck,
  AlertTriangle, ClipboardCheck, Lock, BadgeCheck, CheckCircle2, ArrowRight,
} from "lucide-react";

const CHECKS = [
  { id: "identity",    icon: User,          label: "Identity Verification",   sub: "Cross-checking government ID records",       delay: 0    },
  { id: "age",         icon: Calendar,      label: "Age Validation",          sub: "Verifying eligibility age bracket",           delay: 600  },
  { id: "risk",        icon: Activity,      label: "Risk Profiling",          sub: "Analysing underwriting risk parameters",      delay: 1200 },
  { id: "coverage",    icon: FileCheck,     label: "Coverage Eligibility",    sub: "Mapping coverage limits to profile",          delay: 1800 },
  { id: "fraud",       icon: AlertTriangle, label: "Fraud Detection",         sub: "Running 47-point fraud pattern scan",         delay: 2400 },
  { id: "policy",      icon: ClipboardCheck,label: "Policy Rules Check",      sub: "Reviewing plan rules and eligibility",         delay: 3000 },
  { id: "compliance",  icon: Lock,          label: "Internal Compliance",     sub: "Confirming KYC & AML compliance",             delay: 3600 },
  { id: "executive",   icon: BadgeCheck,    label: "Executive Approval",      sub: "Final sign-off by Chief Risk Officer",        delay: 4200 },
];

type CheckStatus = "pending" | "running" | "done";

export default function VerifyPage() {
  const router = useRouter();
  const { state, setVerificationDone } = usePurchase();
  const [statuses, setStatuses] = useState<Record<string, CheckStatus>>({});
  const [progress, setProgress] = useState(0);
  const [allDone, setAllDone] = useState(false);

  useEffect(() => {
    if (state.verificationDone) { setAllDone(true); setProgress(100); return; }

    const timers: ReturnType<typeof setTimeout>[] = [];

    CHECKS.forEach((check, i) => {
      // Start running
      timers.push(setTimeout(() => {
        setStatuses(prev => ({ ...prev, [check.id]: "running" }));
      }, check.delay));

      // Mark done
      timers.push(setTimeout(() => {
        setStatuses(prev => ({ ...prev, [check.id]: "done" }));
        const pct = Math.round(((i + 1) / CHECKS.length) * 100);
        setProgress(pct);
      }, check.delay + 500));
    });

    // All done
    timers.push(setTimeout(() => {
      setAllDone(true);
      setVerificationDone(true);
    }, CHECKS[CHECKS.length - 1].delay + 700));

    return () => timers.forEach(clearTimeout);
  }, []);

  const plan = state.planData;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="text-center space-y-2">
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 text-xs font-medium mb-3">
          <div className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />
          Secure Verification Channel Active
        </div>
        <h1 className="text-2xl sm:text-3xl font-bold text-white">Insurance Eligibility Verification</h1>
        <p className="text-white/50 text-sm max-w-md mx-auto">
          We are securely verifying your insurance eligibility before policy issuance.
        </p>
      </div>

      {/* Plan Banner */}
      {plan && (
        <div className="rounded-2xl border border-white/5 bg-white/[0.02] p-4 flex items-center gap-4">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-500/20 to-blue-600/20 border border-cyan-500/20 flex items-center justify-center flex-shrink-0">
            <ShieldCheck className="w-5 h-5 text-cyan-400" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-white font-semibold text-sm truncate">{plan.planName}</p>
            <p className="text-white/40 text-xs">{plan.coverage} · {plan.premium}</p>
          </div>
          <div className="text-xs font-medium text-emerald-400 bg-emerald-500/10 px-2 py-1 rounded-full border border-emerald-500/20">
            {plan.riskLevel || "Low Risk"}
          </div>
        </div>
      )}

      {/* Verification Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {CHECKS.map((check, i) => {
          const status = statuses[check.id] || "pending";
          const Icon = check.icon;
          return (
            <motion.div
              key={check.id}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.06, duration: 0.35 }}
              className={`
                rounded-xl border p-4 flex items-center gap-3 transition-all duration-500
                ${status === "done"    ? "border-emerald-500/25 bg-emerald-500/5"  :
                  status === "running" ? "border-cyan-500/30 bg-cyan-500/5"        :
                                         "border-white/5 bg-white/[0.02]"}
              `}
            >
              <div className={`
                w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 transition-all duration-500
                ${status === "done"    ? "bg-emerald-500/15"  :
                  status === "running" ? "bg-cyan-500/15"      :
                                         "bg-white/5"}
              `}>
                {status === "done" ? (
                  <CheckCircle2 className="w-4.5 h-4.5 text-emerald-400" />
                ) : status === "running" ? (
                  <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                  >
                    <Icon className="w-4 h-4 text-cyan-400" />
                  </motion.div>
                ) : (
                  <Icon className="w-4 h-4 text-white/20" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className={`text-sm font-medium transition-colors duration-300
                  ${status === "done" ? "text-emerald-300" : status === "running" ? "text-cyan-300" : "text-white/40"}`}>
                  {check.label}
                </p>
                <p className="text-xs text-white/30 truncate">{check.sub}</p>
              </div>
              <div className="flex-shrink-0">
                {status === "done" && (
                  <motion.span
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    className="text-emerald-400 text-xs font-bold"
                  >✔</motion.span>
                )}
                {status === "running" && (
                  <span className="text-cyan-400 text-xs">...</span>
                )}
              </div>
            </motion.div>
          );
        })}
      </div>

      {/* Progress */}
      <div className="space-y-2">
        <div className="flex justify-between text-xs text-white/40">
          <span>Verification Progress</span>
          <span className="text-cyan-400 font-mono font-bold">{progress}%</span>
        </div>
        <div className="h-2 bg-white/5 rounded-full overflow-hidden">
          <motion.div
            className="h-full rounded-full bg-gradient-to-r from-cyan-500 to-emerald-400"
            animate={{ width: `${progress}%` }}
            transition={{ duration: 0.5, ease: "easeOut" }}
          />
        </div>
      </div>

      {/* Success & Continue */}
      <AnimatePresence>
        {allDone && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="rounded-2xl border border-emerald-500/25 bg-gradient-to-br from-emerald-500/10 to-teal-500/5 p-6 text-center space-y-4"
          >
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: "spring", stiffness: 200, delay: 0.1 }}
              className="w-16 h-16 rounded-full bg-emerald-500/20 border-2 border-emerald-500/40 flex items-center justify-center mx-auto"
            >
              <CheckCircle2 className="w-8 h-8 text-emerald-400" />
            </motion.div>
            <div>
              <h2 className="text-xl font-bold text-white">Verification Completed Successfully</h2>
              <p className="text-emerald-300/70 text-sm mt-1">
                All 8 eligibility checks passed · Executive approval granted
              </p>
            </div>
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => router.push("/purchase/details")}
              className="inline-flex items-center gap-2 px-8 py-3 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 text-white font-semibold text-sm hover:shadow-lg hover:shadow-cyan-500/25 transition-all duration-200"
            >
              Continue to Application <ArrowRight className="w-4 h-4" />
            </motion.button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
