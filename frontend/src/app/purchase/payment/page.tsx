"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { usePurchase, extractPremiumAmount, calculateGST } from "@/context/PurchaseContext";
import {
  Smartphone, CreditCard, Building2, Wallet, Clock, Briefcase,
  ArrowRight, Lock, ChevronDown,
} from "lucide-react";

type Method = "upi" | "card" | "netbanking" | "wallet" | "emi" | "corporate";

const METHODS: { id: Method; label: string; icon: React.ComponentType<{ className?: string }>; desc: string; color: string }[] = [
  { id: "upi",       label: "UPI",             icon: Smartphone,  desc: "Google Pay · PhonePe · Paytm · BHIM", color: "from-purple-500/15 to-violet-500/5 border-purple-500/20" },
  { id: "card",      label: "Credit / Debit Card", icon: CreditCard, desc: "Visa · Mastercard · Rupay · Amex",  color: "from-blue-500/15 to-cyan-500/5 border-blue-500/20" },
  { id: "netbanking",label: "Net Banking",      icon: Building2,   desc: "All major Indian banks",            color: "from-emerald-500/15 to-teal-500/5 border-emerald-500/20" },
  { id: "wallet",    label: "Wallet / Prepaid", icon: Wallet,      desc: "Paytm · Amazon Pay · MobiKwik",     color: "from-yellow-500/15 to-amber-500/5 border-yellow-500/20" },
  { id: "emi",       label: "EMI (0% Interest)",icon: Clock,       desc: "3 / 6 / 9 / 12-month options",      color: "from-cyan-500/15 to-sky-500/5 border-cyan-500/20" },
  { id: "corporate", label: "Corporate Banking",icon: Briefcase,   desc: "NEFT · RTGS · Company account",     color: "from-rose-500/15 to-pink-500/5 border-rose-500/20" },
];

const UPI_APPS = ["Google Pay", "PhonePe", "Paytm", "BHIM", "Amazon Pay"];
const BANKS = ["State Bank of India", "HDFC Bank", "ICICI Bank", "Axis Bank", "Kotak Mahindra", "Punjab National Bank", "Bank of Baroda"];
const WALLETS = ["Paytm", "Amazon Pay", "MobiKwik", "Freecharge", "Airtel Money"];
const EMI_TENURES = [
  { months: 3,  label: "3 Months",  extra: "₹0 extra" },
  { months: 6,  label: "6 Months",  extra: "₹0 extra" },
  { months: 9,  label: "9 Months",  extra: "₹0 extra" },
  { months: 12, label: "12 Months", extra: "₹0 extra" },
];

export default function PaymentPage() {
  const router = useRouter();
  const { state, setPaymentMethod } = usePurchase();
  const plan = state.planData;

  const [selected, setSelected] = useState<Method | null>(null);
  const [upiId, setUpiId] = useState("");
  const [selectedApp, setSelectedApp] = useState("");
  const [cardNo, setCardNo] = useState("");
  const [expiry, setExpiry] = useState("");
  const [cvv, setCvv] = useState("");
  const [cardName, setCardName] = useState("");
  const [bank, setBank] = useState("");
  const [wallet, setWallet] = useState("");
  const [emiTenure, setEmiTenure] = useState(6);
  const [processing, setProcessing] = useState(false);

  const basePremium = extractPremiumAmount(plan?.premium || "850");
  const gst = calculateGST(basePremium);
  const discount = state.couponDiscount > 0 ? Math.round(basePremium * state.couponDiscount / 100) : 0;
  const total = basePremium + gst - discount;

  const formatCard = (v: string) =>
    v.replace(/\D/g, "").slice(0, 16).replace(/(.{4})/g, "$1 ").trim();

  const formatExpiry = (v: string) => {
    const d = v.replace(/\D/g, "").slice(0, 4);
    return d.length > 2 ? `${d.slice(0, 2)}/${d.slice(2)}` : d;
  };

  const canPay = () => {
    if (!selected) return false;
    if (selected === "upi") return upiId.includes("@") || selectedApp !== "";
    if (selected === "card") return cardNo.replace(/\s/g, "").length === 16 && expiry.length === 5 && cvv.length >= 3 && cardName.trim();
    if (selected === "netbanking") return bank !== "";
    if (selected === "wallet") return wallet !== "";
    if (selected === "emi") return emiTenure > 0;
    if (selected === "corporate") return true;
    return false;
  };

  const handlePay = async () => {
    if (!canPay()) return;
    setProcessing(true);
    setPaymentMethod(selected!);
    await new Promise(r => setTimeout(r, 1200));
    router.push("/purchase/processing");
  };

  return (
    <div className="space-y-6">
      <div className="text-center space-y-1.5">
        <h1 className="text-2xl sm:text-3xl font-bold text-white">Payment Center</h1>
        <p className="text-white/40 text-sm">Secure · Encrypted · IRDAI Compliant</p>
      </div>

      {/* Amount Summary */}
      <div className="rounded-2xl border border-white/5 bg-white/[0.02] p-4 flex items-center justify-between">
        <div>
          <p className="text-xs text-white/35 mb-0.5">Total Monthly Premium</p>
          <p className="text-2xl font-bold text-white">₹{total.toLocaleString()}</p>
          {discount > 0 && <p className="text-xs text-emerald-400">-₹{discount} coupon applied</p>}
        </div>
        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
          <Lock className="w-3.5 h-3.5 text-emerald-400" />
          <span className="text-xs text-emerald-300 font-medium">SSL Secured</span>
        </div>
      </div>

      {/* Method Picker */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
        {METHODS.map(m => {
          const Icon = m.icon;
          const active = selected === m.id;
          return (
            <button key={m.id} onClick={() => setSelected(m.id)}
              className={`rounded-xl border p-3.5 text-left transition-all duration-200
                ${active ? `bg-gradient-to-br ${m.color} shadow-lg` : "border-white/5 bg-white/[0.02] hover:border-white/10"}`}
            >
              <Icon className={`w-5 h-5 mb-2 ${active ? "text-white" : "text-white/30"}`} />
              <p className={`text-xs font-semibold leading-tight ${active ? "text-white" : "text-white/50"}`}>{m.label}</p>
            </button>
          );
        })}
      </div>

      {/* Method-specific inputs */}
      <AnimatePresence mode="wait">
        {selected && (
          <motion.div key={selected} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
            className="rounded-2xl border border-white/5 bg-white/[0.02] p-5 space-y-4">

            {/* UPI */}
            {selected === "upi" && (
              <>
                <div>
                  <label className="text-xs text-white/40 mb-1.5 block">UPI ID</label>
                  <input value={upiId} onChange={e => setUpiId(e.target.value)}
                    placeholder="yourname@upi"
                    className="w-full bg-white/[0.04] border border-white/10 rounded-xl px-4 py-2.5 text-white text-sm
                      placeholder-white/20 outline-none focus:border-cyan-500/40 focus:ring-1 focus:ring-cyan-500/20" />
                </div>
                <p className="text-xs text-white/30 text-center">or choose an app</p>
                <div className="flex flex-wrap gap-2">
                  {UPI_APPS.map(app => (
                    <button key={app} onClick={() => setSelectedApp(app === selectedApp ? "" : app)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors
                        ${selectedApp === app ? "bg-purple-500/15 border-purple-500/30 text-purple-300" : "border-white/10 text-white/40 hover:border-white/20"}`}>
                      {app}
                    </button>
                  ))}
                </div>
              </>
            )}

            {/* Card */}
            {selected === "card" && (
              <div className="space-y-3">
                <div>
                  <label className="text-xs text-white/40 mb-1.5 block">Card Number</label>
                  <input value={cardNo} onChange={e => setCardNo(formatCard(e.target.value))}
                    placeholder="1234 5678 9012 3456" maxLength={19}
                    className="w-full bg-white/[0.04] border border-white/10 rounded-xl px-4 py-2.5 text-white text-sm
                      font-mono placeholder-white/20 outline-none focus:border-cyan-500/40 focus:ring-1 focus:ring-cyan-500/20" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-white/40 mb-1.5 block">Expiry (MM/YY)</label>
                    <input value={expiry} onChange={e => setExpiry(formatExpiry(e.target.value))}
                      placeholder="12/28" maxLength={5}
                      className="w-full bg-white/[0.04] border border-white/10 rounded-xl px-4 py-2.5 text-white text-sm
                        font-mono placeholder-white/20 outline-none focus:border-cyan-500/40 focus:ring-1 focus:ring-cyan-500/20" />
                  </div>
                  <div>
                    <label className="text-xs text-white/40 mb-1.5 block">CVV</label>
                    <input value={cvv} onChange={e => setCvv(e.target.value.replace(/\D/g, "").slice(0, 4))}
                      placeholder="•••" type="password"
                      className="w-full bg-white/[0.04] border border-white/10 rounded-xl px-4 py-2.5 text-white text-sm
                        font-mono placeholder-white/20 outline-none focus:border-cyan-500/40 focus:ring-1 focus:ring-cyan-500/20" />
                  </div>
                </div>
                <div>
                  <label className="text-xs text-white/40 mb-1.5 block">Name on Card</label>
                  <input value={cardName} onChange={e => setCardName(e.target.value)}
                    placeholder="RAVI SHANKAR"
                    className="w-full bg-white/[0.04] border border-white/10 rounded-xl px-4 py-2.5 text-white text-sm
                      uppercase placeholder-white/20 outline-none focus:border-cyan-500/40 focus:ring-1 focus:ring-cyan-500/20" />
                </div>
              </div>
            )}

            {/* Net Banking */}
            {selected === "netbanking" && (
              <div>
                <label className="text-xs text-white/40 mb-1.5 block">Select Bank</label>
                <div className="relative">
                  <select value={bank} onChange={e => setBank(e.target.value)}
                    className="w-full bg-white/[0.04] border border-white/10 rounded-xl px-4 py-2.5 text-white text-sm
                      appearance-none outline-none focus:border-cyan-500/40 cursor-pointer">
                    <option value="" className="bg-[#0b0f19]">Choose your bank…</option>
                    {BANKS.map(b => <option key={b} value={b} className="bg-[#0b0f19]">{b}</option>)}
                  </select>
                  <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30 pointer-events-none" />
                </div>
              </div>
            )}

            {/* Wallet */}
            {selected === "wallet" && (
              <div className="flex flex-wrap gap-2">
                {WALLETS.map(w => (
                  <button key={w} onClick={() => setWallet(w === wallet ? "" : w)}
                    className={`px-4 py-2 rounded-lg text-sm font-medium border transition-colors
                      ${wallet === w ? "bg-yellow-500/15 border-yellow-500/30 text-yellow-300" : "border-white/10 text-white/40 hover:border-white/20"}`}>
                    {w}
                  </button>
                ))}
              </div>
            )}

            {/* EMI */}
            {selected === "emi" && (
              <div className="grid grid-cols-2 gap-2">
                {EMI_TENURES.map(e => (
                  <button key={e.months} onClick={() => setEmiTenure(e.months)}
                    className={`p-3.5 rounded-xl border text-left transition-colors
                      ${emiTenure === e.months ? "border-cyan-500/30 bg-cyan-500/10" : "border-white/5 bg-white/[0.02] hover:border-white/10"}`}>
                    <p className={`text-sm font-semibold ${emiTenure === e.months ? "text-cyan-300" : "text-white/60"}`}>{e.label}</p>
                    <p className="text-xs text-white/30 mt-0.5">
                      ₹{Math.ceil(total / e.months).toLocaleString()}/mo · {e.extra}
                    </p>
                  </button>
                ))}
              </div>
            )}

            {/* Corporate */}
            {selected === "corporate" && (
              <div className="space-y-2 text-sm text-white/50">
                <p>Corporate / B2B payment details:</p>
                <div className="font-mono text-xs text-white/35 space-y-1 bg-white/[0.03] rounded-xl p-4 border border-white/5">
                  <p>Account Name: Aegis Insurance Pvt Ltd</p>
                  <p>Account No: 1234567890123456</p>
                  <p>IFSC Code: AEGS0001234</p>
                  <p>Reference: {state.sessionId?.slice(0, 12).toUpperCase() || "AGSPOL123456"}</p>
                </div>
                <p className="text-xs">Policy will be issued within 2 business days of payment receipt.</p>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Security badges */}
      <div className="flex items-center justify-center gap-4 text-xs text-white/20">
        <span>🔒 256-bit SSL</span>
        <span>·</span>
        <span>PCI-DSS Certified</span>
        <span>·</span>
        <span>IRDAI Licensed</span>
      </div>

      <motion.button
        whileHover={{ scale: canPay() && !processing ? 1.01 : 1 }}
        whileTap={{ scale: canPay() && !processing ? 0.99 : 1 }}
        onClick={handlePay}
        disabled={!canPay() || processing}
        className="w-full py-3.5 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 text-white font-semibold text-sm
          flex items-center justify-center gap-2 hover:shadow-lg hover:shadow-cyan-500/25 transition-all
          disabled:opacity-40 disabled:cursor-not-allowed"
      >
        {processing ? (
          <>
            <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
              className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full" />
            Redirecting…
          </>
        ) : (
          <>
            <Lock className="w-4 h-4" />
            Pay ₹{total.toLocaleString()} Securely <ArrowRight className="w-4 h-4" />
          </>
        )}
      </motion.button>
    </div>
  );
}
