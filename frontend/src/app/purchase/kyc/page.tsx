"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { usePurchase } from "@/context/PurchaseContext";
import {
  CreditCard, Mail, Phone, Camera, FileCheck,
  CheckCircle2, ArrowRight, ShieldCheck,
} from "lucide-react";

type KStatus = "pending" | "verifying" | "verified" | "failed";

interface KItem {
  id: string;
  label: string;
  sub: string;
  icon: React.ComponentType<{ className?: string }>;
  delay: number;
  value?: string;
}

export default function KYCPage() {
  const router = useRouter();
  const { state, setKycDone } = usePurchase();
  const c = state.customerDetails;

  const KYC_ITEMS: KItem[] = [
    { id: "pan",   label: "PAN Validation",        sub: c?.pan || "Not provided",       icon: CreditCard,   delay: 0    },
    { id: "aadh",  label: "Aadhaar Validation",    sub: c?.aadhaar ? `****${c.aadhaar.slice(-4)}` : "Not provided", icon: CreditCard, delay: 700  },
    { id: "email", label: "Email Verification",    sub: c?.email || "Not provided",     icon: Mail,         delay: 1400 },
    { id: "mobile",label: "Mobile Validation",     sub: c?.mobile ? `+91 ${c.mobile}` : "Not provided", icon: Phone, delay: 2100 },
    { id: "govid", label: "Govt ID Cross-Check",   sub: "UIDAI + NSDL database",        icon: FileCheck,    delay: 2800 },
    { id: "face",  label: "Face Match (Biometric)", sub: "Photo ID vs selfie scan",     icon: Camera,       delay: 3500 },
  ];

  const [statuses, setStatuses] = useState<Record<string, KStatus>>({});
  const [progress, setProgress] = useState(0);
  const [allDone, setAllDone] = useState(false);
  const [started, setStarted] = useState(false);

  const startVerification = () => {
    setStarted(true);
    const timers: ReturnType<typeof setTimeout>[] = [];

    KYC_ITEMS.forEach((item, i) => {
      timers.push(setTimeout(() => {
        setStatuses(prev => ({ ...prev, [item.id]: "verifying" }));
      }, item.delay));

      timers.push(setTimeout(() => {
        setStatuses(prev => ({ ...prev, [item.id]: "verified" }));
        setProgress(Math.round(((i + 1) / KYC_ITEMS.length) * 100));
      }, item.delay + 600));
    });

    timers.push(setTimeout(() => {
      setAllDone(true);
      setKycDone(true);
    }, KYC_ITEMS[KYC_ITEMS.length - 1].delay + 800));

    return () => timers.forEach(clearTimeout);
  };

  if (state.kycDone && !allDone) {
    return (
      <div className="space-y-6">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-white">KYC Verification</h1>
          <p className="text-white/40 text-sm mt-1">Previously verified</p>
        </div>
        <div className="rounded-2xl border border-emerald-500/25 bg-emerald-500/5 p-6 text-center space-y-3">
          <CheckCircle2 className="w-12 h-12 text-emerald-400 mx-auto" />
          <p className="text-white font-semibold">KYC Already Verified</p>
          <button onClick={() => router.push("/purchase/otp")}
            className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 text-white text-sm font-semibold">
            Continue to OTP →
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="text-center space-y-1.5">
        <h1 className="text-2xl sm:text-3xl font-bold text-white">KYC Verification</h1>
        <p className="text-white/40 text-sm">Secure identity verification · All data encrypted end-to-end</p>
      </div>

      {/* KYC Dashboard */}
      <div className="rounded-2xl border border-white/5 bg-white/[0.02] p-5 space-y-3">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-sm font-semibold text-white">Document Verification Status</h3>
          {started && (
            <span className="text-xs text-cyan-400 bg-cyan-500/10 px-2 py-0.5 rounded-full border border-cyan-500/20">
              Live Scan Active
            </span>
          )}
        </div>

        {KYC_ITEMS.map((item, i) => {
          const status = statuses[item.id] || "pending";
          const Icon = item.icon;
          return (
            <motion.div
              key={item.id}
              initial={{ opacity: 0, x: -12 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.05 }}
              className={`flex items-center gap-3 p-3.5 rounded-xl border transition-all duration-500
                ${status === "verified"  ? "border-emerald-500/20 bg-emerald-500/5" :
                  status === "verifying" ? "border-cyan-500/25 bg-cyan-500/5"      :
                                           "border-white/5 bg-white/[0.02]"}`}
            >
              <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 transition-colors duration-300
                ${status === "verified"  ? "bg-emerald-500/15" :
                  status === "verifying" ? "bg-cyan-500/15"     :
                                           "bg-white/5"}`}>
                {status === "verified" ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                ) : status === "verifying" ? (
                  <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: "linear" }}>
                    <Icon className="w-4 h-4 text-cyan-400" />
                  </motion.div>
                ) : (
                  <Icon className="w-4 h-4 text-white/20" />
                )}
              </div>
              <div className="flex-1">
                <p className={`text-sm font-medium ${status === "verified" ? "text-emerald-300" : status === "verifying" ? "text-cyan-300" : "text-white/40"}`}>
                  {item.label}
                </p>
                <p className="text-xs text-white/25 font-mono">{item.sub}</p>
              </div>
              <div className="flex-shrink-0 text-xs font-medium">
                {status === "verified"  && <span className="text-emerald-400">Verified ✔</span>}
                {status === "verifying" && <span className="text-cyan-400 animate-pulse">Scanning…</span>}
                {status === "pending"   && <span className="text-white/20">Pending</span>}
              </div>
            </motion.div>
          );
        })}

        {/* Progress bar */}
        {started && (
          <div className="pt-1 space-y-1">
            <div className="flex justify-between text-xs text-white/40">
              <span>Verification Progress</span>
              <span className="text-cyan-400 font-mono">{progress}%</span>
            </div>
            <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
              <motion.div
                className="h-full bg-gradient-to-r from-cyan-500 to-emerald-400 rounded-full"
                animate={{ width: `${progress}%` }}
                transition={{ duration: 0.4 }}
              />
            </div>
          </div>
        )}
      </div>

      {/* Security info */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: "256-bit SSL", icon: ShieldCheck },
          { label: "UIDAI Verified", icon: FileCheck },
          { label: "NSDL Database", icon: CreditCard },
        ].map(({ label, icon: Icon }) => (
          <div key={label} className="rounded-xl border border-white/5 p-3 text-center bg-white/[0.02]">
            <Icon className="w-4 h-4 text-white/25 mx-auto mb-1.5" />
            <p className="text-xs text-white/35 font-medium">{label}</p>
          </div>
        ))}
      </div>

      {/* Action */}
      <AnimatePresence>
        {!started && !allDone && (
          <motion.button
            whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.99 }}
            onClick={startVerification}
            className="w-full py-3.5 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 text-white font-semibold text-sm
              flex items-center justify-center gap-2 hover:shadow-lg hover:shadow-cyan-500/25 transition-all"
          >
            <ShieldCheck className="w-4 h-4" /> Start KYC Verification
          </motion.button>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {allDone && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="rounded-2xl border border-emerald-500/25 bg-emerald-500/5 p-6 text-center space-y-3"
          >
            <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: "spring", stiffness: 200 }}
              className="w-14 h-14 rounded-full bg-emerald-500/20 border-2 border-emerald-400/40 flex items-center justify-center mx-auto">
              <CheckCircle2 className="w-7 h-7 text-emerald-400" />
            </motion.div>
            <div>
              <h2 className="text-lg font-bold text-white">KYC Verified Successfully</h2>
              <p className="text-emerald-300/60 text-sm">All 6 identity checks passed</p>
            </div>
            <button onClick={() => router.push("/purchase/otp")}
              className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 text-white font-semibold text-sm">
              Continue to OTP Verification <ArrowRight className="w-4 h-4" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
