"use client";

import { Sparkles, ShieldCheck } from "lucide-react";
import { motion } from "framer-motion";
import { glassCardClass } from "./aboutTheme";

/** Side-by-side Vision and Mission cards. Anchor target for the hero CTA. */
export function VisionMissionSection() {
  const glass = glassCardClass;

  return (
    <section id="vision" className="relative px-6 py-16 z-10">
      <div className="max-w-5xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-8">

        {/* VISION CARD */}
        <motion.div
          whileHover={{ y: -6 }}
          className={`p-8 rounded-[32px] border flex flex-col justify-between text-left relative overflow-hidden group ${glass}`}
        >
          <div className="absolute -right-12 -top-12 w-28 h-28 rounded-full bg-purple-500/5 blur-xl group-hover:scale-125 transition-transform" />
          <div className="space-y-5">
            <div className="w-12 h-12 rounded-2xl bg-purple-500/10 flex items-center justify-center border border-purple-500/20 text-purple-400">
              <Sparkles className="w-6 h-6 animate-pulse" />
            </div>
            <h2 className="text-2xl font-black text-white">Our Vision</h2>
            <p className="text-sm font-semibold leading-relaxed">
              To revolutionize the insurance industry through intelligent AI consultation, conversational automation, and personalized protection experiences for everyone.
            </p>
          </div>
          <div className="pt-6 flex items-center gap-2 text-[10px] font-black uppercase tracking-wider text-purple-400">
            <span className="w-2 h-2 rounded-full bg-purple-400 animate-ping" />
            <span>Our Guiding Principle</span>
          </div>
        </motion.div>

        {/* MISSION CARD */}
        <motion.div
          whileHover={{ y: -6 }}
          className={`p-8 rounded-[32px] border flex flex-col justify-between text-left relative overflow-hidden group ${glass}`}
        >
          <div className="absolute -right-12 -top-12 w-28 h-28 rounded-full bg-cyan-500/5 blur-xl group-hover:scale-125 transition-transform" />
          <div className="space-y-5">
            <div className="w-12 h-12 rounded-2xl bg-cyan-500/10 flex items-center justify-center border border-cyan-500/20 text-cyan-400">
              <ShieldCheck className="w-6 h-6 animate-pulse" />
            </div>
            <h2 className="text-2xl font-black text-white">Our Mission</h2>
            <p className="text-sm font-semibold leading-relaxed">
              To make insurance simple, accessible, trustworthy, and AI-driven through conversational AI technology and intelligent automation workflows.
            </p>
          </div>
          <div className="pt-6 flex items-center gap-2 text-[10px] font-black uppercase tracking-wider text-cyan-400">
            <span className="w-2 h-2 rounded-full bg-cyan-400 animate-ping" />
            <span>Direct Encrypted Vaults</span>
          </div>
        </motion.div>

      </div>
    </section>
  );
}
