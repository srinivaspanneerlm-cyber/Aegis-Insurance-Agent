"use client";

import { Shield, Cpu, Sparkles, Activity, Lock, PhoneCall } from "lucide-react";
import { useTheme } from "@/context/ThemeContext";
import { glassCardClass } from "./contactTheme";

/**
 * Support categories. `val` is the message text sent to the chat when the card
 * is clicked; `title` is the visible label.
 */
const CATEGORIES = [
  { title: "Insurance Guidance", val: "🛡 Insurance Guidance", icon: <Shield className="w-5 h-5 text-cyan-400" /> },
  { title: "Technical Support", val: "⚙ Technical Support", icon: <Cpu className="w-5 h-5 text-purple-400" /> },
  { title: "AI Recommendation Help", val: "🤖 AI Recommendation Help", icon: <Sparkles className="w-5 h-5 text-emerald-400" /> },
  { title: "Consultation Assistance", val: "📋 Consultation Assistance", icon: <Activity className="w-5 h-5 text-rose-400" /> },
  { title: "Account Support", val: "🔐 Account Support", icon: <Lock className="w-5 h-5 text-amber-400" /> },
  { title: "Platform Questions", val: "💡 Platform Questions", icon: <PhoneCall className="w-5 h-5 text-pink-400" /> },
];

/** Grid of quick-access support cards that seed a chat message on click. */
export function SupportCategories({ onQuickAccess }: { onQuickAccess: (topic: string) => void }) {
  const { theme } = useTheme();
  const glass = glassCardClass(theme);

  return (
    <section className="relative px-6 py-12 z-10">
      <div className="max-w-5xl mx-auto space-y-8 text-center">
        <div className="space-y-3">
          <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">Intelligent Service Access</span>
          <h2 className="text-3xl font-black tracking-tight text-white leading-none">Support Command Categories</h2>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 text-left">
          {CATEGORIES.map((card, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => onQuickAccess(card.val)}
              className={`p-5 rounded-[26px] border flex flex-col justify-between gap-4 text-left transition-all hover:scale-[1.02] cursor-pointer group ${glass}`}
            >
              <div className="w-9 h-9 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center group-hover:scale-110 transition-transform">
                {card.icon}
              </div>
              <div>
                <h4 className="text-[11px] font-black text-white uppercase tracking-wider leading-snug">{card.title}</h4>
                <span className="text-[8.5px] text-slate-500 font-bold uppercase tracking-wider block mt-1.5">Launch chat →</span>
              </div>
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}
