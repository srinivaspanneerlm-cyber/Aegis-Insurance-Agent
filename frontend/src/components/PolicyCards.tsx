"use client";

import { useState, useEffect } from "react";
import { Check, ShieldAlert, Sparkles, Heart, Crown, LucideIcon } from "lucide-react";
import { motion } from "framer-motion";
import { policyService } from "@/services/api";

interface PolicyCardsProps {
  selectedPlan: string;
  onSelectPlan: (plan: string) => void;
  onScrollToForm: () => void;
}

/** A policy record as returned by the backend policy service. */
interface PolicyRecord {
  id: string;
  policyName: string;
  coverage: string;
  premium: number;
}

/** A fully-rendered plan card (static layout merged with any DB overrides). */
interface PolicyCardPlan {
  id: string;
  name: string;
  tagline: string;
  icon: LucideIcon;
  iconColor: string;
  coverage: string;
  monthlyPrice: number;
  yearlyPrice: number;
  claimRatio: string;
  benefits: string[];
  recommended: boolean;
}

export default function PolicyCards({ selectedPlan, onSelectPlan, onScrollToForm }: PolicyCardsProps) {
  const [billingCycle, setBillingCycle] = useState<"monthly" | "yearly">("monthly");
  
  const staticPlans = [
    {
      id: "essential",
      name: "Aegis Essential Shield",
      tagline: "Ideal for young professionals and couples",
      icon: Heart,
      iconColor: "text-emerald-500 bg-emerald-50",
      coverage: "₹25 Lakh Cover",
      monthlyPrice: 390,
      yearlyPrice: 4200,
      claimRatio: "98.8% Claim Ratio",
      benefits: [
        "1,500+ Network Hospitals",
        "Free Annual Health Checkup",
        "Cashless Claims in 2 Hours",
        "Daycare treatments covered",
      ],
      recommended: false,
    },
    {
      id: "supreme",
      name: "Aegis Supreme Health Shield",
      tagline: "Ultimate dynamic cover for growing families",
      icon: Sparkles,
      iconColor: "text-royal-600 bg-blue-50",
      coverage: "₹1 Crore Cover",
      monthlyPrice: 850,
      yearlyPrice: 9180,
      claimRatio: "99.2% Claim Ratio",
      benefits: [
        "Unlimited Cashless Network Beds",
        "Day-1 Pre-Existing Illness Cover",
        "Zero Co-Pay Required",
        "No Room Rent Cap Limit",
        "Free Doctor Consultation 24/7",
      ],
      recommended: true,
    },
    {
      id: "global",
      name: "Aegis Global Elite Shield",
      tagline: "Worldwide premium protection portfolio",
      icon: Crown,
      iconColor: "text-amber-500 bg-amber-50",
      coverage: "₹5 Crore Cover",
      monthlyPrice: 2100,
      yearlyPrice: 22680,
      claimRatio: "99.6% Claim Ratio",
      benefits: [
        "Global Critical Air Evacuation",
        "Worldwide Medical Treatment",
        "Premium Private Suite Room Lock",
        "Personal Medical Concierge",
        "Expat Repatriation Shield",
      ],
      recommended: false,
    },
  ];

  const [plans, setPlans] = useState<PolicyCardPlan[]>(staticPlans);

  useEffect(() => {
    async function loadPolicies() {
      try {
        const fetched = await policyService.getPolicies();
        if (fetched && fetched.length > 0) {
          // Merge dynamic DB parameters with corresponding layout features
          const merged = fetched.map((policy: PolicyRecord) => {
            const staticMatch = staticPlans.find(
              (sp) => sp.name.toLowerCase() === policy.policyName.toLowerCase()
            );

            if (staticMatch) {
              return {
                ...staticMatch,
                coverage: policy.coverage,
                monthlyPrice: policy.premium,
                yearlyPrice: Math.round(policy.premium * 12 * 0.9), // Apply 10% discount for annual package
              };
            }

            // Fallback mapper for completely new DB added policies
            return {
              id: policy.id,
              name: policy.policyName,
              tagline: "Custom corporate protection underwritten by Aegis Core",
              icon: Heart,
              iconColor: "text-royal-600 bg-blue-50",
              coverage: policy.coverage,
              monthlyPrice: policy.premium,
              yearlyPrice: Math.round(policy.premium * 12 * 0.9),
              claimRatio: "99.0% Claim Ratio",
              benefits: [
                "Full Cashless Hospital Network access",
                "Instant claim filing dispatch desk",
                "24/7 direct doctor consulting line",
              ],
              recommended: false,
            };
          });
          setPlans(merged);
        }
      } catch (err) {
        console.warn("Failed to synchronize with backend policy database. Proceeding with static plans fallback.", err);
      }
    }

    loadPolicies();
  }, []);

  return (
    <section id="policy-recommendations" className="py-24 bg-white relative overflow-hidden">
      {/* Decorative Blur BG */}
      <div className="absolute top-[20%] right-[-5%] w-72 h-72 rounded-full bg-royal-600/5 blur-3xl" />

      <div className="max-w-7xl mx-auto px-6">
        {/* Section Header */}
        <div className="text-center mb-16 space-y-4">
          <span className="text-xs font-semibold uppercase tracking-wider text-royal-600 bg-blue-50 border border-blue-100 rounded-full py-1.5 px-4 inline-block">
            Tailored Security Packages
          </span>
          <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold tracking-tight text-navy-900 leading-tight">
            Compare Premium Health & Protection Policies
          </h2>
          <p className="text-slate-500 text-sm sm:text-base max-w-xl mx-auto leading-relaxed">
            Select the absolute best policy designed by Aegis underwriting models. Toggle billing to unlock exclusive annual savings.
          </p>

          {/* Monthly / Yearly Switch */}
          <div className="flex items-center justify-center gap-3 pt-6">
            <span className={`text-sm font-semibold transition-colors ${billingCycle === "monthly" ? "text-navy-900" : "text-slate-400"}`}>
              Monthly Premium
            </span>
            
            <button
              onClick={() => setBillingCycle(billingCycle === "monthly" ? "yearly" : "monthly")}
              className="w-14 h-8 bg-navy-100 hover:bg-navy-200/80 rounded-full p-1 transition-all relative flex items-center shadow-inner cursor-pointer"
            >
              <div
                className={`w-6 h-6 bg-white rounded-full shadow-md transition-transform transform ${
                  billingCycle === "yearly" ? "translate-x-6 bg-royal-600" : ""
                }`}
              />
            </button>
            
            <div className="flex items-center gap-1.5">
              <span className={`text-sm font-semibold transition-colors ${billingCycle === "yearly" ? "text-navy-900 animate-pulse" : "text-slate-400"}`}>
                Yearly Premium
              </span>
              <span className="bg-emerald-100 text-emerald-700 font-extrabold text-[10px] uppercase tracking-wider py-0.5 px-2 rounded-full leading-none">
                Save 10%
              </span>
            </div>
          </div>
        </div>

        {/* Plan Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 items-stretch">
          {plans.map((plan) => {
            const isSelected = selectedPlan === plan.name;
            const price = billingCycle === "monthly" ? plan.monthlyPrice : plan.yearlyPrice;
            const cycleText = billingCycle === "monthly" ? "/ mo" : "/ yr";

            return (
              <motion.div
                key={plan.id}
                whileHover={{ y: -8 }}
                className={`rounded-3xl p-8 flex flex-col justify-between transition-all duration-300 relative ${
                  plan.recommended
                    ? "bg-navy-950 text-white shadow-2xl border-2 border-royal-500 scale-100 md:scale-[1.03]"
                    : "bg-white text-navy-900 shadow-premium hover:shadow-premium-hover border border-slate-100"
                }`}
              >
                {/* AI Recommended Badge */}
                {plan.recommended && (
                  <div className="absolute top-0 right-1/2 translate-x-1/2 translate-y-[-50%] bg-gradient-to-r from-royal-600 to-cyan-500 text-white font-bold text-[10px] uppercase tracking-wider px-4 py-1.5 rounded-full shadow-md flex items-center gap-1">
                    <Sparkles className="w-3.5 h-3.5 fill-white animate-spin-slow" />
                    <span>AI Recommended Suite</span>
                  </div>
                )}

                {/* Plan Header */}
                <div>
                  <div className="flex items-center justify-between gap-4 mb-4">
                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${plan.iconColor}`}>
                      <plan.icon className="w-6.5 h-6.5 stroke-[2.2]" />
                    </div>
                    <span className={`text-xs font-bold px-3 py-1 rounded-full uppercase tracking-wider ${
                      plan.recommended 
                        ? "bg-white/10 text-cyan-400 border border-white/10" 
                        : "bg-slate-50 text-slate-500 border border-slate-200/60"
                    }`}>
                      {plan.claimRatio}
                    </span>
                  </div>

                  <h3 className="text-xl font-bold tracking-tight mb-1">{plan.name}</h3>
                  <p className={`text-[12.5px] leading-relaxed mb-6 font-medium ${plan.recommended ? "text-slate-400" : "text-slate-500"}`}>
                    {plan.tagline}
                  </p>

                  {/* Pricing Frame */}
                  <div className="py-6 border-y border-slate-200/20 mb-6 flex flex-col gap-1 text-left">
                    <span className={`text-[11px] font-semibold uppercase tracking-wider ${plan.recommended ? "text-slate-400" : "text-slate-500"}`}>
                      Full Coverage Limit
                    </span>
                    <span className="text-2xl font-black">{plan.coverage}</span>
                    <div className="flex items-baseline gap-1 mt-2">
                      <span className="text-3xl font-black text-royal-500">₹{price.toLocaleString()}</span>
                      <span className={`text-xs font-semibold ${plan.recommended ? "text-slate-400" : "text-slate-500"}`}>{cycleText}</span>
                    </div>
                  </div>

                  {/* Benefits checklist */}
                  <ul className="space-y-3.5 text-left mb-8">
                    {plan.benefits.map((benefit: string, idx: number) => (
                      <li key={idx} className="flex items-start gap-2.5 text-[13.5px]">
                        <Check className="w-4.5 h-4.5 text-emerald-500 stroke-[3.5] mt-0.5 flex-shrink-0" />
                        <span className={`font-medium ${plan.recommended ? "text-slate-300" : "text-slate-700"}`}>
                          {benefit}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Plan Selection Button */}
                <button
                  onClick={() => {
                    onSelectPlan(plan.name);
                    onScrollToForm();
                  }}
                  className={`w-full py-4 rounded-xl font-bold text-[14px] shadow-sm transition-all duration-300 cursor-pointer ${
                    isSelected
                      ? "bg-emerald-500 hover:bg-emerald-600 text-white shadow-glow-cyan"
                      : plan.recommended
                      ? "bg-white hover:bg-slate-100 text-navy-950 font-extrabold"
                      : "bg-navy-900 hover:bg-navy-950 text-white"
                  }`}
                >
                  {isSelected ? "Plan Selected ✓" : "Lock in My Coverage"}
                </button>
              </motion.div>
            );
          })}
        </div>

        {/* Small Trust Disclaimer Info */}
        <div className="flex items-center justify-center gap-2 mt-12 text-[12px] text-slate-400">
          <ShieldAlert className="w-4 h-4 text-slate-400 flex-shrink-0" />
          <span>Rates are regulated and verified under corporate partner guidelines. IRDAI Licensed.</span>
        </div>
      </div>
    </section>
  );
}
