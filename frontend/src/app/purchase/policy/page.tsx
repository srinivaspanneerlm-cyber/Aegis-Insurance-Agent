"use client";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { usePurchase } from "@/context/PurchaseContext";
import {
  ShieldCheck, Star, AlertTriangle,
  TrendingUp, Plus, ArrowRight, ArrowLeftRight, Zap,
} from "lucide-react";

const RIDERS: { id: string; name: string; price: number; desc: string }[] = [
  { id: "waiver",   name: "Waiver of Premium",    price: 150, desc: "Premium waived on critical illness diagnosis" },
  { id: "critical", name: "Critical Illness Rider", price: 300, desc: "Lump-sum payout on 32 listed illnesses" },
  { id: "personal", name: "Personal Accident",      price: 200, desc: "Accidental death & disability cover" },
  { id: "opd",      name: "OPD Cover",              price: 250, desc: "Outpatient consultations & diagnostics" },
];

function InfoRow({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="flex justify-between items-start py-2.5 border-b border-white/5 last:border-0">
      <span className="text-white/40 text-sm">{label}</span>
      <span className={`text-sm font-medium text-right max-w-[55%] ${accent ? "text-cyan-300" : "text-white"}`}>{value}</span>
    </div>
  );
}

export default function PolicyPage() {
  const router = useRouter();
  const { state } = usePurchase();
  const plan = state.planData;

  if (!plan) return null;

  const categoryColors: Record<string, string> = {
    health: "from-emerald-500/20 to-teal-500/10 border-emerald-500/20",
    motor:  "from-blue-500/20 to-cyan-500/10 border-blue-500/20",
    travel: "from-violet-500/20 to-purple-500/10 border-violet-500/20",
    "home-property": "from-amber-500/20 to-orange-500/10 border-amber-500/20",
    property: "from-amber-500/20 to-orange-500/10 border-amber-500/20",
  };
  const grad = categoryColors[plan.category] || categoryColors.health;

  return (
    <div className="space-y-6">
      <div className="text-center space-y-1.5">
        <h1 className="text-2xl sm:text-3xl font-bold text-white">Your Insurance Plan</h1>
        <p className="text-white/40 text-sm">AI-curated plan details · Review before proceeding</p>
      </div>

      {/* Primary Plan Card */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        className={`rounded-2xl border bg-gradient-to-br ${grad} p-6 space-y-4`}
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <ShieldCheck className="w-4 h-4 text-cyan-400" />
              <span className="text-xs font-medium text-cyan-400 uppercase tracking-wide">{plan.category?.replace("-", " ")} Insurance</span>
            </div>
            <h2 className="text-xl font-bold text-white">{plan.planName}</h2>
            <p className="text-white/50 text-sm mt-0.5">AI Confidence Score: {plan.confidenceScore ? `${Math.round((plan.confidenceScore as number) * 100)}%` : "98%"}</p>
          </div>
          <div className="text-right flex-shrink-0">
            <p className="text-2xl font-bold text-white">{plan.premium}</p>
            <p className="text-white/40 text-xs">per month</p>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {[
            { label: "Coverage", value: plan.coverage, icon: ShieldCheck },
            { label: "Claim Ratio", value: plan.claimSettlementRatio || "99.1%", icon: TrendingUp },
            { label: "Risk Level", value: plan.riskLevel || "Low Risk", icon: Star },
          ].map(({ label, value, icon: Icon }) => (
            <div key={label} className="bg-white/5 rounded-xl p-3 text-center border border-white/5">
              <Icon className="w-4 h-4 text-white/30 mx-auto mb-1" />
              <p className="text-xs text-white/40 mb-0.5">{label}</p>
              <p className="text-sm font-semibold text-white">{value as string}</p>
            </div>
          ))}
        </div>
      </motion.div>

      {/* Policy Details */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="rounded-2xl border border-white/5 bg-white/[0.02] p-5"
      >
        <h3 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
          <Zap className="w-4 h-4 text-yellow-400" /> Policy Details
        </h3>
        <div>
          <InfoRow label="Policy Duration"  value="1 Year (Renewable)" accent />
          <InfoRow label="Waiting Period"   value={plan.waitingPeriod as string || "30 days initial"} />
          {plan.hospitalNetwork && <InfoRow label="Network"          value={plan.hospitalNetwork as string} accent />}
          {plan.premiumBreakdown && <InfoRow label="Premium Breakdown" value={plan.premiumBreakdown as string} />}
          <InfoRow label="Executive Approval" value={plan.executiveApproval as string || "Approved"} accent />
        </div>
      </motion.div>

      {/* Benefits */}
      {plan.benefits?.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="rounded-2xl border border-white/5 bg-white/[0.02] p-5"
        >
          <h3 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
            <Star className="w-4 h-4 text-yellow-400" /> Key Benefits
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {(plan.benefits as string[]).map((b, i) => (
              <div key={i} className="flex items-center gap-2 text-sm text-white/70">
                <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 flex-shrink-0" />
                {b}
              </div>
            ))}
          </div>
        </motion.div>
      )}

      {/* Exclusions */}
      {plan.exclusions && (plan.exclusions as string[]).length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="rounded-2xl border border-red-500/10 bg-red-500/5 p-5"
        >
          <h3 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-red-400" /> Exclusions
          </h3>
          <div className="space-y-1">
            {(plan.exclusions as string[]).map((ex, i) => (
              <div key={i} className="flex items-center gap-2 text-sm text-white/50">
                <div className="w-1.5 h-1.5 rounded-full bg-red-400/50 flex-shrink-0" />
                {ex}
              </div>
            ))}
          </div>
        </motion.div>
      )}

      {/* Add-on Riders */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.25 }}
        className="rounded-2xl border border-white/5 bg-white/[0.02] p-5"
      >
        <h3 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
          <Plus className="w-4 h-4 text-cyan-400" /> Available Add-on Riders
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {RIDERS.map(r => (
            <label key={r.id} className="flex items-start gap-3 p-3 rounded-xl border border-white/5 bg-white/[0.02] hover:border-cyan-500/25 cursor-pointer transition-colors group">
              <input type="checkbox" className="mt-0.5 accent-cyan-500" />
              <div className="flex-1">
                <div className="flex justify-between">
                  <p className="text-sm font-medium text-white group-hover:text-cyan-300 transition-colors">{r.name}</p>
                  <p className="text-xs text-cyan-400 font-mono">+₹{r.price}/mo</p>
                </div>
                <p className="text-xs text-white/35 mt-0.5">{r.desc}</p>
              </div>
            </label>
          ))}
        </div>
      </motion.div>

      {/* CTA */}
      <div className="flex flex-col sm:flex-row gap-3">
        <button
          onClick={() => router.push("/advisor")}
          className="flex-1 py-3 rounded-xl border border-white/10 text-white/50 text-sm font-medium hover:border-white/20 hover:text-white/70 transition-colors flex items-center justify-center gap-2"
        >
          <ArrowLeftRight className="w-4 h-4" /> Change Plan
        </button>
        <motion.button
          whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.99 }}
          onClick={() => router.push("/purchase/kyc")}
          className="flex-1 py-3 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 text-white font-semibold text-sm
            flex items-center justify-center gap-2 hover:shadow-lg hover:shadow-cyan-500/25 transition-all duration-200"
        >
          Proceed to KYC <ArrowRight className="w-4 h-4" />
        </motion.button>
      </div>
    </div>
  );
}
