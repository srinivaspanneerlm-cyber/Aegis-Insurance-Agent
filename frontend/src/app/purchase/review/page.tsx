"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { usePurchase, extractPremiumAmount, calculateGST } from "@/context/PurchaseContext";
import {
  ShieldCheck, User, FileCheck, Tag, CheckSquare,
  ArrowRight, IndianRupee, Percent, Gift,
} from "lucide-react";

const COUPONS: Record<string, number> = {
  AEGIS10: 10,
  FIRSTPLAN: 15,
  NEWUSER20: 20,
};

function Section({ title, icon: Icon, children }: { title: string; icon: React.ComponentType<{className?:string}>; children: React.ReactNode }) {
  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
      className="rounded-2xl border border-white/5 bg-white/[0.02] p-5 space-y-3">
      <div className="flex items-center gap-2 pb-2 border-b border-white/5">
        <Icon className="w-4 h-4 text-cyan-400" />
        <h3 className="text-sm font-semibold text-white">{title}</h3>
      </div>
      {children}
    </motion.div>
  );
}

function Row({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="flex justify-between py-1.5">
      <span className="text-sm text-white/40">{label}</span>
      <span className={`text-sm font-medium ${accent ? "text-cyan-300" : "text-white"}`}>{value}</span>
    </div>
  );
}

export default function ReviewPage() {
  const router = useRouter();
  const { state, setCoupon, setReviewAccepted } = usePurchase();
  const plan = state.planData;
  const c = state.customerDetails;

  const [couponInput, setCouponInput] = useState(state.couponCode || "");
  const [couponError, setCouponError] = useState("");
  const [couponApplied, setCouponApplied] = useState(!!state.couponCode);
  const [accepted, setAccepted] = useState(state.reviewAccepted);

  const basePremium = extractPremiumAmount(plan?.premium || "850");
  const gst = calculateGST(basePremium);
  const discount = state.couponDiscount > 0
    ? Math.round(basePremium * state.couponDiscount / 100)
    : 0;
  const total = basePremium + gst - discount;

  const applyCoupon = () => {
    const pct = COUPONS[couponInput.toUpperCase()];
    if (pct) {
      setCoupon(couponInput.toUpperCase(), pct);
      setCouponApplied(true);
      setCouponError("");
    } else {
      setCouponError("Invalid coupon code");
    }
  };

  const handleContinue = () => {
    setReviewAccepted(true);
    router.push("/purchase/payment");
  };

  if (!plan) return null;

  return (
    <div className="space-y-6">
      <div className="text-center space-y-1.5">
        <h1 className="text-2xl sm:text-3xl font-bold text-white">Final Review</h1>
        <p className="text-white/40 text-sm">Review your complete application before payment</p>
      </div>

      {/* Premium Summary */}
      <Section title="Premium Breakdown" icon={IndianRupee}>
        <Row label="Base Premium (Annual)" value={`₹${(basePremium * 12).toLocaleString()}`} />
        <Row label="Base Premium (Monthly)" value={`₹${basePremium.toLocaleString()}`} />
        <Row label="GST (18%)" value={`₹${gst.toLocaleString()}`} />
        {discount > 0 && <Row label={`Discount (${state.couponCode} — ${state.couponDiscount}% off)`} value={`-₹${discount.toLocaleString()}`} accent />}
        <div className="mt-2 pt-3 border-t border-white/10 flex justify-between items-center">
          <span className="text-white font-semibold">Total Monthly Payable</span>
          <span className="text-2xl font-bold text-white">₹{total.toLocaleString()}</span>
        </div>
      </Section>

      {/* Coupon */}
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
        className="rounded-2xl border border-white/5 bg-white/[0.02] p-5">
        <div className="flex items-center gap-2 mb-3">
          <Gift className="w-4 h-4 text-yellow-400" />
          <h3 className="text-sm font-semibold text-white">Promo Code</h3>
        </div>
        {couponApplied ? (
          <div className="flex items-center justify-between p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/25">
            <span className="text-emerald-300 text-sm font-mono font-bold">{state.couponCode}</span>
            <span className="text-emerald-400 text-sm">{state.couponDiscount}% discount applied ✔</span>
          </div>
        ) : (
          <div className="flex gap-2">
            <div className="flex-1 relative">
              <Tag className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/20" />
              <input
                type="text" value={couponInput} onChange={e => setCouponInput(e.target.value.toUpperCase())}
                placeholder="Enter promo code (e.g. NEWUSER20)"
                className="w-full pl-9 pr-3 py-2.5 rounded-xl bg-white/[0.04] border border-white/10 text-white text-sm
                  placeholder-white/20 outline-none focus:border-cyan-500/40 focus:ring-1 focus:ring-cyan-500/20"
              />
            </div>
            <button onClick={applyCoupon}
              className="px-4 py-2.5 rounded-xl bg-cyan-500/15 border border-cyan-500/25 text-cyan-400 text-sm font-medium hover:bg-cyan-500/25 transition-colors">
              Apply
            </button>
          </div>
        )}
        {couponError && <p className="text-red-400 text-xs mt-1.5">{couponError}</p>}
        {!couponApplied && (
          <p className="text-white/25 text-xs mt-2">Try: AEGIS10 · FIRSTPLAN · NEWUSER20</p>
        )}
      </motion.div>

      {/* Plan Summary */}
      <Section title="Coverage Summary" icon={ShieldCheck}>
        <Row label="Plan Name" value={plan.planName} accent />
        <Row label="Category" value={(plan.category || "").replace("-", " ").replace(/\b\w/g, c => c.toUpperCase())} />
        <Row label="Coverage" value={plan.coverage} />
        <Row label="Claim Settlement Ratio" value={plan.claimSettlementRatio || "99.1%"} />
        <Row label="Risk Level" value={plan.riskLevel || "Low Risk"} />
        {plan.waitingPeriod && <Row label="Waiting Period" value={plan.waitingPeriod as string} />}
      </Section>

      {/* Customer & Nominee */}
      {c && (
        <Section title="Applicant & Nominee" icon={User}>
          <Row label="Full Name" value={`${c.firstName} ${c.lastName}`} />
          <Row label="DOB" value={c.dob} />
          <Row label="Mobile" value={c.mobile} />
          <Row label="Email" value={c.email} />
          <Row label="Nominee" value={`${c.nomineeName} (${c.nomineeRelation})`} accent />
          <Row label="Address" value={`${c.city}, ${c.state} — ${c.pinCode}`} />
        </Section>
      )}

      {/* Documents */}
      <Section title="Verification Status" icon={FileCheck}>
        {[
          { label: "Identity Verification", done: true },
          { label: "KYC (PAN + Aadhaar)", done: state.kycDone },
          { label: "OTP Verification", done: state.otpDone },
          { label: "Executive Approval", done: true },
        ].map(({ label, done }) => (
          <div key={label} className="flex items-center justify-between py-1">
            <span className="text-sm text-white/50">{label}</span>
            <span className={`text-xs font-medium ${done ? "text-emerald-400" : "text-yellow-400"}`}>
              {done ? "✔ Verified" : "⏳ Pending"}
            </span>
          </div>
        ))}
      </Section>

      {/* Declaration */}
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
        className="rounded-2xl border border-white/5 bg-white/[0.02] p-5 space-y-3">
        <div className="flex items-start gap-3">
          <CheckSquare className="w-5 h-5 text-cyan-400 flex-shrink-0 mt-0.5" />
          <h3 className="text-sm font-semibold text-white">Declaration & Terms</h3>
        </div>
        <div className="text-xs text-white/35 leading-relaxed space-y-2">
          <p>I declare that all information provided is accurate and complete to the best of my knowledge. I understand that any misrepresentation may result in claim rejection or policy cancellation.</p>
          <p>I consent to Aegis AI processing my personal data for insurance underwriting purposes in accordance with IRDAI guidelines and applicable data protection laws.</p>
        </div>
        <label className="flex items-center gap-3 cursor-pointer group mt-2">
          <input type="checkbox" checked={accepted} onChange={e => setAccepted(e.target.checked)}
            className="w-4 h-4 accent-cyan-500 rounded cursor-pointer" />
          <span className="text-sm text-white/60 group-hover:text-white/80 transition-colors">
            I accept the Terms & Conditions and Privacy Policy
          </span>
        </label>
      </motion.div>

      <motion.button
        whileHover={{ scale: accepted ? 1.01 : 1 }} whileTap={{ scale: accepted ? 0.99 : 1 }}
        onClick={handleContinue}
        disabled={!accepted}
        className="w-full py-3.5 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 text-white font-semibold text-sm
          flex items-center justify-center gap-2 hover:shadow-lg hover:shadow-cyan-500/25 transition-all
          disabled:opacity-40 disabled:cursor-not-allowed"
      >
        Proceed to Payment <ArrowRight className="w-4 h-4" />
      </motion.button>
    </div>
  );
}
