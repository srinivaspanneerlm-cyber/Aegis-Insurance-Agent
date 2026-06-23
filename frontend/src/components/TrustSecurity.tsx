"use client";

import { ShieldCheck, Lock, Award, HeartHandshake, Star, Quote } from "lucide-react";
import { motion } from "framer-motion";

export default function TrustSecurity() {
  const stats = [
    { value: "₹500Cr+", label: "Total Claims Disbursed", desc: "Verifiable backing with zero delayed claims", icon: ShieldCheck, color: "text-royal-600 bg-blue-50" },
    { value: "50,000+", label: "Families Protected", desc: "Active policies held in digital vaults", icon: HeartHandshake, color: "text-rose-600 bg-rose-50" },
    { value: "99.2%", label: "Claim Settlement Ratio", desc: "Industry-leading rapid verification standard", icon: Award, color: "text-emerald-600 bg-emerald-50" },
  ];

  const testimonials = [
    {
      name: "Aravind Sharma",
      role: "Father of two, Software Director",
      avatar: "AS",
      quote: "When my father was hospitalized, the Aegis claim desk handled the paperwork in 20 minutes with zero friction. The AI plan recommendation saved us ₹14,000 annually in premium while giving us double the cover of our old policy. Incredible fintech experience.",
      rating: 5,
    },
    {
      name: "Dr. Meera Nair",
      role: "Consultant Pediatrician",
      avatar: "MN",
      quote: "As a doctor, I understand the critical importance of a zero co-pay policy. The Aegis AI advisor accurately filtered plans to show only those with absolute cashless coverage and no room rent sublimits. They represent transparent digital insurance.",
      rating: 5,
    },
    {
      name: "Rohan & Riya Sen",
      role: "Business Owners",
      avatar: "RS",
      quote: "The multi-step AI qualification took 2 minutes. We locked in the Supreme Family Shield, and having 24/7 emergency claim response makes us feel incredibly secure. Highly recommended for couples seeking hassle-free term life coverage.",
      rating: 5,
    },
  ];

  return (
    <section id="trust-security" className="py-24 bg-slate-50 relative overflow-hidden">
      {/* Decorative ambient lighting */}
      <div className="absolute top-0 left-1/3 w-96 h-96 rounded-full bg-cyan-400/5 blur-3xl pointer-events-none" />

      <div className="max-w-7xl mx-auto px-6">
        
        {/* Section Heading */}
        <div className="text-center mb-16 space-y-3">
          <span className="text-xs font-semibold uppercase tracking-wider text-cyan-600 bg-cyan-50 border border-cyan-100 rounded-full py-1.5 px-4 inline-block">
            Sovereign Security & Care
          </span>
          <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold tracking-tight text-navy-900 leading-tight">
            Engineered for Unconditional Trust
          </h2>
          <p className="text-slate-500 text-sm sm:text-base max-w-lg mx-auto">
            Governed by IRDAI compliance codes, protected by bank-grade security vaults, and guided by family wellness frameworks.
          </p>
        </div>

        {/* Dynamic Statistics Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-20 text-left">
          {stats.map((stat, idx) => (
            <motion.div
              key={idx}
              whileHover={{ y: -5 }}
              className="bg-white p-8 rounded-3xl border border-slate-200/80 shadow-premium flex flex-col justify-between gap-6"
            >
              <div className="flex items-center justify-between">
                <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${stat.color}`}>
                  <stat.icon className="w-6.5 h-6.5" />
                </div>
                <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Audited Metric</span>
              </div>
              <div>
                <h3 className="text-3xl sm:text-4xl font-extrabold text-navy-900 tracking-tight">{stat.value}</h3>
                <h4 className="font-bold text-navy-800 text-[14.5px] mt-2">{stat.label}</h4>
                <p className="text-slate-500 text-xs mt-1 leading-relaxed font-medium">{stat.desc}</p>
              </div>
            </motion.div>
          ))}
        </div>

        {/* Security Seals & AI Processing Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center bg-white rounded-3xl p-8 sm:p-12 border border-slate-200/80 shadow-premium mb-20">
          <div className="lg:col-span-7 space-y-6 text-left">
            <div className="inline-flex items-center gap-1.5 text-royal-600 bg-blue-50 py-1 px-3.5 rounded-full text-xs font-semibold uppercase">
              <Lock className="w-3.5 h-3.5 animate-pulse" />
              <span>AES-256 Cloud Security</span>
            </div>
            <h3 className="text-2xl sm:text-3xl font-bold tracking-tight text-navy-900 leading-tight">
              Absolute Privacy. Dynamic Threat Shield.
            </h3>
            <p className="text-slate-600 text-sm sm:text-[14.5px] leading-relaxed font-medium">
              We process personal health data using anonymized machine learning structures. Your inputs are fully encrypted, zero-shared, and stored in compliance with the Digital Personal Data Protection (DPDP) Act of India.
            </p>
            <div className="grid grid-cols-2 gap-4 text-xs font-semibold text-slate-700">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-emerald-500" />
                <span>IRDAI Regulatory Vault</span>
              </div>
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-emerald-500" />
                <span>Zero Agent-Spam Guarantee</span>
              </div>
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-emerald-500" />
                <span>2-Factor Secure Payouts</span>
              </div>
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-emerald-500" />
                <span>ISO 27001 Certified</span>
              </div>
            </div>
          </div>
          <div className="lg:col-span-5 relative flex items-center justify-center p-6 bg-slate-50/50 rounded-2xl border border-slate-100 min-h-[220px]">
            {/* Visual Encrypted Hub representation */}
            <div className="absolute inset-0 bg-gradient-to-tr from-royal-600/5 to-cyan-500/5 blur-xl" />
            <div className="relative text-center space-y-4">
              <div className="w-16 h-16 rounded-full bg-navy-900 flex items-center justify-center text-cyan-400 mx-auto shadow-glow-cyan">
                <Lock className="w-7 h-7" />
              </div>
              <h4 className="font-bold text-navy-900 text-sm">Secure Payment Gateway active</h4>
              <p className="text-[11.5px] text-slate-400 font-semibold uppercase tracking-wider">PCI-DSS Level 1 Compliant</p>
              <div className="flex items-center justify-center gap-4 pt-2 opacity-70">
                <img src="https://img.shields.io/badge/UPI-Enabled-blue" alt="UPI badge" className="h-5" />
                <img src="https://img.shields.io/badge/Visa-Certified-navy" alt="Visa badge" className="h-5" />
                <img src="https://img.shields.io/badge/Rupay-Secure-orange" alt="Rupay badge" className="h-5" />
              </div>
            </div>
          </div>
        </div>

        {/* Customer Testimonials Carousel/Grid */}
        <div className="space-y-8">
          <div className="text-left max-w-lg mb-10">
            <h3 className="text-2xl font-bold tracking-tight text-navy-900 leading-tight">
              Shared Experiences of Financial Safety
            </h3>
            <p className="text-slate-500 text-[13.5px] mt-1.5 leading-relaxed font-semibold">
              Read how Aegis has redefined safety parameters for thousands of real households.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {testimonials.map((t, idx) => (
              <motion.div
                key={idx}
                whileHover={{ y: -4 }}
                className="bg-white p-8 rounded-3xl border border-slate-200/80 shadow-premium flex flex-col justify-between text-left relative"
              >
                <div className="absolute top-6 right-8 text-slate-100 pointer-events-none">
                  <Quote className="w-12 h-12 fill-current" />
                </div>

                <div>
                  {/* Rating */}
                  <div className="flex items-center gap-1 mb-5">
                    {[...Array(t.rating)].map((_, rIdx) => (
                      <Star key={rIdx} className="w-4 h-4 fill-amber-400 text-amber-400" />
                    ))}
                  </div>
                  
                  {/* Quote */}
                  <p className="text-[14px] leading-relaxed text-slate-600 font-medium mb-6 italic">
                    &ldquo;{t.quote}&rdquo;
                  </p>
                </div>

                {/* Profile */}
                <div className="flex items-center gap-3.5 pt-4 border-t border-slate-100">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-navy-900 to-royal-700 text-white font-bold text-xs flex items-center justify-center">
                    {t.avatar}
                  </div>
                  <div>
                    <h5 className="font-bold text-navy-900 text-[14px] leading-none">{t.name}</h5>
                    <span className="text-[11px] text-slate-500 font-semibold mt-1 inline-block">{t.role}</span>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>

      </div>
    </section>
  );
}
