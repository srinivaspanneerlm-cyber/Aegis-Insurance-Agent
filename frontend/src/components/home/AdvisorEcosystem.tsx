"use client";

import Link from "next/link";
import { Sparkles, ArrowRight, Car, Heart, Plane, Home as HomeIcon } from "lucide-react";
import { motion } from "framer-motion";

/** The four specialized domain advisors surfaced on the landing page. */
const ADVISORS = [
  {
    name: "Alex AI",
    role: "Senior Asset Protection Engine",
    desc: "Specializes in vehicle valuation calculations, zero-depreciation matrices, and instant roadside recovery clearances.",
    icon: <Car className="w-6 h-6 text-cyan-400" />,
    bot: "Alex",
    color: "from-blue-600/20 to-cyan-500/20 hover:border-cyan-400/40 text-cyan-300 shadow-[0_0_20px_rgba(6,182,212,0.05)]",
    telemetry: ["Zero-Dep Calculation", "Instant Garage Clearance", "Reset your password"],
  },
  {
    name: "Sarah AI",
    role: "Lead Family Welfare Advisor",
    desc: "Focuses on growing family protection layers, zero co-pay medical underwriting, and cashless corporate beds allocation.",
    icon: <Heart className="w-6 h-6 text-purple-400" />,
    bot: "Sarah",
    color: "from-purple-650/20 to-indigo-500/20 hover:border-purple-400/40 text-purple-300 shadow-[0_0_20px_rgba(168,85,247,0.05)]",
    telemetry: ["No Room-Rent Caps", "Pre-Existing Coverages", "Restoration Underwriting"],
  },
  {
    name: "Ethan AI",
    role: "Global Mobility & Safe Passage Engine",
    desc: "Expert on international evacuation logistics, worldwide travel coordinate security, and trip disruption settlements.",
    icon: <Plane className="w-6 h-6 text-rose-400" />,
    bot: "Ethan",
    color: "from-rose-600/20 to-amber-500/20 hover:border-rose-400/40 text-rose-300 shadow-[0_0_20px_rgba(244,63,94,0.05)]",
    telemetry: ["Global Evacuation Lift", "Itinerary Delay Settlements", "Baggage Delay Coverage"],
  },
  {
    name: "Emma AI",
    role: "Real Estate Protection Specialist",
    desc: "Secures your private holdings and corporate physical assets against structural hazards, fire losses, and relocation needs.",
    icon: <HomeIcon className="w-6 h-6 text-emerald-400" />,
    bot: "Emma",
    color: "from-emerald-600/20 to-teal-500/20 hover:border-emerald-400/40 text-emerald-300 shadow-[0_0_20px_rgba(16,185,129,0.05)]",
    telemetry: ["Fire Re-construction Cost", "Cover for your belongings", "Temporary Relocation Limits"],
  },
];

/** "Consult with Specialized AI Advisors" ecosystem card grid. */
export function AdvisorEcosystem() {
  return (
    <section className="relative px-6 py-16 z-10">
      <div className="max-w-7xl mx-auto space-y-12 text-center">

        <div className="space-y-4 max-w-2xl mx-auto">
          <span className="inline-flex items-center gap-1.5 text-cyan-400 bg-cyan-950/30 border border-cyan-800/40 py-1.5 px-4 rounded-full text-xs font-bold uppercase tracking-widest">
            <Sparkles className="w-3.5 h-3.5 animate-spin-slow" />
            <span>Your Specialist AI Advisors</span>
          </span>
          <h2 className="text-3xl sm:text-5xl font-black tracking-tight leading-none text-white">
            Consult with Specialized AI Advisors
          </h2>
          <p className="text-slate-400 text-xs sm:text-sm leading-relaxed">
            Plans at Aegis aren&apos;t one-size-fits-all sheets. Each one is tailored to your needs as you chat. Connect with a specialist AI advisor to start.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {ADVISORS.map((adv, idx) => (
            <motion.div
              key={idx}
              whileHover={{ y: -8 }}
              className={`p-6 rounded-[28px] border bg-slate-900/60 border-white/5 flex flex-col justify-between text-left transition-all relative overflow-hidden group ${adv.color}`}
            >
              {/* Background glowing orb */}
              <div className="absolute -right-10 -top-10 w-24 h-24 rounded-full bg-white/5 blur-xl group-hover:scale-125 transition-transform" />

              <div className="space-y-4 relative z-10">
                <div className="flex items-center justify-between">
                  <div className="w-12 h-12 rounded-2xl bg-white/5 flex items-center justify-center border border-white/10 group-hover:scale-110 transition-transform">
                    {adv.icon}
                  </div>
                  <span className="inline-flex items-center gap-1 text-[9px] font-black uppercase tracking-wider bg-emerald-500/10 text-emerald-400 py-1 px-2.5 rounded-full border border-emerald-500/20">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    <span>Online</span>
                  </span>
                </div>

                <div>
                  <h3 className="text-xl font-black text-white">{adv.name}</h3>
                  <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">
                    {adv.role}
                  </span>
                </div>

                <p className="text-slate-400 text-xs leading-relaxed font-semibold">
                  {adv.desc}
                </p>

                <div className="space-y-1.5 pt-2 border-t border-white/5">
                  <span className="text-[9px] font-black uppercase tracking-wider text-slate-500">Focus Areas</span>
                  <div className="flex flex-wrap gap-1.5">
                    {adv.telemetry.map((t, tIdx) => (
                      <span key={tIdx} className="text-[8.5px] font-black uppercase tracking-wide bg-white/5 text-slate-300 py-0.5 px-2 rounded-md">
                        {t}
                      </span>
                    ))}
                  </div>
                </div>
              </div>

              <div className="pt-6 relative z-10">
                <Link
                  href={`/advisor?bot=${encodeURIComponent(adv.bot)}`}
                  className="w-full py-3.5 rounded-2xl font-black text-xs uppercase tracking-widest bg-white text-slate-950 hover:bg-slate-100 flex items-center justify-center gap-2 transition-all cursor-pointer shadow-lg"
                >
                  <span>Talk to an advisor</span>
                  <ArrowRight className="w-4 h-4" />
                </Link>
              </div>
            </motion.div>
          ))}
        </div>

      </div>
    </section>
  );
}
