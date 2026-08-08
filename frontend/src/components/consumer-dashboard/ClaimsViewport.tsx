"use client";

import { motion } from "framer-motion";
import type { TimelineEntry } from "@/services/api";

interface ClaimsViewportProps {
  /** The customer's own activity, filtered to their cases. */
  claims: TimelineEntry[];
  loading: boolean;
}

/**
 * Status words a customer can act on.
 *
 * The raw values are work-item event kinds. "AWAITING_CUSTOMER" is a database
 * value; "Waiting for something from you" is what tells somebody their claim
 * has stalled on them rather than on the insurer.
 */
const CLAIM_KIND_LABEL: Record<string, string> = {
  OPENED: "Opened",
  RESOLVED: "Resolved",
  ASSIGNED: "Assigned to an advisor",
  STATUS_CHANGED: "Status changed",
  NOTE: "Note added",
  STEP_COMPLETED: "Step completed",
  ESCALATED: "Escalated",
  CONTACTED: "We contacted you",
};

const CLAIM_KIND_TONE: Record<string, string> = {
  OPENED: "text-cyan-400",
  RESOLVED: "text-emerald-400",
  ESCALATED: "text-amber-400",
};

/**
 * Claim tracking.
 *
 * Every figure here comes from the customer's own case history. This screen
 * previously showed a single invented claim — number "#AEG-CLM-901", a
 * settlement of "₹1,45,000 (Fully Approved)", and a four-step progress bar with
 * three steps marked complete — to every customer, including those who had
 * never made a claim. Somebody with a real claim pending saw a different
 * claim's progress presented as their own.
 */
export function ClaimsViewport({ claims, loading }: ClaimsViewportProps) {
  return (
    <motion.div
      key="claims"
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -15 }}
      className="border shadow-2xl rounded-[32px] p-6 sm:p-8 text-left space-y-6 bg-white border-slate-200 dark:bg-slate-900/40 dark:border-white/5"
    >
      <div className="border-b border-white/5 pb-4">
        <h3 className="font-black text-base text-content">Your claims</h3>
        <p className="text-xs text-slate-400 mt-1 font-medium">
          Every case we have open for you, and where each one has reached.
        </p>
      </div>

      {loading ? (
        <p className="text-xs font-bold text-slate-400" aria-busy="true">
          Loading your cases…
        </p>
      ) : claims.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-white/10 p-8 text-center">
          <p className="text-sm font-bold text-content">You have no claims open.</p>
          <p className="text-xs text-slate-400 mt-1.5 font-medium">
            If you need to make one, ask the advisor and it will start the process with you.
          </p>
        </div>
      ) : (
        <ol className="space-y-4">
          {claims.map((claim) => (
            <li
              key={`${claim.subjectId}-${claim.at}`}
              className="p-5 border rounded-3xl bg-slate-50 border-slate-150 dark:bg-white/[0.01] dark:border-white/5"
            >
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <span
                  className={`text-[9px] font-extrabold uppercase tracking-widest ${
                    CLAIM_KIND_TONE[claim.kind] ?? "text-slate-500"
                  }`}
                >
                  {CLAIM_KIND_LABEL[claim.kind] ?? claim.kind.toLowerCase().replace(/_/g, " ")}
                </span>
                <time
                  dateTime={claim.at}
                  className="text-[9px] font-bold uppercase tracking-wider text-slate-500"
                >
                  {new Date(claim.at).toLocaleDateString(undefined, {
                    day: "numeric",
                    month: "short",
                    year: "numeric",
                  })}
                </time>
              </div>

              <p className="text-sm font-bold text-content mt-1.5">{claim.summary}</p>

              {claim.deepLink ? (
                <a
                  href={claim.deepLink}
                  className="inline-block mt-2 text-[11px] font-black uppercase tracking-wider text-purple-400 hover:text-purple-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-400 rounded"
                >
                  Open this case
                </a>
              ) : null}
            </li>
          ))}
        </ol>
      )}
    </motion.div>
  );
}
