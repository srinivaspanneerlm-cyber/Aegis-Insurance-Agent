"use client";

import Link from "next/link";
import { 
  Sparkles, Heart, Car, Plane, Home as HomeIcon, 
  ArrowLeft, ArrowRight, ShieldCheck, ShieldAlert 
} from "lucide-react";
import { motion } from "framer-motion";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";

export default function PoliciesPage() {
  const specializedAdvisors = [
    {
      name: "Alex AI",
      role: "Senior Asset Protection Engine",
      category: "Motor Insurance",
      desc: "Underwrites smart vehicle shields, zero depreciation limits, roadside hazard recoveries, and custom garage network clearances.",
      icon: <Car className="w-7 h-7 text-cyan-400" />,
      bot: "Alex",
      metrics: "98.8% Settlement Rate",
      parameters: ["Vehicle Age & Model", "Mileage Index", "Roadside Recovery Level", "Primary Usage Profile"],
      color: "from-blue-600/10 to-cyan-500/10 hover:border-cyan-400/40 text-cyan-300 shadow-[0_0_20px_rgba(6,182,212,0.03)]"
    },
    {
      name: "Sarah AI",
      role: "Lead Family Welfare Advisor",
      category: "Health Insurance",
      desc: "Compiles premium medical coverage layers, custom family safety multipliers, cashless beds access, and zero co-pay rules.",
      icon: <Heart className="w-7 h-7 text-purple-400" />,
      bot: "Sarah",
      metrics: "99.2% Settlement Rate",
      parameters: ["Household Size & Ages", "Critical Care Options", "Room-Rent Limits", "Pre-Existing Disclosures"],
      color: "from-purple-650/10 to-indigo-500/10 hover:border-purple-400/40 text-purple-300 shadow-[0_0_20px_rgba(168,85,247,0.03)]"
    },
    {
      name: "Ethan AI",
      role: "Global Mobility & Safe Passage Engine",
      category: "Travel Insurance",
      desc: "Verifies worldwide mobility hazards, evacuation coordinates, baggage disruptions, and adventure sports underwriting.",
      icon: <Plane className="w-7 h-7 text-rose-400" />,
      bot: "Ethan",
      metrics: "99.6% Settlement Rate",
      parameters: ["Destination Coordinates", "Itinerary Duration", "Adventure Sports Cover", "Air Evacuation Class"],
      color: "from-rose-600/10 to-amber-500/10 hover:border-rose-400/40 text-rose-300 shadow-[0_0_20px_rgba(244,63,94,0.03)]"
    },
    {
      name: "Emma AI",
      role: "Real Estate Protection Specialist",
      category: "Property Insurance",
      desc: "Safeguards structural holdings, fire reconstruction limits, interior valuable contents, and temporary relocation credits.",
      icon: <HomeIcon className="w-7 h-7 text-emerald-400" />,
      bot: "Emma",
      metrics: "99.0% Settlement Rate",
      parameters: ["Structural Dimensions", "Construction Age", "Content Valuation", "Location Hazard Index"],
      color: "from-emerald-600/10 to-teal-500/10 hover:border-emerald-400/40 text-emerald-300 shadow-[0_0_20px_rgba(16,185,129,0.03)]"
    }
  ];

  return (
    <div className="min-h-screen bg-slate-950 text-white relative flex flex-col justify-between overflow-hidden">
      <Navbar />

      {/* Cyber ambient backgrounds & grid meshes */}
      <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(ellipse_80%_80%_at_50%_-20%,rgba(120,119,198,0.12),rgba(255,255,255,0))]" />
      <div className="absolute top-[20%] left-[-10%] w-[50%] h-[50%] rounded-full bg-cyan-500/5 blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[10%] right-[-10%] w-[45%] h-[45%] rounded-full bg-purple-650/5 blur-[120px] pointer-events-none" />

      {/* Main Section */}
      <section className="relative pt-32 pb-24 z-10 flex-grow">
        <div className="max-w-7xl mx-auto px-6 space-y-16">
          
          {/* Header */}
          <div className="text-center space-y-4 max-w-3xl mx-auto">
            <div className="flex items-center justify-center gap-2 mb-2">
              <Link
                href="/"
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-400 hover:text-white transition-colors"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Back to Operations</span>
              </Link>
            </div>

            <span className="inline-flex items-center gap-1.5 text-cyan-400 bg-cyan-950/30 border border-cyan-800/40 py-1.5 px-4 rounded-full text-xs font-bold uppercase tracking-widest">
              <ShieldCheck className="w-3.5 h-3.5 stroke-[2.2] animate-pulse" />
              <span>Sovereign Risk Underwriting Gates</span>
            </span>

            <h1 className="text-3xl sm:text-5xl font-black tracking-tight leading-none text-white">
              Dynamic Underwriting Vaults
            </h1>
            <p className="text-slate-400 text-xs sm:text-sm leading-relaxed max-w-xl mx-auto">
              At Aegis, plans are not static, pre-packaged commodity sheets. Every safety net is dynamically compiled, underwritten, and verified in private console sessions with our specialized AI officers.
            </p>
          </div>

          {/* Premium Informational Alert */}
          <div className="max-w-4xl mx-auto p-6 rounded-[24px] border border-cyan-800/30 bg-cyan-950/20 flex flex-col md:flex-row items-center gap-5 text-left shadow-lg">
            <div className="w-12 h-12 rounded-2xl bg-cyan-950 flex items-center justify-center border border-cyan-800/50 flex-shrink-0">
              <Sparkles className="w-6 h-6 text-cyan-400 animate-spin-slow" />
            </div>
            <div className="space-y-1">
              <h3 className="text-sm font-black uppercase tracking-wider text-cyan-300">How to Unlock Packages</h3>
              <p className="text-xs text-slate-300 leading-relaxed">
                Choose the specialized underwriter corresponding to your protection needs. Answer their conversational intake questions regarding your household and comfort boundaries. Once complete, your custom holographic package card will be compiled and revealed dynamically inside your session.
              </p>
            </div>
          </div>

          {/* Specialized Underwriters Console */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-5xl mx-auto">
            {specializedAdvisors.map((adv, idx) => (
              <motion.div
                key={idx}
                whileHover={{ y: -6 }}
                className={`p-8 rounded-[32px] border bg-slate-900/40 border-white/5 flex flex-col justify-between text-left transition-all relative overflow-hidden group ${adv.color}`}
              >
                {/* Visual Accent */}
                <div className="absolute -right-12 -top-12 w-28 h-28 rounded-full bg-white/5 blur-xl group-hover:scale-125 transition-transform" />

                <div className="space-y-6 relative z-10">
                  <div className="flex items-center justify-between">
                    <div className="w-14 h-14 rounded-2xl bg-white/5 flex items-center justify-center border border-white/10 group-hover:scale-110 transition-transform">
                      {adv.icon}
                    </div>
                    <span className="text-[10px] font-black uppercase tracking-wider bg-emerald-500/10 text-emerald-400 py-1 px-3.5 rounded-full border border-emerald-500/20 shadow-inner flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                      <span>{adv.metrics}</span>
                    </span>
                  </div>

                  <div>
                    <span className="text-[9px] font-black uppercase tracking-wider text-slate-500">Underwriter Category</span>
                    <h2 className="text-2xl font-black text-white mt-0.5">{adv.category}</h2>
                    <p className="text-[11px] text-slate-400 font-bold uppercase tracking-wider mt-1">{adv.name} — {adv.role}</p>
                  </div>

                  <p className="text-slate-300 text-xs sm:text-sm leading-relaxed font-semibold">
                    {adv.desc}
                  </p>

                  <div className="space-y-2.5 pt-4 border-t border-white/5">
                    <span className="text-[9px] font-black uppercase tracking-wider text-slate-500 block">Required Calibration Metrics</span>
                    <div className="grid grid-cols-2 gap-2">
                      {adv.parameters.map((p, pIdx) => (
                        <div key={pIdx} className="flex items-center gap-2 text-[10px] text-slate-300 font-bold">
                          <div className="w-1.5 h-1.5 rounded-full bg-cyan-400/80" />
                          <span>{p}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="pt-8 relative z-10">
                  <Link
                    href={`/advisor?bot=${encodeURIComponent(adv.bot)}`}
                    className="w-full py-4 rounded-2xl font-black text-xs uppercase tracking-widest bg-white text-slate-950 hover:bg-slate-100 flex items-center justify-center gap-2 transition-all cursor-pointer shadow-lg"
                  >
                    <span>Talk with Underwriter</span>
                    <ArrowRight className="w-4.5 h-4.5" />
                  </Link>
                </div>
              </motion.div>
            ))}
          </div>

          {/* Compliance Disclaimer */}
          <div className="flex items-center justify-center gap-2 max-w-md mx-auto text-[10px] text-slate-500 font-black uppercase tracking-wider pt-6">
            <ShieldAlert className="w-4 h-4 text-slate-500" />
            <span>Sovereign underwriting verified & IRDAI registered. Security logs active.</span>
          </div>

        </div>
      </section>

      <Footer />
    </div>
  );
}
