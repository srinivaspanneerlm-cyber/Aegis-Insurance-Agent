"use client";
import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";
import { PurchaseProvider, usePurchase } from "@/context/PurchaseContext";
import { ShieldCheck, CheckCircle2 } from "lucide-react";
import { motion } from "framer-motion";

const STEPS = [
  { id: 1, label: "Verify",    path: "/purchase/verify"     },
  { id: 2, label: "Details",   path: "/purchase/details"    },
  { id: 3, label: "Policy",    path: "/purchase/policy"     },
  { id: 4, label: "KYC",       path: "/purchase/kyc"        },
  { id: 5, label: "OTP",       path: "/purchase/otp"        },
  { id: 6, label: "Review",    path: "/purchase/review"     },
  { id: 7, label: "Payment",   path: "/purchase/payment"    },
  { id: 8, label: "Process",   path: "/purchase/processing" },
  { id: 9, label: "Success",   path: "/purchase/success"    },
];

function PurchaseLayoutInner({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { state, isReady } = usePurchase();

  const currentStep = STEPS.find(s => pathname.startsWith(s.path))?.id ?? 1;

  // Route guard: no planData → back to advisor
  useEffect(() => {
    if (!isReady) return;
    if (!state.planData && !pathname.includes("success")) {
      router.replace("/advisor");
    }
  }, [isReady, state.planData, pathname, router]);

  return (
    <div className="min-h-screen bg-[#080c14] text-white">
      {/* Top Header */}
      <div className="border-b border-white/5 bg-[#0b0f1a]/80 backdrop-blur-xl sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
          {/* Logo */}
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center">
              <ShieldCheck className="w-4 h-4 text-white" />
            </div>
            <span className="font-bold text-white text-sm tracking-wide">AEGIS AI</span>
            <span className="text-white/20 text-xs ml-1">|</span>
            <span className="text-white/50 text-xs">Policy Application</span>
          </div>

          {/* Security badge */}
          {/* Visible at every width. This was `hidden sm:flex`, so the one notice
              telling somebody the flow is a demonstration vanished on a phone —
              where most of these journeys happen. */}
          <div className="flex items-center gap-2 text-xs font-semibold text-amber-300">
            <div className="w-1.5 h-1.5 rounded-full bg-amber-400" />
            Demonstration — no policy is issued
          </div>
        </div>

        {/* Step Progress */}
        <div className="max-w-6xl mx-auto px-4 pb-3">
          <div className="flex items-center gap-0.5">
            {STEPS.map((step, i) => {
              const done = step.id < currentStep;
              const active = step.id === currentStep;
              return (
                <div key={step.id} className="flex items-center flex-1">
                  <div className="flex flex-col items-center flex-1 relative">
                    <div className={`
                      w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold
                      transition-all duration-500
                      ${done ? "bg-emerald-500 text-white" :
                        active ? "bg-cyan-500 text-white ring-2 ring-cyan-500/30" :
                        "bg-white/5 text-white/30"}
                    `}>
                      {done ? <CheckCircle2 className="w-3.5 h-3.5" /> : step.id}
                    </div>
                    <span className={`text-[9px] mt-0.5 font-medium hidden sm:block
                      ${done ? "text-emerald-400" : active ? "text-cyan-400" : "text-white/25"}`}>
                      {step.label}
                    </span>
                  </div>
                  {i < STEPS.length - 1 && (
                    <div className={`h-px flex-1 mx-0.5 transition-all duration-700
                      ${step.id < currentStep ? "bg-emerald-500/60" : "bg-white/5"}`} />
                  )}
                </div>
              );
            })}
          </div>
          {/* Progress bar */}
          <div className="mt-2 h-0.5 bg-white/5 rounded-full overflow-hidden">
            <motion.div
              className="h-full bg-gradient-to-r from-cyan-500 to-blue-500"
              initial={{ width: 0 }}
              animate={{ width: `${((currentStep - 1) / (STEPS.length - 1)) * 100}%` }}
              transition={{ duration: 0.6, ease: "easeOut" }}
            />
          </div>
        </div>
      </div>

      {/* Page Content */}
      <main className="max-w-4xl mx-auto px-4 py-8">
        <motion.div
          key={pathname}
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: "easeOut" }}
        >
          {children}
        </motion.div>
      </main>
    </div>
  );
}

export default function PurchaseLayout({ children }: { children: React.ReactNode }) {
  return (
    <PurchaseProvider>
      <PurchaseLayoutInner>{children}</PurchaseLayoutInner>
    </PurchaseProvider>
  );
}
