"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { usePurchase, generatePolicyNumber, generatePolicyId } from "@/context/PurchaseContext";
import {
  ShieldCheck, FileText, Hash, QrCode, CreditCard,
  FileDown, Mail, MessageSquare, CheckCircle2,
} from "lucide-react";

type StepStatus = "waiting" | "running" | "done";

interface ProcessingStep {
  id: string;
  label: string;
  sub: string;
  icon: React.ComponentType<{ className?: string }>;
  delay: number;
  duration: number;
}

const STEPS: ProcessingStep[] = [
  { id: "verify",   label: "Verifying Payment",         sub: "Confirming transaction with payment gateway",  icon: ShieldCheck,    delay: 0,    duration: 1600 },
  { id: "policy",   label: "Generating Policy",          sub: "Underwriting & policy document creation",      icon: FileText,       delay: 1600, duration: 1400 },
  { id: "polno",    label: "Assigning Policy Number",    sub: "Finalising your demo application",              icon: Hash,           delay: 3000, duration: 1200 },
  { id: "qr",       label: "Generating QR Code",         sub: "Quick-access QR for policy retrieval",         icon: QrCode,         delay: 4200, duration: 900  },
  { id: "card",     label: "Creating Insurance Card",    sub: "Digital insurance card with policy details",   icon: CreditCard,     delay: 5100, duration: 1100 },
  { id: "pdf",      label: "Generating Policy PDF",      sub: "Full policy document in PDF format",           icon: FileDown,       delay: 6200, duration: 1200 },
  { id: "email",    label: "Sending Email Confirmation", sub: "Policy documents sent to your registered email", icon: Mail,         delay: 7400, duration: 900  },
  { id: "sms",      label: "Sending SMS Alert",          sub: "Policy number and confirmation via SMS",       icon: MessageSquare,  delay: 8300, duration: 700  },
];

export default function ProcessingPage() {
  const router = useRouter();
  const { setSuccess } = usePurchase();

  const [statuses, setStatuses] = useState<Record<string, StepStatus>>({});
  const [currentStep, setCurrentStep] = useState(0);
  const [allDone, setAllDone] = useState(false);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const timers: ReturnType<typeof setTimeout>[] = [];

    STEPS.forEach((step, i) => {
      timers.push(setTimeout(() => {
        setStatuses(prev => ({ ...prev, [step.id]: "running" }));
        setCurrentStep(i);
      }, step.delay));

      timers.push(setTimeout(() => {
        setStatuses(prev => ({ ...prev, [step.id]: "done" }));
        setProgress(Math.round(((i + 1) / STEPS.length) * 100));
      }, step.delay + step.duration));
    });

    const totalTime = STEPS[STEPS.length - 1].delay + STEPS[STEPS.length - 1].duration + 300;
    timers.push(setTimeout(() => {
      setSuccess(generatePolicyNumber(), generatePolicyId());
      setAllDone(true);
    }, totalTime));

    return () => timers.forEach(clearTimeout);
  }, []);

  useEffect(() => {
    if (allDone) {
      const t = setTimeout(() => router.push("/purchase/success"), 1800);
      return () => clearTimeout(t);
    }
  }, [allDone]);

  return (
    <div className="space-y-6">
      <div className="text-center space-y-1.5">
        <h1 className="text-2xl sm:text-3xl font-bold text-white">Processing Your Policy</h1>
        <p className="text-white/40 text-sm">Please wait · Do not close or refresh this page</p>
      </div>

      {/* Progress Ring */}
      <div className="flex flex-col items-center gap-3 py-4">
        <div className="relative w-24 h-24">
          <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
            <circle cx="50" cy="50" r="40" fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="8" />
            <motion.circle
              cx="50" cy="50" r="40" fill="none"
              stroke="url(#progressGrad)" strokeWidth="8"
              strokeLinecap="round"
              strokeDasharray={`${2 * Math.PI * 40}`}
              animate={{ strokeDashoffset: 2 * Math.PI * 40 * (1 - progress / 100) }}
              transition={{ duration: 0.5 }}
            />
            <defs>
              <linearGradient id="progressGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#06b6d4" />
                <stop offset="100%" stopColor="#3b82f6" />
              </linearGradient>
            </defs>
          </svg>
          <div className="absolute inset-0 flex items-center justify-center">
            <AnimatePresence mode="wait">
              {allDone ? (
                <motion.div key="done" initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: "spring", stiffness: 200 }}>
                  <CheckCircle2 className="w-10 h-10 text-emerald-400" />
                </motion.div>
              ) : (
                <motion.span key="pct" className="text-xl font-bold text-white">{progress}%</motion.span>
              )}
            </AnimatePresence>
          </div>
        </div>
        {!allDone && (
          <p className="text-sm text-cyan-300 font-medium animate-pulse">
            {STEPS[currentStep]?.label || "Initializing…"}
          </p>
        )}
        {allDone && (
          <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-sm text-emerald-300 font-semibold">
            Policy Issued Successfully!
          </motion.p>
        )}
      </div>

      {/* Step list */}
      <div className="rounded-2xl border border-white/5 bg-white/[0.02] p-5 space-y-2.5">
        {STEPS.map((step) => {
          const status = statuses[step.id] || "waiting";
          const Icon = step.icon;
          return (
            <motion.div
              key={step.id}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              className={`flex items-center gap-3 p-3 rounded-xl border transition-all duration-400
                ${status === "done"    ? "border-emerald-500/15 bg-emerald-500/[0.04]" :
                  status === "running" ? "border-cyan-500/20 bg-cyan-500/[0.06]"       :
                                         "border-transparent bg-transparent"}`}
            >
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 transition-colors
                ${status === "done"    ? "bg-emerald-500/15" :
                  status === "running" ? "bg-cyan-500/15"     :
                                         "bg-white/5"}`}>
                {status === "done" ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                ) : status === "running" ? (
                  <motion.div animate={{ rotate: 360 }} transition={{ duration: 1.2, repeat: Infinity, ease: "linear" }}>
                    <Icon className="w-4 h-4 text-cyan-400" />
                  </motion.div>
                ) : (
                  <Icon className="w-4 h-4 text-white/15" />
                )}
              </div>

              <div className="flex-1 min-w-0">
                <p className={`text-sm font-medium truncate ${
                  status === "done"    ? "text-emerald-300" :
                  status === "running" ? "text-cyan-300"     :
                                         "text-white/25"}`}>
                  {step.label}
                </p>
                {status !== "waiting" && (
                  <p className="text-xs text-white/25 truncate">{step.sub}</p>
                )}
              </div>

              <div className="flex-shrink-0 text-xs">
                {status === "done"    && <span className="text-emerald-400 font-medium">Done ✔</span>}
                {status === "running" && <span className="text-cyan-400 animate-pulse">In progress…</span>}
                {status === "waiting" && <span className="text-white/15">Queued</span>}
              </div>
            </motion.div>
          );
        })}
      </div>

      {allDone && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-4 text-center"
        >
          <p className="text-emerald-300 text-sm font-medium">
            Redirecting you to your policy dashboard…
          </p>
          <div className="flex justify-center mt-2">
            <motion.div className="flex gap-1">
              {[0, 1, 2].map(i => (
                <motion.div key={i} className="w-1.5 h-1.5 rounded-full bg-emerald-400"
                  animate={{ opacity: [0.3, 1, 0.3] }}
                  transition={{ duration: 1, repeat: Infinity, delay: i * 0.3 }} />
              ))}
            </motion.div>
          </div>
        </motion.div>
      )}
    </div>
  );
}
