"use client";

import { Suspense } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import Navbar from "@/components/Navbar";
import { Spinner } from "@/components/shared/Spinner";
import Footer from "@/components/Footer";
import {
  usePolicyDetails,
  DetailsHero,
  DetailsTabsNav,
  BenefitsTab,
  NetworkTab,
  ExclusionsTab,
  CompareTab,
} from "@/components/policy-details";

function PolicyDetailsContent() {
  const d = usePolicyDetails();

  if (!d.plan) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <Spinner className="w-10 h-10 border-cyan-400" />
      </div>
    );
  }

  const plan = d.plan;
  const onProceed = () => d.proceedToAdvisor(plan.planName);
  const onProceedAlternative = () => d.proceedToAdvisor(plan.alternativePlan?.planName ?? "");

  return (
    <div className="min-h-screen bg-slate-950 text-white relative flex flex-col justify-between overflow-x-hidden">
      <Navbar />

      {/* Background gradients */}
      <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(ellipse_80%_80%_at_50%_-20%,rgba(6,182,212,0.08),rgba(255,255,255,0))]" />
      <div className="absolute top-[25%] left-[-15%] w-[60%] h-[60%] rounded-full bg-cyan-500/5 blur-[130px] pointer-events-none" />
      <div className="absolute bottom-[20%] right-[-15%] w-[50%] h-[50%] rounded-full bg-indigo-500/5 blur-[130px] pointer-events-none" />

      {/* Main Container */}
      <main className="relative z-10 pt-28 pb-20 flex-grow max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 w-full">
        <div className="space-y-8">

          {/* Back button */}
          <div className="flex items-center gap-2">
            <Link
              href="/policies"
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-400 hover:text-white transition-colors py-1"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Back to Policy Vaults</span>
            </Link>
          </div>

          {/* Underwriter Header Hero Card */}
          <DetailsHero plan={plan} onProceed={onProceed} />

          {/* Premium Tab Interface */}
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">

            <DetailsTabsNav activeTab={d.activeTab} setActiveTab={d.setActiveTab} />

            {/* Dynamic Content Panel */}
            <div className="lg:col-span-3">
              <AnimatePresence mode="wait">
                <motion.div
                  key={d.activeTab}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -12 }}
                  transition={{ duration: 0.2 }}
                  className="rounded-[32px] bg-slate-900/30 border border-white/5 p-6 sm:p-8 text-left space-y-8"
                >
                  {d.activeTab === "benefits" && (
                    <BenefitsTab
                      plan={plan}
                      selectedRiders={d.selectedRiders}
                      activeRiderIds={d.activeRiderIds}
                      toggleRider={d.toggleRider}
                      basePremium={d.basePremium}
                      gst={d.gst}
                      totalPremium={d.totalPremium}
                      onProceed={onProceed}
                    />
                  )}
                  {d.activeTab === "network" && (
                    <NetworkTab
                      searchQuery={d.searchQuery}
                      setSearchQuery={d.setSearchQuery}
                      filteredHospitals={d.filteredHospitals}
                    />
                  )}
                  {d.activeTab === "exclusions" && (
                    <ExclusionsTab plan={plan} />
                  )}
                  {d.activeTab === "compare" && (
                    <CompareTab plan={plan} onProceed={onProceed} onProceedAlternative={onProceedAlternative} />
                  )}
                </motion.div>
              </AnimatePresence>
            </div>

          </div>

        </div>
      </main>

      <Footer />
    </div>
  );
}

export default function PolicyDetailsPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <Spinner className="w-10 h-10 border-cyan-400" />
      </div>
    }>
      <PolicyDetailsContent />
    </Suspense>
  );
}
