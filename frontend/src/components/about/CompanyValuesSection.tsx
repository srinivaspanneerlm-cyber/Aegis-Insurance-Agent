"use client";

import { Sparkles, ShieldCheck, Shield, Award, Cpu, Users, Heart } from "lucide-react";
import { motion } from "framer-motion";
import { glassCardClass } from "./aboutTheme";

/** Core operating values rendered as a responsive card grid. */
const VALUES = [
  { title: "Innovation", desc: "Constantly engineering state-of-the-art conversational pipelines and high-fidelity protection visualizers.", icon: <Sparkles className="w-5 h-5 text-cyan-400" /> },
  { title: "Trust", desc: "Every consulting session is completely encrypted inside your private browser session vault.", icon: <Shield className="w-5 h-5 text-purple-400" /> },
  { title: "Accessibility", desc: "No complex forms or tedious requirements. Speak, chat, and access protection seamlessly.", icon: <Users className="w-5 h-5 text-emerald-400" /> },
  { title: "AI Automation", desc: "Zero agent cold calls. Calculations are underwritten dynamically by deep statistical engine models.", icon: <Cpu className="w-5 h-5 text-rose-400" /> },
  { title: "Human-Centered", desc: "Designed around emotional intelligence and empathetic, trust-building user experiences.", icon: <Heart className="w-5 h-5 text-pink-400" /> },
  { title: "Intelligent Protection", desc: "Dynamic recommendations lock in exactly what you need, shielding asset boundaries perfectly.", icon: <Award className="w-5 h-5 text-amber-400" /> },
];

/** "Core Operating Values" grid section. */
export function CompanyValuesSection() {
  const glass = glassCardClass;

  return (
    <section className="relative px-6 py-16 z-10">
      <div className="max-w-5xl mx-auto space-y-12 text-center">
        <div className="space-y-3">
          <span className="inline-flex items-center gap-1.5 text-cyan-400 bg-cyan-950/30 border border-cyan-800/40 py-1.5 px-4 rounded-full text-xs font-bold uppercase tracking-widest">
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>What We Stand For</span>
          </span>
          <h2 className="text-3xl font-black tracking-tight text-white leading-none">Core Operating Values</h2>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {VALUES.map((v, idx) => (
            <motion.div
              key={idx}
              whileHover={{ y: -6 }}
              className={`p-6 rounded-[28px] border text-left flex flex-col justify-between transition-all relative overflow-hidden group ${glass}`}
            >
              <div className="absolute -right-8 -top-8 w-20 h-20 rounded-full bg-white/5 blur-xl group-hover:scale-125 transition-transform" />
              <div className="space-y-4 relative z-10">
                <div className="w-10 h-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center group-hover:scale-110 transition-transform">
                  {v.icon}
                </div>
                <h4 className="text-sm font-black text-white uppercase tracking-wider">{v.title}</h4>
                <p className="text-[11px] text-slate-400 leading-normal font-semibold">{v.desc}</p>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
