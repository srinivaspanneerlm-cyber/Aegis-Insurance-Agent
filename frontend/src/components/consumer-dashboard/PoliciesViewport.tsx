"use client";

import { Heart, ArrowUpRight } from "lucide-react";
import { motion } from "framer-motion";
import { useRouter } from "next/navigation";
import { useTheme } from "@/context/ThemeContext";
import type { DashboardPolicy } from "./types";

/** Active insurance portfolio list (nav: "policies"). */
export function PoliciesViewport({ activePoliciesList }: { activePoliciesList: DashboardPolicy[] }) {
  const { theme } = useTheme();
  const router = useRouter();

  return (
    <motion.div
      key="policies"
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -15 }}
      className={`border shadow-2xl rounded-[32px] p-6 sm:p-8 text-left space-y-6 ${
        theme === "dark" ? "bg-slate-900/40 border-white/5" : "bg-white border-slate-200"
      }`}
    >
      <div className="border-b border-white/5 pb-4">
        <h3 className={`font-black text-base ${theme === "dark" ? "text-white" : "text-navy-950"}`}>Your Active Insurance Portfolio</h3>
        <p className="text-xs text-slate-400 mt-1 font-medium">Fully locked and regulated under certified premium SaaS underwriting terms.</p>
      </div>

      <div className="space-y-6">
        {activePoliciesList.map((plan, idx) => (
          <div
            key={idx}
            className={`p-6 border rounded-3xl flex flex-col md:flex-row md:items-center justify-between gap-6 transition-all group ${
              theme === "dark" ? "bg-white/[0.01] border-white/5 hover:border-purple-500/30 hover:bg-slate-900/20" : "bg-slate-50 border-slate-200 hover:border-slate-300"
            }`}
          >
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-2xl bg-purple-950/40 text-purple-400 flex items-center justify-center flex-shrink-0 border border-purple-800/30">
                <Heart className="w-6.5 h-6.5 stroke-[2.2]" />
              </div>
              <div className="text-left space-y-1.5">
                <span className="bg-emerald-950/40 text-emerald-450 font-extrabold text-[9px] uppercase tracking-widest py-0.5 px-2.5 rounded-full border border-emerald-800/40 inline-block leading-none">
                  Active Scope
                </span>
                <h4 className={`text-base font-black group-hover:text-purple-400 transition-colors leading-none ${theme === "dark" ? "text-white" : "text-navy-900"}`}>{plan.policyName}</h4>
                <p className="text-xs text-slate-500 font-bold leading-normal">Authorized underwriter network partners locked securely.</p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-6 text-left">
              <div className="space-y-1">
                <span className="text-[9px] text-slate-500 font-bold uppercase tracking-wider block">Coverage Scope</span>
                <span className={`text-sm font-extrabold block ${theme === "dark" ? "text-white" : "text-navy-900"}`}>{plan.coverage || "₹1 Crore Cover"}</span>
              </div>
              <div className="space-y-1">
                <span className="text-[9px] text-slate-500 font-bold uppercase tracking-wider block">Rate Guarantee</span>
                <span className="text-sm font-extrabold text-purple-400 block">₹{plan.premium || "850"} / month</span>
              </div>
              <div className="space-y-1">
                <span className="text-[9px] text-slate-500 font-bold uppercase tracking-wider block">Claim Settlement</span>
                <span className="text-sm font-extrabold text-emerald-450 block">99.2% Settled</span>
              </div>
            </div>

            <button
              onClick={() => router.push("/policies")}
              className="bg-purple-650 hover:bg-purple-600 text-white font-bold py-3 px-5 rounded-2xl text-xs flex items-center gap-1.5 transition-all cursor-pointer border border-purple-500/20"
            >
              <span>Manage Package</span>
              <ArrowUpRight className="w-4 h-4" />
            </button>
          </div>
        ))}
      </div>
    </motion.div>
  );
}
