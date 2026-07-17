"use client";

import { Calculator, CheckCircle, Zap, ChevronRight } from "lucide-react";
import type { PlanDetails } from "./types";

interface Rider {
  id: string;
  label: string;
  cost: number;
}

interface BenefitsTabProps {
  plan: PlanDetails;
  selectedRiders: Rider[];
  activeRiderIds: string[];
  toggleRider: (id: string) => void;
  basePremium: number;
  gst: number;
  totalPremium: number;
  onProceed: () => void;
}

/** Tab 1 — included benefits, domain-specific metrics, and premium calculator. */
export function BenefitsTab({
  plan, selectedRiders, activeRiderIds, toggleRider, basePremium, gst, totalPremium, onProceed,
}: BenefitsTabProps) {
  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-xl font-black text-white flex items-center gap-2">
          <Calculator className="w-5 h-5 text-cyan-400 animate-pulse" />
          <span>Interactive Coverage Configurator</span>
        </h2>
        <p className="text-xs text-slate-400 font-semibold mt-1">
          Review standard coverage benefits and select optional riders to calculate your premium rate under 18% GST regulations.
        </p>
      </div>

      {/* Benefits Section */}
      <div className="space-y-3">
        <h3 className="text-xs font-black uppercase tracking-wider text-slate-500">Included Underwriter Benefits</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {plan.benefits.map((b, i) => (
            <div key={i} className="flex items-start gap-2.5 p-3 rounded-2xl bg-slate-900/60 border border-white/5 text-xs text-slate-200">
              <CheckCircle className="w-4 h-4 text-cyan-400 mt-0.5 flex-shrink-0" />
              <span className="font-semibold leading-relaxed">{b}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Category Specific Metrics in Details Tab */}
      {plan.category && plan.category !== "health" && (
        <div className="p-5 rounded-3xl bg-slate-950/60 border border-white/5 space-y-4 text-left">
          <h3 className="text-xs font-black uppercase tracking-wider text-cyan-400">Domain-Specific Parameters</h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 text-xs font-semibold text-slate-350">
            {plan.category === "motor" && (
              <>
                <div>
                  <p className="text-[9px] text-slate-500 uppercase font-black">Insured Declared Value (IDV)</p>
                  <p className="text-white font-mono mt-0.5">{plan.idvValue || "₹8,50,000"}</p>
                </div>
                <div>
                  <p className="text-[9px] text-slate-500 uppercase font-black">Own Damage Cover</p>
                  <p className="text-white mt-0.5">{plan.ownDamageCover || "₹12,500/year"}</p>
                </div>
                <div>
                  <p className="text-[9px] text-slate-500 uppercase font-black">Third Party Cover</p>
                  <p className="text-white mt-0.5">{plan.thirdPartyCover || "₹3,500/year"}</p>
                </div>
              </>
            )}
            {plan.category === "travel" && (
              <>
                <div>
                  <p className="text-[9px] text-slate-500 uppercase font-black">Destination</p>
                  <p className="text-white mt-0.5">{plan.destination || "International"}</p>
                </div>
                <div>
                  <p className="text-[9px] text-slate-500 uppercase font-black">Medical Coverage</p>
                  <p className="text-white font-mono mt-0.5">{plan.medicalCoverage || "$100,000"}</p>
                </div>
                <div>
                  <p className="text-[9px] text-slate-500 uppercase font-black">Emergency Evacuation</p>
                  <p className="text-white font-mono mt-0.5">{plan.emergencyEvacuation || "$50,000"}</p>
                </div>
              </>
            )}
            {plan.category === "property" && (
              <>
                <div>
                  <p className="text-[9px] text-slate-500 uppercase font-black">Property Coverage</p>
                  <p className="text-white font-mono mt-0.5">{plan.propertyCoverage || "₹50,00,000"}</p>
                </div>
                <div>
                  <p className="text-[9px] text-slate-500 uppercase font-black">Structure Cover</p>
                  <p className="text-white font-mono mt-0.5">{plan.structureCover || "₹80 Lakhs"}</p>
                </div>
                <div>
                  <p className="text-[9px] text-slate-500 uppercase font-black">Contents Cover</p>
                  <p className="text-white font-mono mt-0.5">{plan.contentsCover || "₹20 Lakhs"}</p>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Interactive Premium Calculator */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4 border-t border-white/5">

        {/* Rider selection */}
        <div className="space-y-3">
          <h3 className="text-xs font-black uppercase tracking-wider text-slate-500">Customize Policy Riders</h3>
          <div className="space-y-2.5">
            {selectedRiders.map((rider) => {
              const isActive = activeRiderIds.includes(rider.id);
              return (
                <button
                  key={rider.id}
                  onClick={() => toggleRider(rider.id)}
                  className={`w-full p-4 rounded-2xl border transition-all duration-200 flex items-center justify-between text-left cursor-pointer ${
                    isActive
                      ? "bg-cyan-500/10 border-cyan-500/35 text-white"
                      : "bg-slate-900/40 border-white/5 text-slate-400 hover:bg-slate-900/60"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-5 h-5 rounded-lg border flex items-center justify-center transition-colors ${
                      isActive ? "bg-cyan-500 border-cyan-500 text-slate-950" : "border-slate-600"
                    }`}>
                      {isActive && <CheckCircle className="w-3.5 h-3.5 text-slate-950" />}
                    </div>
                    <span className="text-xs font-bold">{rider.label}</span>
                  </div>
                  <span className="text-xs font-black font-mono text-cyan-400">+₹{rider.cost}/mo</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Interactive Premium Projection Screen */}
        <div className="p-5 rounded-3xl bg-slate-950/80 border-2 border-cyan-500/20 text-left flex flex-col justify-between shadow-2xl relative overflow-hidden">
          {/* Inner grid glow */}
          <div className="absolute top-0 right-0 w-24 h-24 rounded-full bg-cyan-400/5 blur-xl pointer-events-none" />
          <div className="space-y-4">
            <h4 className="text-[10px] font-black uppercase tracking-widest text-cyan-400 flex items-center gap-1">
              <Zap className="w-3.5 h-3.5 animate-bounce" />
              <span>Live Pricing Engine</span>
            </h4>
            <div className="space-y-2.5 text-xs text-slate-400 font-semibold border-b border-white/5 pb-3">
              <div className="flex justify-between">
                <span>Base Plan Premium</span>
                <span className="font-mono text-white">₹{basePremium}/mo</span>
              </div>
              {selectedRiders.filter((r) => activeRiderIds.includes(r.id)).map((r) => (
                <div key={r.id} className="flex justify-between text-cyan-300">
                  <span>+ {r.label}</span>
                  <span className="font-mono">₹{r.cost}/mo</span>
                </div>
              ))}
              <div className="flex justify-between">
                <span>GST (18% Regulation)</span>
                <span className="font-mono text-white">₹{gst}/mo</span>
              </div>
            </div>
            <div className="flex justify-between items-baseline pt-2">
              <span className="text-xs font-black uppercase tracking-wider text-slate-400">Total Premium</span>
              <span className="text-2xl font-black text-cyan-400 font-mono">₹{totalPremium}/month</span>
            </div>
          </div>

          <button
            onClick={onProceed}
            className="w-full mt-5 py-3 rounded-xl font-black text-xs uppercase tracking-widest bg-cyan-400 text-slate-950 hover:bg-cyan-350 transition-all flex items-center justify-center gap-1.5 active:scale-95 cursor-pointer shadow-[0_5px_15px_rgba(6,182,212,0.2)]"
          >
            <span>Lock This Price</span>
            <ChevronRight className="w-4.5 h-4.5" />
          </button>
        </div>
      </div>
    </div>
  );
}
