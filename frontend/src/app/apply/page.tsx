"use client";

import { Suspense } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Navbar from "@/components/Navbar";
import { Spinner } from "@/components/shared/Spinner";
import Footer from "@/components/Footer";
import { useTheme } from "@/context/ThemeContext";
import {
  useApplyFlow,
  wrapperClass,
  mainCardClass,
  FamilyStep,
  BudgetStep,
  ContactStep,
  VerdictStep,
} from "@/components/apply";

function ApplyForm() {
  const { theme } = useTheme();
  const flow = useApplyFlow();

  return (
    <div className={`min-h-screen relative flex flex-col justify-between overflow-hidden transition-colors duration-300 ${wrapperClass}`}>
      <Navbar />
      <main id="main-content">

      {/* Decorative Glows */}
      {theme === "dark" && (
        <>
          <div className="absolute top-[20%] left-[-10%] w-[50%] h-[50%] rounded-full bg-royal-500/10 blur-[100px] pointer-events-none" />
          <div className="absolute bottom-[20%] right-[-10%] w-[40%] h-[40%] rounded-full bg-cyan-400/5 blur-[80px] pointer-events-none" />
        </>
      )}

      {/* Main Container */}
      <section className="relative pt-32 pb-24 flex-grow flex items-center justify-center">
        <div className="max-w-2xl w-full mx-auto px-6">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className={`border p-8 sm:p-12 relative overflow-hidden ${mainCardClass}`}
          >
            {/* Glow bar */}
            <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-royal-500 via-royal-600 to-cyan-400" />

            {/* Top Indicator */}
            <div className={`flex items-center justify-between mb-8 pb-4 border-b border-slate-150 dark:border-white/5`}>
              <span className={`text-[10px] font-black uppercase tracking-widest py-1 px-3.5 rounded-lg text-royal-600 bg-royal-50 border border-royal-100 dark:text-cyan-400 dark:bg-cyan-400/10 dark:border dark:border-cyan-400/20`}>
                AI Insurance Advisor
              </span>
              <span className="text-xs font-bold text-slate-400">Step {flow.step} of 4</span>
            </div>

            <AnimatePresence mode="wait">
              {flow.step === 1 && (
                <FamilyStep
                  familyConfig={flow.familyConfig}
                  toggleFamily={flow.toggleFamily}
                  onNext={() => flow.setStep(2)}
                />
              )}
              {flow.step === 2 && (
                <BudgetStep
                  budgetTier={flow.budgetTier}
                  setBudgetTier={flow.setBudgetTier}
                  priorities={flow.priorities}
                  togglePriority={flow.togglePriority}
                  onBack={() => flow.setStep(1)}
                  onNext={() => flow.setStep(3)}
                />
              )}
              {flow.step === 3 && (
                <ContactStep
                  fullName={flow.fullName}
                  setFullName={flow.setFullName}
                  phone={flow.phone}
                  setPhone={flow.setPhone}
                  email={flow.email}
                  setEmail={flow.setEmail}
                  onBack={() => flow.setStep(2)}
                  onSubmit={flow.executeRiskUnderwriting}
                />
              )}
              {flow.step === 4 && (
                <VerdictStep
                  loading={flow.loading}
                  underwritingVerdict={flow.underwritingVerdict}
                  secureId={flow.secureId}
                />
              )}
            </AnimatePresence>
          </motion.div>
        </div>
      </section>

      </main>
      <Footer />
    </div>
  );
}

export default function ApplyPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <Spinner className="w-10 h-10 border-royal-600" />
      </div>
    }>
      <ApplyForm />
    </Suspense>
  );
}
