"use client";

import { Heart, ArrowUpRight } from "lucide-react";
import { motion } from "framer-motion";
import { useRouter } from "next/navigation";
import { useTheme } from "@/context/ThemeContext";
import { formatRupees, RenewalTimeline } from "@aegis/intelligence";
import type { RenewalForecast } from "@aegis/intelligence";
import type { HeldPolicy } from "@/services/api";
import { Pagination } from "@/components/shared/Pagination";
import type { PageInfo } from "@/types/domain";
import type { DashboardPolicy } from "./types";
import { NOT_DISCLOSED } from "@/lib/platformFacts";

interface PoliciesViewportProps {
  activePoliciesList: DashboardPolicy[];
  /** Cover the customer already holds, including with other insurers. */
  heldPolicies: HeldPolicy[];
  isProfileLoading: boolean;
  /** Renewals ahead, from the Sprint 9 engine. */
  renewals: RenewalForecast[];
  isReportLoading: boolean;
  pagination: PageInfo | null;
  isPaging: boolean;
  onPageChange: (page: number) => void;
}

/** Active insurance portfolio list (nav: "policies"). */
export function PoliciesViewport({
  activePoliciesList,
  heldPolicies,
  isProfileLoading,
  renewals,
  isReportLoading,
  pagination,
  isPaging,
  onPageChange,
}: PoliciesViewportProps) {
  const { theme } = useTheme();
  const router = useRouter();

  return (
    <motion.div
      key="policies"
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -15 }}
      className={`border shadow-2xl rounded-[32px] p-6 sm:p-8 text-left space-y-6 bg-white border-slate-200 dark:bg-slate-900/40 dark:border-white/5`}
    >
      <div className="border-b border-white/5 pb-4">
        <h3 className={`font-black text-base text-content`}>Your Active Insurance Portfolio</h3>
        <p className="text-xs text-slate-400 mt-1 font-medium">Your saved policies and coverage, all in one place.</p>
      </div>

      <div className="space-y-6">
        {activePoliciesList.map((plan, idx) => (
          <div
            key={idx}
            className={`p-6 border rounded-3xl flex flex-col md:flex-row md:items-center justify-between gap-6 transition-all group bg-slate-50 border-slate-200 hover:border-slate-300 dark:bg-white/[0.01] dark:border-white/5 dark:hover:border-purple-500/30 dark:hover:bg-slate-900/20`}
          >
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-2xl bg-purple-950/40 text-purple-400 flex items-center justify-center flex-shrink-0 border border-purple-800/30">
                <Heart className="w-6.5 h-6.5 stroke-[2.2]" />
              </div>
              <div className="text-left space-y-1.5">
                <span className="bg-emerald-950/40 text-emerald-450 font-extrabold text-[9px] uppercase tracking-widest py-0.5 px-2.5 rounded-full border border-emerald-800/40 inline-block leading-none">
                  Active Scope
                </span>
                <h4 className={`text-base font-black group-hover:text-purple-400 transition-colors leading-none text-content`}>{plan.policyName}</h4>
                {/* This line read "Your details are shared only with the insurer you choose" — words shaped like information. Coverage and premium below are what a customer opened this to check. */}
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-6 text-left">
              <div className="space-y-1">
                <span className="text-[9px] text-slate-500 font-bold uppercase tracking-wider block">Coverage Scope</span>
                <span className={`text-sm font-extrabold block text-content`}>{plan.coverage || NOT_DISCLOSED}</span>
              </div>
              <div className="space-y-1">
                <span className="text-[9px] text-slate-500 font-bold uppercase tracking-wider block">Rate Guarantee</span>
                <span className="text-sm font-extrabold text-purple-400 block">₹{plan.premium || "850"} / month</span>
              </div>
              <div className="space-y-1">
                <span className="text-[9px] text-slate-500 font-bold uppercase tracking-wider block">Claim Settlement</span>
                <span className="text-sm font-extrabold text-emerald-450 block">{NOT_DISCLOSED}</span>
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

      {pagination && (
        <Pagination
          pagination={pagination}
          onPageChange={onPageChange}
          busy={isPaging}
          variant={theme === "dark" ? "dark" : "light"}
        />
      )}

        {/* Cover held elsewhere.
            This is what makes the platform's gap analysis honest: a customer
            who already holds health insurance must not be told to buy it, and
            the engine can only know that if the cover is recorded. */}
        <section aria-labelledby="held-heading" className="border-t border-white/5 pt-6">
          <h3 id="held-heading" className="font-black text-base text-content">
            Cover you already hold
          </h3>
          <p className="text-xs text-slate-400 mt-1 font-medium">
            Including policies bought elsewhere. We use these so we never suggest cover you
            already have.
          </p>

          {isProfileLoading ? (
            <p className="mt-4 text-xs font-bold text-slate-400">Loading…</p>
          ) : heldPolicies.length === 0 ? (
            <p className="mt-4 text-xs font-bold text-slate-400">
              Nothing recorded yet. Telling us about a policy you hold elsewhere makes our advice
              more accurate.
            </p>
          ) : (
            <ul className="mt-4 space-y-3">
              {heldPolicies.map((held) => (
                <li
                  key={held.id}
                  className="rounded-2xl border border-white/5 bg-white/[0.01] p-4 flex flex-wrap items-baseline justify-between gap-2"
                >
                  <div className="min-w-0">
                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">
                      {held.domain}
                      {held.external ? " · elsewhere" : " · with us"}
                    </p>
                    <p className="text-sm font-bold text-content mt-0.5">
                      {held.productName ?? held.insurer ?? "Policy"}
                    </p>
                  </div>
                  <div className="text-right">
                    {held.sumInsured !== null ? (
                      <p className="text-sm font-black text-content">
                        {formatRupees(held.sumInsured)}
                      </p>
                    ) : null}
                    {held.renewalDate ? (
                      <p className="text-[11px] font-bold text-slate-500">
                        renews {new Date(held.renewalDate).toLocaleDateString()}
                      </p>
                    ) : null}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>


        {/* Renewals ahead.
            Reuses RenewalTimeline from @aegis/intelligence rather than drawing
            a second one here — it already explains why each reminder lands when
            it does, and a lapse is the most expensive thing on this page to
            miss. A policy that lapses pays nothing, and for health cover it
            restarts every waiting period. */}
        <section aria-labelledby="renewals-heading" className="border-t border-white/5 pt-6">
          <h3 id="renewals-heading" className="font-black text-base text-content">
            Renewals ahead
          </h3>
          <p className="text-xs text-slate-400 mt-1 mb-4 font-medium">
            When each policy is due, and what is worth changing at renewal.
          </p>

          {isReportLoading ? (
            <p className="text-xs font-bold text-slate-400">Loading…</p>
          ) : (
            <RenewalTimeline renewals={renewals} />
          )}
        </section>

    </motion.div>
  );
}
