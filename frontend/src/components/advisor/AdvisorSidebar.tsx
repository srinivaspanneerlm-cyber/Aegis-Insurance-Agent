"use client";
import React from "react";
import { Activity, RefreshCw } from "lucide-react";
import { ADVISORS, type AdvisorKey } from "@/lib/advisors";

export interface SidebarAdvisor {
  id: AdvisorKey;
  icon: React.ReactNode;
  label: string;
  sub: string;
}

interface AdvisorSidebarProps {
  sidebarAdvisors: SidebarAdvisor[];
  activeCategory: AdvisorKey;
  setActiveCategory: (key: AdvisorKey) => void;
  handleNewChat: () => void;
  isStreaming: boolean;
  activeHandshakes: number;
}

export default function AdvisorSidebar({
  sidebarAdvisors,
  activeCategory,
  setActiveCategory,
  handleNewChat,
  isStreaming,
  activeHandshakes,
}: AdvisorSidebarProps) {
  return (
        <div className="w-[260px] flex-shrink-0 h-full overflow-hidden hidden lg:flex flex-col gap-4 select-none">
          <div className="p-4 rounded-3xl border border-white/5 bg-slate-900/60 backdrop-blur-2xl shadow-[inset_0_1px_1px_rgba(255,255,255,0.05),0_10px_30px_rgba(0,0,0,0.3)] flex flex-col h-full overflow-hidden">

            <div className="flex items-center justify-between mb-4">
              <p className="text-[9.5px] font-black uppercase tracking-widest text-slate-500">ACTIVE CHANNELS</p>
              <span className="text-[8px] font-mono px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">STABLE</span>
            </div>

            <div className="flex flex-col gap-1.5 overflow-y-auto pr-1 flex-grow" style={{ scrollbarWidth: "none" }}>
              {sidebarAdvisors.map((a) => {
                const isActive = activeCategory === a.id;
                const adv = ADVISORS[a.id];
                return (
                  <button
                    key={a.id}
                    onClick={() => setActiveCategory(a.id)}
                    className={`flex items-center gap-3 px-3.5 py-3 rounded-2xl border text-left transition-all duration-200 cursor-pointer group active:scale-95 touch-manipulation select-none relative overflow-hidden ${
                      isActive
                        ? adv.activeTab + " shadow-[0_0_20px_rgba(244,63,94,0.06)]"
                        : "bg-transparent border-transparent hover:bg-white/[0.03] text-slate-400 hover:text-white"
                    }`}
                  >
                    <span className="absolute inset-0 bg-gradient-to-r from-white/[0.01] to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                    <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-slate-900 to-slate-800 text-white text-xs font-black flex items-center justify-center flex-shrink-0 border border-white/10 group-hover:scale-105 transition-transform">
                      {a.icon}
                    </div>
                    <div className="min-w-0 flex-grow">
                      <p className="text-[12px] font-black leading-none">{a.label}</p>
                      <p className="text-[9px] font-medium mt-1 leading-none text-slate-500">{a.sub}</p>
                    </div>
                    {isActive && (
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 flex-shrink-0 relative">
                        <span className="animate-ping absolute inset-0 rounded-full bg-emerald-400 opacity-75 scale-150" />
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            <div className="mt-4 pt-4 border-t border-white/5 space-y-3.5">
              {/* New Chat button */}
              <button
                onClick={handleNewChat}
                disabled={isStreaming}
                className="w-full flex items-center justify-center gap-2 px-3 py-2.5 rounded-2xl border border-white/8 bg-white/[0.03] text-slate-400 hover:text-white hover:bg-white/[0.06] hover:border-white/15 active:scale-95 touch-manipulation select-none transition-all duration-200 cursor-pointer disabled:opacity-40 text-[10px] font-black uppercase tracking-wider"
              >
                <RefreshCw className="w-3 h-3" />
                New Chat
              </button>
              <div className="space-y-1.5">
                <span className="text-[8.5px] font-black text-slate-500 uppercase tracking-widest">ACTIVE SOCKET HANDSHAKES</span>
                <p className="font-mono text-xs font-black text-slate-300 flex items-center gap-1.5">
                  <Activity className="w-3.5 h-3.5 text-purple-400 animate-pulse" />
                  <span>{activeHandshakes} NODES LINKED</span>
                </p>
              </div>
              <div className="p-3 bg-white/[0.02] border border-white/5 rounded-2xl text-[10px] leading-relaxed text-slate-500">
                All intake data compiled directly in secure sandbox vaults compliant with executive mandates.
              </div>
            </div>
          </div>
        </div>
  );
}
