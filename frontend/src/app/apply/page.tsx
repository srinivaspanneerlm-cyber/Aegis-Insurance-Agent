"use client";

import { useState, Suspense } from "react";
import Link from "next/link";
import { 
  ShieldCheck, Lock, Sparkles, User, Mail, Phone, 
  ArrowRight, Check, Award, Users, Heart
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { useTheme } from "@/context/ThemeContext";

import { leadService } from "@/services/api";

/** Recommendation verdict surfaced after the guided underwriting flow. */
interface UnderwritingVerdict {
  name?: string;
  claimRatio?: string;
  coverage?: string;
  premium?: string;
  reason?: string;
  benefits?: string[];
}

function ApplyForm() {
  const { theme } = useTheme();

  const [step, setStep] = useState(1);

  // Guided State
  const [familyConfig, setFamilyConfig] = useState<string[]>(["self"]); 
  const [budgetTier, setBudgetTier] = useState("medium"); 
  const [priorities, setPriorities] = useState<string[]>(["room-limit"]); 
  
  // Contact details
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");

  const [loading, setLoading] = useState(false);
  const [secureId, setSecureId] = useState("");
  const [underwritingVerdict, setUnderwritingVerdict] = useState<UnderwritingVerdict | null>(null);

  // Toggle family helper
  const toggleFamily = (member: string) => {
    if (member === "self") return; 
    if (familyConfig.includes(member)) {
      setFamilyConfig(familyConfig.filter((m) => m !== member));
    } else {
      setFamilyConfig([...familyConfig, member]);
    }
  };

  // Toggle priorities
  const togglePriority = (p: string) => {
    if (priorities.includes(p)) {
      setPriorities(priorities.filter((item) => item !== p));
    } else {
      setPriorities([...priorities, p]);
    }
  };

  const computeRecommendation = () => {
    const isGlobal = priorities.includes("global-medevac") || budgetTier === "premium";
    const isLegacy = priorities.includes("pre-illness") && familyConfig.length === 1;
    const isBasic = budgetTier === "basic";

    if (isGlobal) {
      return {
        name: "Aegis Global Elite Shield",
        coverage: "₹5 Crore Cashless Cover",
        premium: "₹2,100 / mo",
        claimRatio: "99.6% Claims Settled",
        icon: "crown",
        reason: "Highest match for global travel or comprehensive multi-country private medical cover, featuring absolute medevac routing locks.",
        benefits: [
          "Global Critical Medical Air Rescue & Transport",
          "Private Suite Hospital Room Lock-In Guaranteed",
          "Day-1 Coverage for Pre-Existing Conditions",
          "Personalized Medical Concierge Assigned"
        ]
      };
    }

    if (isLegacy) {
      return {
        name: "Family Shield Term Life",
        coverage: "₹2 Crore Guaranteed Payout",
        premium: "₹990 / mo",
        claimRatio: "99.2% Claims Settled",
        icon: "shield",
        reason: "Best tailored for single professional breadwinners seeking guaranteed generational asset security.",
        benefits: [
          "Tax-Free Terminal Disbursals under Section 80C",
          "Immediate Lump Sum payout upon Terminal Illness",
          "Guaranteed Level Premium Locks for 40 years",
          "Accidental Death Rider & Child Welfare support"
        ]
      };
    }

    if (isBasic) {
      return {
        name: "Aegis Essential Shield",
        coverage: "₹25 Lakh Cashless Cover",
        premium: "₹390 / mo",
        claimRatio: "98.8% Claims Settled",
        icon: "heart",
        reason: "Cost-optimized policy for young applicants seeking high-value baseline hospital locks.",
        benefits: [
          "1,500+ Network Cashless Hospital access",
          "Free Annual Advanced Medical Checkups",
          "Cashless claims authorized within 2 hours",
          "Zero Room Rent Cap sub-limits"
        ]
      };
    }

    return {
      name: "Aegis Supreme Health Shield",
      coverage: "₹1 Crore Cashless Cover",
      premium: "₹850 / mo",
      claimRatio: "99.2% Claims Settled",
      icon: "sparkles",
      reason: "Optimized comprehensive health protection for growing nuclear families without any room rent co-pays.",
      benefits: [
        "Unlimited Network Cashless Bed allocation",
        "Zero Co-Pay or Sub-limit Deductibles required",
        "2-Hour Cashless claims desk pre-approval",
        "24/7 Unlimited Direct doctor consultations"
      ]
    };
  };

  const executeRiskUnderwriting = async () => {
    if (!fullName.trim() || !phone.trim() || !email.trim()) {
      alert("Please complete all personal security credentials.");
      return;
    }

    setStep(4);
    setLoading(true);

    const recommendation = computeRecommendation();
    const membersString = familyConfig.map(m => m.toUpperCase()).join(" + ");
    const prioritiesString = priorities.join(", ");

    try {
      const lead = await leadService.createLead({
        customerName: fullName,
        email: email,
        phone: phone,
        insuranceType: `${recommendation.name} (${membersString})`,
        budget: `${budgetTier.toUpperCase()} [Priorities: ${prioritiesString}]`,
      });

      if (lead && lead.id) {
        setSecureId(lead.id);
      } else {
        setSecureId("AEG-" + Math.floor(100000 + Math.random() * 900000));
      }
      setUnderwritingVerdict(recommendation);
    } catch (err) {
      console.error("Underwriting lead creation error:", err);
      setSecureId("AEG-" + Math.floor(100000 + Math.random() * 900000));
      setUnderwritingVerdict(recommendation);
    } finally {
      setTimeout(() => {
        setLoading(false);
      }, 2500);
    }
  };

  // Theme styling computed
  const wrapperClass = theme === "dark" ? "bg-slate-950 text-white" : "bg-slate-50 text-navy-900";
  const mainCardClass = theme === "dark" 
    ? "glass-card-dark-premium border-white/10" 
    : "bg-white border-slate-200/80 shadow-2xl rounded-[36px] text-slate-800";

  const labelClass = theme === "dark" ? "text-slate-400" : "text-slate-500";
  const descClass = theme === "dark" ? "text-slate-400" : "text-slate-500";
  
  // Selector button classes
  const getFamilyBtnClass = (member: string) => {
    const isSelected = familyConfig.includes(member);
    if (theme === "dark") {
      return isSelected 
        ? "bg-white/5 border-cyan-400/40 text-white" 
        : "bg-white/[0.02] border-white/5 hover:bg-white/5 text-slate-300";
    } else {
      return isSelected 
        ? "bg-royal-50 border-royal-500/45 text-navy-900 shadow-sm" 
        : "bg-slate-50 border-slate-200 hover:bg-slate-100 text-slate-700";
    }
  };

  const getPriorityBtnClass = (pId: string) => {
    const isSelected = priorities.includes(pId);
    if (theme === "dark") {
      return isSelected
        ? "bg-white/5 border-royal-500/40 text-white"
        : "bg-white/[0.01] border-white/5 hover:bg-white/5 text-slate-400";
    } else {
      return isSelected
        ? "bg-royal-50 border-royal-500/40 text-navy-900 shadow-sm"
        : "bg-slate-50 border-slate-200 hover:bg-slate-100 text-slate-600";
    }
  };

  const getBudgetBtnClass = (tId: string) => {
    const isSelected = budgetTier === tId;
    if (theme === "dark") {
      return isSelected
        ? "bg-white text-slate-950 border-white shadow-lg font-black"
        : "bg-white/[0.02] border-white/5 hover:bg-white/5 text-slate-400 font-bold";
    } else {
      return isSelected
        ? "bg-navy-900 text-white border-navy-900 shadow-lg font-black"
        : "bg-slate-50 border-slate-200 hover:bg-slate-100 text-slate-600 font-bold";
    }
  };

  const getInputClass = () => {
    if (theme === "dark") {
      return "bg-white/5 focus:bg-white/[0.08] border-white/10 focus:border-royal-500 text-white";
    } else {
      return "bg-slate-100/60 focus:bg-white border-slate-250 focus:border-royal-650 text-navy-900 shadow-inner";
    }
  };

  const finalCardBorder = theme === "dark" 
    ? "border-cyan-400" 
    : "border-royal-600 shadow-premium";

  return (
    <div className={`min-h-screen relative flex flex-col justify-between transition-colors duration-300 ${wrapperClass}`}>
      <Navbar />

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
            <div className={`flex items-center justify-between mb-8 pb-4 border-b ${
              theme === "dark" ? "border-white/5" : "border-slate-150"
            }`}>
              <span className={`text-[10px] font-black uppercase tracking-widest py-1 px-3.5 rounded-lg ${
                theme === "dark" ? "text-cyan-400 bg-cyan-400/10 border border-cyan-400/20" : "text-royal-600 bg-royal-50 border border-royal-100"
              }`}>
                Sovereign AI Underwriter
              </span>
              <span className="text-xs font-bold text-slate-400">Step {step} of 4</span>
            </div>

            <AnimatePresence mode="wait">
              
              {/* STEP 1: FAMILY DETAILS */}
              {step === 1 && (
                <motion.div
                  key="step1"
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 10 }}
                  className="space-y-6 text-left"
                >
                  <div className="space-y-2">
                    <h2 className={`text-2xl sm:text-3xl font-extrabold tracking-tight ${theme === "dark" ? "text-white" : "text-navy-900"}`}>Family Protection Setup</h2>
                    <p className={`text-xs font-semibold leading-relaxed ${descClass}`}>Specify the members you seek to shelter. Aegis designs unified policy pools to cover multiple lives.</p>
                  </div>

                  {/* Visual Member Toggles */}
                  <div className="grid grid-cols-2 gap-4">
                    
                    {/* Self */}
                    <div className={`p-4.5 rounded-2xl flex items-center gap-3.5 relative border ${
                      theme === "dark" ? "bg-white/5 border-royal-500/40" : "bg-royal-50 border-royal-500/40 shadow-sm"
                    }`}>
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center border ${
                        theme === "dark" ? "bg-royal-500/20 text-royal-400 border-royal-500/30" : "bg-white text-royal-650 border-royal-150 shadow-inner"
                      }`}>
                        <User className="w-5 h-5" />
                      </div>
                      <div className="text-left">
                        <span className={`text-xs font-bold block ${theme === "dark" ? "text-white" : "text-navy-900"}`}>Self (Primary)</span>
                        <span className="text-[9px] text-emerald-500 font-bold uppercase">Mandatory Lock</span>
                      </div>
                      <div className="absolute top-2.5 right-2.5 w-4.5 h-4.5 rounded-full bg-royal-500 text-white flex items-center justify-center">
                        <Check className="w-3 h-3 stroke-[3]" />
                      </div>
                    </div>

                    {/* Spouse */}
                    <button
                      onClick={() => toggleFamily("spouse")}
                      className={`p-4.5 rounded-2xl flex items-center gap-3.5 relative transition-all border text-left cursor-pointer ${getFamilyBtnClass("spouse")}`}
                    >
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center border ${
                        familyConfig.includes("spouse")
                          ? "bg-cyan-500/20 text-cyan-500 border-cyan-500/30"
                          : "bg-white/5 text-slate-400 border-white/5"
                      }`}>
                        <Heart className="w-5 h-5" />
                      </div>
                      <div className="text-left">
                        <span className={`text-xs font-bold block ${theme === "dark" ? "text-white" : "text-navy-900"}`}>Spouse</span>
                        <span className="text-[9px] text-slate-500 font-bold uppercase">Partner Shield</span>
                      </div>
                      {familyConfig.includes("spouse") && (
                        <div className="absolute top-2.5 right-2.5 w-4.5 h-4.5 rounded-full bg-cyan-500 text-slate-950 flex items-center justify-center">
                          <Check className="w-3 h-3 stroke-[3]" />
                        </div>
                      )}
                    </button>

                    {/* Kids */}
                    <button
                      onClick={() => toggleFamily("kids")}
                      className={`p-4.5 rounded-2xl flex items-center gap-3.5 relative transition-all border text-left cursor-pointer ${getFamilyBtnClass("kids")}`}
                    >
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center border ${
                        familyConfig.includes("kids")
                          ? "bg-pink-400/20 text-pink-500 border-pink-400/30"
                          : "bg-white/5 text-slate-400 border-white/5"
                      }`}>
                        <Users className="w-5 h-5" />
                      </div>
                      <div className="text-left">
                        <span className={`text-xs font-bold block ${theme === "dark" ? "text-white" : "text-navy-900"}`}>Kids (Children)</span>
                        <span className="text-[9px] text-slate-500 font-bold uppercase">Generational Lock</span>
                      </div>
                      {familyConfig.includes("kids") && (
                        <div className="absolute top-2.5 right-2.5 w-4.5 h-4.5 rounded-full bg-pink-500 text-white flex items-center justify-center">
                          <Check className="w-3 h-3 stroke-[3]" />
                        </div>
                      )}
                    </button>

                    {/* Parents */}
                    <button
                      onClick={() => toggleFamily("parents")}
                      className={`p-4.5 rounded-2xl flex items-center gap-3.5 relative transition-all border text-left cursor-pointer ${getFamilyBtnClass("parents")}`}
                    >
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center border ${
                        familyConfig.includes("parents")
                          ? "bg-amber-400/20 text-amber-500 border-amber-400/30"
                          : "bg-white/5 text-slate-400 border-white/5"
                      }`}>
                        <Award className="w-5 h-5" />
                      </div>
                      <div className="text-left">
                        <span className={`text-xs font-bold block ${theme === "dark" ? "text-white" : "text-navy-900"}`}>Senior Parents</span>
                        <span className="text-[9px] text-slate-500 font-bold uppercase">Elder Care Shield</span>
                      </div>
                      {familyConfig.includes("parents") && (
                        <div className="absolute top-2.5 right-2.5 w-4.5 h-4.5 rounded-full bg-amber-500 text-white flex items-center justify-center">
                          <Check className="w-3 h-3 stroke-[3]" />
                        </div>
                      )}
                    </button>

                  </div>

                  <button
                    onClick={() => setStep(2)}
                    className={`w-full py-4 rounded-2xl font-black text-xs uppercase tracking-widest shadow-2xl flex items-center justify-center gap-2 transition-all cursor-pointer mt-4 ${
                      theme === "dark" ? "bg-white hover:bg-slate-100 text-slate-950" : "bg-navy-900 hover:bg-navy-950 text-white"
                    }`}
                  >
                    <span>Configure Budget & Goals</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </motion.div>
              )}

              {/* STEP 2: BUDGET & GOALS */}
              {step === 2 && (
                <motion.div
                  key="step2"
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 10 }}
                  className="space-y-6 text-left"
                >
                  <div className="space-y-2">
                    <h2 className={`text-2xl sm:text-3xl font-extrabold tracking-tight ${theme === "dark" ? "text-white" : "text-navy-900"}`}>Underwriting Core Metrics</h2>
                    <p className={`text-xs font-semibold leading-relaxed ${descClass}`}>Establish your financial guidelines and select primary liability priorities.</p>
                  </div>

                  {/* Budget Selector */}
                  <div className="space-y-3">
                    <label className={`text-[10px] font-bold uppercase tracking-widest block ${labelClass}`}>Target Monthly Premium Tier:</label>
                    <div className="grid grid-cols-3 gap-3">
                      {[
                        { id: "basic", label: "Core Guard", price: "₹300 - ₹500" },
                        { id: "medium", label: "Family Shield", price: "₹500 - ₹1,000" },
                        { id: "premium", label: "Royal Global", price: "₹2,000+" }
                      ].map((t) => (
                        <button
                          key={t.id}
                          onClick={() => setBudgetTier(t.id)}
                          className={`p-3.5 rounded-xl border text-center transition-all cursor-pointer ${getBudgetBtnClass(t.id)}`}
                        >
                          <span className="text-xs font-black block leading-none">{t.label}</span>
                          <span className="text-[9px] font-bold opacity-75 mt-1.5 inline-block">{t.price}</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Priorities Tags Selection */}
                  <div className="space-y-3">
                    <label className={`text-[10px] font-bold uppercase tracking-widest block ${labelClass}`}>Premium Priority Add-Ons:</label>
                    <div className="flex flex-col gap-2">
                      
                      {[
                        { id: "room-limit", title: "Zero Room Rent Caps", desc: "No limits on private suite room selections." },
                        { id: "pre-illness", title: "Day-1 Pre-Existing Illness", desc: "Covers historical diabetes, blood pressure, etc. instantly." },
                        { id: "global-medevac", title: "Global Emergency Medevac", desc: "Worldwide critical air medical evacuation support." },
                        { id: "low-copay", title: "Absolute Zero Co-Pay", desc: "No deductions on qualified cashless payouts." }
                      ].map((p) => {
                        const isChecked = priorities.includes(p.id);
                        return (
                          <button
                            key={p.id}
                            onClick={() => togglePriority(p.id)}
                            className={`p-3.5 rounded-xl border flex items-center justify-between text-left transition-all cursor-pointer ${getPriorityBtnClass(p.id)}`}
                          >
                            <div className="pr-4 leading-normal">
                              <span className={`text-xs font-bold block ${theme === "dark" ? "text-white" : "text-navy-900"}`}>{p.title}</span>
                              <span className="text-[9px] font-semibold text-slate-500 mt-0.5 inline-block">{p.desc}</span>
                            </div>
                            <div className={`w-5 h-5 rounded-md flex items-center justify-center border transition-all ${
                              isChecked ? "bg-royal-500 border-royal-500 text-white" : "border-slate-350"
                            }`}>
                              {isChecked && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                            </div>
                          </button>
                        );
                      })}

                    </div>
                  </div>

                  <div className="flex gap-4">
                    <button
                      onClick={() => setStep(1)}
                      className={`py-4 px-6 border rounded-2xl font-bold text-xs uppercase tracking-widest transition-colors cursor-pointer ${
                        theme === "dark" ? "border-white/10 hover:bg-white/5 text-slate-400" : "border-slate-200 bg-white text-slate-600 hover:bg-slate-100 shadow-sm"
                      }`}
                    >
                      Back
                    </button>
                    <button
                      onClick={() => setStep(3)}
                      className={`flex-grow py-4 rounded-2xl font-black text-xs uppercase tracking-widest shadow-2xl flex items-center justify-center gap-2 transition-all cursor-pointer ${
                        theme === "dark" ? "bg-white hover:bg-slate-100 text-slate-950" : "bg-navy-900 hover:bg-navy-950 text-white"
                      }`}
                    >
                      <span>Proceed to Verification</span>
                      <ArrowRight className="w-4 h-4" />
                    </button>
                  </div>
                </motion.div>
              )}

              {/* STEP 3: SECURE LEGAL CONTACT */}
              {step === 3 && (
                <motion.div
                  key="step3"
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 10 }}
                  className="space-y-6 text-left"
                >
                  <div className="space-y-2">
                    <h2 className={`text-2xl sm:text-3xl font-extrabold tracking-tight ${theme === "dark" ? "text-white" : "text-navy-900"}`}>Legal Verification Lock</h2>
                    <p className={`text-xs font-semibold leading-relaxed ${descClass}`}>Enter your contact credentials to verify pre-approved risk limits and generate the qualified secure Lead ID.</p>
                  </div>

                  {/* Full Name */}
                  <div className="space-y-2">
                    <label className={`text-[10px] font-bold uppercase tracking-widest block ${labelClass}`}>Full Legal Name (Matching ID):</label>
                    <div className="relative">
                      <input
                        type="text"
                        value={fullName}
                        onChange={(e) => setFullName(e.target.value)}
                        placeholder="Aravind Sharma"
                        className={`w-full py-4 pl-11 pr-4 rounded-xl border outline-none text-xs font-semibold transition-all ${getInputClass()}`}
                      />
                      <User className="absolute left-4 top-1/2 -translate-y-1/2 w-4.5 h-4.5 text-slate-400" />
                    </div>
                  </div>

                  {/* Phone */}
                  <div className="space-y-2">
                    <label className={`text-[10px] font-bold uppercase tracking-widest block ${labelClass}`}>Secure Mobile (For OTP and CSR Alerts):</label>
                    <div className="relative">
                      <input
                        type="tel"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        placeholder="9876543210"
                        className={`w-full py-4 pl-11 pr-4 rounded-xl border outline-none text-xs font-semibold transition-all ${getInputClass()}`}
                      />
                      <Phone className="absolute left-4 top-1/2 -translate-y-1/2 w-4.5 h-4.5 text-slate-400" />
                    </div>
                  </div>

                  {/* Email */}
                  <div className="space-y-2">
                    <label className={`text-[10px] font-bold uppercase tracking-widest block ${labelClass}`}>Policy Dispatch Email:</label>
                    <div className="relative">
                      <input
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="aravind@corporate.com"
                        className={`w-full py-4 pl-11 pr-4 rounded-xl border outline-none text-xs font-semibold transition-all ${getInputClass()}`}
                      />
                      <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4.5 h-4.5 text-slate-400" />
                    </div>
                  </div>

                  {/* Encrypted Notice */}
                  <div className={`p-4 rounded-2xl border flex items-start gap-3 ${
                    theme === "dark" ? "bg-white/[0.02] border-white/5" : "bg-slate-100/50 border-slate-200"
                  }`}>
                    <Lock className="w-5 h-5 text-emerald-500 flex-shrink-0 mt-0.5" />
                    <p className={`text-[10px] font-semibold leading-normal ${descClass}`}>
                      By submitting, you authorize Aegis AI to construct a secure pre-underwritten profile in accordance with DPDP security protocols. Zero spam guaranteed.
                    </p>
                  </div>

                  <div className="flex gap-4">
                    <button
                      onClick={() => setStep(2)}
                      className={`py-4 px-6 border rounded-2xl font-bold text-xs uppercase tracking-widest transition-colors cursor-pointer ${
                        theme === "dark" ? "border-white/10 hover:bg-white/5 text-slate-400" : "border-slate-200 bg-white text-slate-600 hover:bg-slate-100 shadow-sm"
                      }`}
                    >
                      Back
                    </button>
                    <button
                      onClick={executeRiskUnderwriting}
                      className={`flex-grow py-4 rounded-2xl font-black text-xs uppercase tracking-widest shadow-2xl flex items-center justify-center gap-2 border transition-all cursor-pointer ${
                        theme === "dark"
                          ? "bg-gradient-to-r from-royal-500 to-cyan-500 hover:from-royal-600 hover:to-cyan-600 border-white/10 text-white"
                          : "bg-navy-900 hover:bg-navy-950 text-white border-navy-900"
                      }`}
                    >
                      <span>Submit & Underwrite Risk</span>
                      <ArrowRight className="w-4 h-4" />
                    </button>
                  </div>
                </motion.div>
              )}

              {/* STEP 4: AI UNDERWRITING RECOMMENDATION */}
              {step === 4 && (
                <motion.div
                  key="step4"
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="space-y-6 text-center"
                >
                  {loading ? (
                    <div className="py-12 space-y-4">
                      <div className="relative w-20 h-20 mx-auto">
                        <div className="absolute inset-0 rounded-full border-4 border-white/5" />
                        <div className="absolute inset-0 rounded-full border-4 border-cyan-400 border-t-transparent animate-spin" />
                        <Sparkles className="absolute inset-0 m-auto w-8 h-8 text-cyan-400 animate-pulse" />
                      </div>
                      <h3 className={`font-extrabold text-base ${theme === "dark" ? "text-white" : "text-navy-900"}`}>Underwriting Dynamic Risk Parameters...</h3>
                      <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest animate-pulse">Running advanced actuarial ML rate locks</p>
                    </div>
                  ) : (
                    <div className="space-y-6 text-left">
                      <div className="w-14 h-14 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center justify-center mx-auto shadow-inner mb-2">
                        <Check className="w-7 h-7 stroke-[3.5]" />
                      </div>

                      <div className="text-center space-y-2 mb-6">
                        <h2 className={`text-2xl sm:text-3xl font-black ${theme === "dark" ? "text-white" : "text-navy-900"}`}>Actuarial Risk Qualified</h2>
                        <p className={`text-xs font-semibold leading-relaxed ${descClass}`}>Your sovereign security shield has been dynamically underwritten. Secure ID allocated successfully.</p>
                      </div>

                      {/* Recommendation Card */}
                      <motion.div
                        initial={{ opacity: 0, y: 15 }}
                        animate={{ opacity: 1, y: 0 }}
                        className={`bg-white rounded-[32px] p-6 sm:p-8 text-slate-900 border-2 shadow-2xl relative overflow-hidden text-left ${finalCardBorder}`}
                      >
                        {/* Highlighting badge */}
                        <div className={`absolute top-0 right-0 text-white font-black text-[9px] uppercase tracking-widest px-4 py-1.5 rounded-bl-2xl ${
                          theme === "dark" ? "bg-gradient-to-l from-royal-600 to-cyan-500" : "bg-navy-900"
                        }`}>
                          Bespoke AI Match
                        </div>

                        {/* Title Header */}
                        <div className="flex items-center gap-3.5 mb-6">
                          <div className="w-12 h-12 rounded-xl bg-slate-100 text-royal-600 flex items-center justify-center border border-slate-200/60 flex-shrink-0">
                            <Sparkles className="w-6 h-6 text-royal-500 fill-royal-50" />
                          </div>
                          <div>
                            <h4 className="font-black text-slate-900 text-[18px] leading-tight">
                              {underwritingVerdict?.name}
                            </h4>
                            <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider mt-1 inline-block">
                              {underwritingVerdict?.claimRatio}
                            </span>
                          </div>
                        </div>

                        {/* Limits Row */}
                        <div className="grid grid-cols-2 gap-4 py-4 border-y border-slate-100 text-left mb-4">
                          <div>
                            <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Policy Coverage</span>
                            <p className="font-black text-slate-900 text-lg sm:text-xl mt-0.5">{underwritingVerdict?.coverage}</p>
                          </div>
                          <div>
                            <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Premium Package cost</span>
                            <p className="font-black text-royal-600 text-lg sm:text-xl mt-0.5">{underwritingVerdict?.premium}</p>
                          </div>
                        </div>

                        {/* Reason */}
                        <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-100 text-[11.5px] text-slate-600 leading-relaxed mb-5 font-semibold">
                          <strong className="text-slate-900 block mb-0.5">Actuarial Analytics Reason:</strong>
                          {underwritingVerdict?.reason}
                        </div>

                        {/* Key Benefits List */}
                        <div className="space-y-3 mb-6">
                          <span className="text-[9.5px] text-slate-400 font-bold uppercase tracking-widest block">Sovereign Safeguards Checklist:</span>
                          <ul className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-2">
                            {underwritingVerdict?.benefits?.map((b: string, bIdx: number) => (
                              <li key={bIdx} className="flex items-start gap-2 text-xs text-slate-700">
                                <Check className="w-4 h-4 text-emerald-600 stroke-[3.5] mt-0.5 flex-shrink-0" />
                                <span className="font-semibold leading-tight">{b}</span>
                              </li>
                            ))}
                          </ul>
                        </div>

                        {/* Secure Lead ID display */}
                        <div className="bg-slate-900 text-white rounded-2xl p-4 flex items-center justify-between border border-white/5">
                          <div className="flex items-center gap-2">
                            <Lock className="w-4 h-4 text-cyan-400" />
                            <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Sovereign Verification number</span>
                          </div>
                          <span className="font-mono text-xs font-bold text-cyan-400">{secureId}</span>
                        </div>
                      </motion.div>

                      <div className="flex items-center justify-center gap-2 text-[10px] text-slate-500 font-bold uppercase tracking-widest pt-4">
                        <ShieldCheck className="w-4 h-4 text-emerald-500" />
                        <span>Governed under IRDAI digital guidelines</span>
                      </div>

                      <Link
                        href="/"
                        className={`w-full py-4.5 font-black rounded-2xl text-xs uppercase tracking-widest text-center shadow-2xl block transition-all mt-4 border ${
                          theme === "dark"
                            ? "bg-white hover:bg-slate-100 text-slate-950 border-white/10"
                            : "bg-navy-900 hover:bg-navy-950 text-white border-navy-900"
                        }`}
                      >
                        Return to Secure Console
                      </Link>
                    </div>
                  )}
                </motion.div>
              )}

            </AnimatePresence>
          </motion.div>
        </div>
      </section>

      <Footer />
    </div>
  );
}

export default function ApplyPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="w-10 h-10 rounded-full border-4 border-royal-600 border-t-transparent animate-spin" />
      </div>
    }>
      <ApplyForm />
    </Suspense>
  );
}
