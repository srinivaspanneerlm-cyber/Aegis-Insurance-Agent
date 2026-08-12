"use client";

import Image from "next/image";
import { motion } from "framer-motion";
import { Sparkles, ShieldCheck, Heart, ArrowRight } from "lucide-react";
import {
  CURATED_PLANS,
  INSURANCE_CATEGORIES,
  PLATFORM_FACTS,
} from "@/lib/platformFacts";

interface HeroProps {
  onScrollToChat: () => void;
  onScrollToForm: () => void;
}

export default function Hero({ onScrollToChat, onScrollToForm }: HeroProps) {
  return (
    <section className="relative pt-32 pb-24 md:pt-40 md:pb-32 bg-white overflow-hidden">
      {/* Background Animated Glows */}
      <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] rounded-full bg-gradient-to-tr from-royal-500/10 to-cyan-400/5 blur-3xl opacity-75 pointer-events-none" />
      <div className="absolute top-[20%] right-[-10%] w-[40%] h-[40%] rounded-full bg-gradient-to-bl from-royal-500/10 to-cyan-400/10 blur-3xl opacity-60 pointer-events-none" />

      <div className="max-w-7xl mx-auto px-6 grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-8 items-center">
        {/* Left Column: Premium Text Content */}
        <div className="lg:col-span-7 flex flex-col gap-6 text-left z-10">
          {/* AI Banner Badge */}
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="inline-flex items-center gap-2 self-start bg-navy-50/80 border border-navy-100 rounded-full py-1.5 px-4"
          >
            <Sparkles className="w-4 h-4 text-royal-600 animate-pulse" />
            <span className="text-xs font-semibold text-navy-800 uppercase tracking-wider">
              AI Insurance Advisor
            </span>
          </motion.div>

          {/* Premium Headline */}
          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight text-navy-900 leading-[1.1]"
          >
            Protect Your Family with{" "}
            <span className="gradient-text">AI-Powered</span> Insurance
          </motion.h1>

          {/* Professional Subheadline */}
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="text-lg md:text-xl text-slate-600 leading-relaxed max-w-2xl"
          >
            Say goodbye to confusing agent pitches. Aegis compares {CURATED_PLANS} curated policies across {INSURANCE_CATEGORIES} categories and explains, in plain language, which one actually fits your family.
          </motion.p>

          {/* Action CTAs */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.3 }}
            className="flex flex-col sm:flex-row gap-4 mt-2"
          >
            <button
              onClick={onScrollToForm}
              className="flex items-center justify-center gap-2 bg-gradient-to-r from-royal-600 to-royal-700 hover:from-royal-700 hover:to-royal-800 text-white font-semibold py-4 px-8 rounded-full shadow-premium hover:shadow-premium-hover transition-all duration-300 group text-[15px]"
            >
              <span>Get My Insurance Plan</span>
              <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </button>
            
            <button
              onClick={onScrollToChat}
              className="flex items-center justify-center gap-2 bg-navy-50 hover:bg-navy-100 text-navy-900 font-semibold py-4 px-8 rounded-full border border-navy-150 transition-colors text-[15px]"
            >
              <Sparkles className="w-4.5 h-4.5 text-royal-600" />
              <span>Talk with AI Advisor</span>
            </button>
          </motion.div>

          {/* Trust Metrics Row */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.6, delay: 0.4 }}
            className="grid grid-cols-2 sm:grid-cols-4 gap-6 pt-10 border-t border-slate-100 mt-4"
          >
            {PLATFORM_FACTS.map((fact, i) => (
              <div key={fact.label}>
                <h3
                  className={`text-2xl font-bold ${
                    i === PLATFORM_FACTS.length - 1 ? "text-cyan-600" : "text-navy-900"
                  }`}
                >
                  {fact.value}
                </h3>
                <p className="text-[12.5px] text-slate-500 font-medium mt-1">{fact.label}</p>
              </div>
            ))}
          </motion.div>
        </div>

        {/* Right Column: Hero Visual Asset with Floating Cards */}
        <div className="lg:col-span-5 relative flex items-center justify-center lg:justify-end">
          {/* Main Visual Container */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="relative w-full max-w-[450px] aspect-square rounded-3xl overflow-hidden shadow-2xl border-4 border-white/80 bg-slate-50"
          >
            <Image
              src="/family_protection_hero.png"
              alt="Secure Your Family's Future under premium AI-driven digital shield"
              fill
              priority
              sizes="(max-width: 768px) 100vw, 450px"
              className="object-cover"
            />
          </motion.div>

          {/* Floating UI Card 1: Shield */}
          <motion.div
            animate={{ y: [0, -10, 0] }}
            transition={{ duration: 5, repeat: Infinity, ease: "easeInOut" }}
            className="absolute top-[10%] left-[-5%] sm:left-[-12%] bg-white/90 backdrop-blur-md rounded-2xl p-4 shadow-premium border border-slate-100 flex items-center gap-3 z-20 max-w-[210px]"
          >
            <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center flex-shrink-0">
              <ShieldCheck className="w-5.5 h-5.5" />
            </div>
            <div>
              <h5 className="font-bold text-navy-900 text-xs sm:text-[13px] leading-snug">Bank-Grade Security</h5>
              <p className="text-[10px] text-slate-500 font-semibold mt-0.5">Your details stay private</p>
            </div>
          </motion.div>

          {/* Floating UI Card 2: Coverage Badge */}
          <motion.div
            animate={{ y: [0, 10, 0] }}
            transition={{ duration: 6, repeat: Infinity, ease: "easeInOut", delay: 0.5 }}
            className="absolute bottom-[10%] right-[-5%] sm:right-[-5%] bg-white/90 backdrop-blur-md rounded-2xl p-4 shadow-premium border border-slate-100 flex items-center gap-3 z-20 max-w-[210px]"
          >
            <div className="w-10 h-10 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center flex-shrink-0">
              <Heart className="w-5.5 h-5.5 fill-rose-600" />
            </div>
            <div>
              <h5 className="font-bold text-navy-900 text-xs sm:text-[13px] leading-snug">Premium Life Shield</h5>
              <p className="text-[10px] text-slate-500 font-semibold mt-0.5">₹1 Crore Protection</p>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
