"use client";

import { ShieldCheck, Users, Clock, Cpu, Shield } from "lucide-react";
import { motion } from "framer-motion";
import { glassCardClass } from "./contactTheme";

/** Trust / communication-protocol pillars shown near the page footer. */
const PILLARS = [
  { title: "Executive AI Assistance", desc: "Speak directly with the primary operations brain monitoring network metrics.", icon: <Users className="w-5 h-5 text-cyan-400" /> },
  { title: "24/7 Intelligent Support", desc: "Fallback controllers respond continuously under 45ms even in offline periods.", icon: <Clock className="w-5 h-5 text-purple-400" /> },
  { title: "AI-Powered Guidance", desc: "No complex ticketing codes. Conversational matching handles queries naturally.", icon: <Cpu className="w-5 h-5 text-emerald-400" /> },
  { title: "Private conversation", desc: "Communications are compiled directly in authenticated vault directories.", icon: <Shield className="w-5 h-5 text-rose-400" /> },
];

/** "How the advisor talks to you" trust-seal grid. */
export function TrustPillars() {
  const glass = glassCardClass;

  return (
    <section className="relative px-6 py-12 z-10">
      <div className="max-w-5xl mx-auto space-y-10 text-center">
        <div className="space-y-3">
          <span className="inline-flex items-center gap-1.5 text-purple-400 bg-purple-950/30 border border-purple-800/40 py-1.5 px-4 rounded-full text-xs font-bold uppercase tracking-widest">
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>Executive Trust Seals</span>
          </span>
          <h2 className="text-3xl font-black tracking-tight text-white leading-none">How the advisor talks to you</h2>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 text-left">
          {PILLARS.map((trust, idx) => (
            <motion.div
              key={idx}
              whileHover={{ y: -6 }}
              className={`p-6 rounded-[28px] border flex flex-col justify-between transition-all relative overflow-hidden group ${glass}`}
            >
              <div className="absolute -right-8 -top-8 w-20 h-20 rounded-full bg-white/5 blur-xl group-hover:scale-125 transition-transform" />
              <div className="space-y-4 relative z-10">
                <div className="w-10 h-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center group-hover:scale-110 transition-transform">
                  {trust.icon}
                </div>
                <h4 className="text-xs font-black text-white uppercase tracking-wider leading-snug">{trust.title}</h4>
                <p className="text-[11px] text-slate-400 leading-normal font-semibold">{trust.desc}</p>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
