"use client";

import { Check } from "lucide-react";
import { useTheme } from "@/context/ThemeContext";
import { glassCardClass } from "./aboutTheme";

/** Three differentiators explaining why Aegis AI exists. */
const REASONS = [
  { title: "No Form Fatigue", desc: "No more filling out hundreds of tedious checkboxes. Conversational intake matches details seamlessly." },
  { title: "Zero Cold Calls", desc: "Consult in a private, encrypted digital vault. No agents will ever cold call or bother you." },
  { title: "Dynamic Underwriting", desc: "Pricing is mathematically underwritten in real-time based on real actuarial telemetry indices." },
];

/** "Why Aegis AI Exists" purpose section. */
export function WhyAegisSection() {
  const { theme } = useTheme();
  const glass = glassCardClass(theme);

  return (
    <section className="relative px-6 py-12 z-10">
      <div className="max-w-4xl mx-auto space-y-8 text-center">
        <div className="space-y-3">
          <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">The Startup Core Purpose</span>
          <h2 className="text-3xl font-black tracking-tight leading-none text-white">Why Aegis AI Exists</h2>
        </div>

        <p className={`text-sm sm:text-base leading-relaxed font-semibold max-w-2xl mx-auto ${theme === "dark" ? "text-slate-400" : "text-slate-600"}`}>
          Traditional insurance systems are often confusing, slow, and form-heavy. Aegis AI transforms the experience through intelligent AI conversations that guide users naturally toward the right protection solutions.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 pt-4 text-left">
          {REASONS.map((item, idx) => (
            <div key={idx} className={`p-6 rounded-2xl border ${glass} space-y-3`}>
              <div className="w-8 h-8 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center text-cyan-400">
                <Check className="w-4 h-4 stroke-[3]" />
              </div>
              <h4 className="text-xs font-black text-white uppercase tracking-wider">{item.title}</h4>
              <p className="text-[11px] text-slate-400 leading-normal font-semibold">{item.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
