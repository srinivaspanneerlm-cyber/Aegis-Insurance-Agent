"use client";
import React from "react";
import Link from "next/link";
import { Cpu, Lock, ChevronLeft, X } from "lucide-react";
import EnvironmentBadge from "@/components/EnvironmentBadge";
import type { Advisor } from "@/lib/advisors";

interface AdvisorHeaderProps {
  advisor: Advisor;
  isStreaming: boolean;
  streamAgentName: string;
  streamAgentDomain: string;
  streamPhase: string;
  envResponseTimeMs?: number;
  pingSpeed: string | number;
}

export default function AdvisorHeader({
  advisor,
  isStreaming,
  streamAgentName,
  streamAgentDomain,
  streamPhase,
  envResponseTimeMs,
  pingSpeed,
}: AdvisorHeaderProps) {
  return (
      <header className="h-16 border-b border-white/5 bg-slate-900/40 backdrop-blur-2xl px-6 flex items-center justify-between z-40 relative pointer-events-auto flex-shrink-0">
        <div className="flex items-center gap-4">
          <Link
            href="/consumer-dashboard"
            className="p-2.5 rounded-xl border border-white/10 bg-white/5 text-slate-400 hover:text-white hover:bg-white/10 active:scale-95 touch-manipulation select-none transition-all flex items-center justify-center cursor-pointer"
          >
            <ChevronLeft className="w-4 h-4" />
            <span className="text-[10px] font-black uppercase tracking-wider pl-1 pr-1.5 hidden sm:inline">Portal</span>
          </Link>

          <div className="flex items-center gap-3">
            <div className={`w-9 h-9 rounded-xl bg-gradient-to-tr ${advisor.theme} text-white font-black text-xs flex items-center justify-center shadow-lg`}>
              {advisor.avatar}
            </div>
            <div className="text-left">
              <div className="flex items-center gap-2 leading-none flex-wrap">
                <h2 className="text-xs sm:text-sm font-black text-white">{advisor.name}</h2>
                <span className={`w-1.5 h-1.5 rounded-full ${isStreaming ? "bg-amber-400 animate-pulse" : "bg-emerald-400"}`} />
                <div className="hidden sm:block">
                  <EnvironmentBadge
                    agentName={streamAgentName || advisor.name}
                    agentDomain={streamAgentDomain || advisor.pythonDomain}
                    isActive={!isStreaming}
                    responseTimeMs={envResponseTimeMs}
                  />
                </div>
              </div>
              <p className="text-[9.5px] font-bold text-slate-500 mt-1 uppercase tracking-wider">
                {streamPhase === "thinking"
                  ? "Reasoning..."
                  : streamPhase === "streaming"
                  ? `${streamAgentName || advisor.name} is responding...`
                  : "System Connected & Clear"}
              </p>
            </div>
          </div>
        </div>

        {/* Telemetry HUD */}
        <div className="hidden md:flex items-center gap-4 text-[9px] font-mono font-bold text-slate-500 uppercase tracking-widest">
          <div className="flex items-center gap-1.5">
            <Cpu className="w-3.5 h-3.5 text-cyan-400 animate-pulse" />
            <span>NODE: {pingSpeed}</span>
          </div>
          <span className="w-[1px] h-3 bg-white/10" />
          <div className="flex items-center gap-1.5">
            <Lock className="w-3.5 h-3.5 text-emerald-400 animate-pulse" />
            <span>TELEMETRY SECURE</span>
          </div>
        </div>

        <Link
          href="/"
          aria-label="Exit to home"
          className="p-2.5 rounded-xl border border-white/10 bg-white/5 text-slate-400 hover:text-white hover:bg-rose-500/10 hover:border-rose-500/20 active:scale-95 touch-manipulation select-none transition-all flex items-center justify-center cursor-pointer"
        >
          <X className="w-4 h-4" />
        </Link>
      </header>
  );
}
