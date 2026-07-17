"use client";

import { Calculator, Search, ShieldAlert, Scale } from "lucide-react";
import type { DetailTab } from "./types";

interface DetailsTabsNavProps {
  activeTab: DetailTab;
  setActiveTab: (tab: DetailTab) => void;
}

const TABS: { id: DetailTab; label: string; icon: React.ReactNode }[] = [
  { id: "benefits", label: "Benefits & Premium Calculator", icon: <Calculator className="w-4.5 h-4.5" /> },
  { id: "network", label: "Cashless Network Finder", icon: <Search className="w-4.5 h-4.5" /> },
  { id: "exclusions", label: "Exclusions & CRO Sign-off", icon: <ShieldAlert className="w-4.5 h-4.5" /> },
  { id: "compare", label: "Interactive Compare View", icon: <Scale className="w-4.5 h-4.5" /> },
];

/** Left-hand tab selector for the policy details panels. */
export function DetailsTabsNav({ activeTab, setActiveTab }: DetailsTabsNavProps) {
  return (
    <div className="lg:col-span-1 space-y-2.5">
      {TABS.map((t) => (
        <button
          key={t.id}
          onClick={() => setActiveTab(t.id)}
          className={`w-full p-4 rounded-2xl flex items-center gap-3.5 text-xs font-black uppercase tracking-widest border transition-all text-left cursor-pointer active:scale-98 ${
            activeTab === t.id
              ? "bg-cyan-500/10 border-cyan-500/35 text-cyan-400 shadow-[0_0_15px_rgba(6,182,212,0.1)]"
              : "bg-slate-900/40 border-white/5 text-slate-400 hover:bg-white/[0.02] hover:text-white"
          }`}
        >
          {t.icon}
          <span>{t.label}</span>
        </button>
      ))}
    </div>
  );
}
