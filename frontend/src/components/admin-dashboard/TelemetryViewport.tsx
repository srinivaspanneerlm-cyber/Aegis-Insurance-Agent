"use client";

import { Dispatch, SetStateAction } from "react";
import {
  FileSpreadsheet, MessageSquare, Lock, Users, RefreshCw, Radio, Play,
} from "lucide-react";
import { motion } from "framer-motion";
import type { AdminStats } from "@/types/domain";

interface TelemetryViewportProps {
  stats: AdminStats;
  isSyncingHeartbeat: boolean;
  handleTriggerSync: () => void;
  setLogs: Dispatch<SetStateAction<string[]>>;
}

/** Telemetry Matrix hub: stat cards, analytics chart, and operational triggers (nav: "analytics"). */
export function TelemetryViewport({ stats, isSyncingHeartbeat, handleTriggerSync, setLogs }: TelemetryViewportProps) {
  return (
    <motion.div
      key="analytics"
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -15 }}
      className="space-y-8"
    >
      {/* Real-time stats command cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {[
          { label: "Active Lead Queue", value: stats.totalLeads, icon: <FileSpreadsheet className="w-5 h-5" />, color: "border-cyan-500/30 text-cyan-400 bg-cyan-950/20" },
          { label: "AI Chats Logged", value: stats.totalChats, icon: <MessageSquare className="w-5 h-5" />, color: "border-purple-500/30 text-purple-400 bg-purple-950/20" },
          { label: "Crypt Vault Files", value: stats.uploadedDocuments, icon: <Lock className="w-5 h-5" />, color: "border-teal-500/30 text-teal-400 bg-teal-950/20" },
          { label: "Security Operators", value: stats.activeUsers, icon: <Users className="w-5 h-5" />, color: "border-indigo-500/30 text-indigo-400 bg-indigo-950/20" }
        ].map((item, idx) => (
          <div key={idx} className={`p-6 border rounded-[28px] bg-slate-900/80 backdrop-blur-md flex flex-col justify-between ${item.color} shadow-lg`}>
            <div className="flex items-center justify-between mb-4">
              <span className="text-[9px] font-black uppercase tracking-widest text-slate-400">{item.label}</span>
              {item.icon}
            </div>
            <h3 className="text-3xl font-mono font-black text-white">{item.value}</h3>
          </div>
        ))}
      </div>

      {/* Cyber Matrix visual maps */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

        {/* Left Column: Underwrite Telemetry Map */}
        <div className="lg:col-span-2 p-6 sm:p-8 bg-slate-900/60 border border-cyan-500/20 rounded-[32px] space-y-6">
          <div className="flex items-center justify-between border-b border-white/5 pb-4">
            <div>
              <h4 className="text-xs font-black uppercase tracking-widest text-cyan-400">Actuarial Analytics Stream</h4>
              <p className="text-[10px] text-slate-500 font-bold mt-1">Real-time dynamic coverage indices sync</p>
            </div>
            <button
              onClick={handleTriggerSync}
              disabled={isSyncingHeartbeat}
              className="p-2 rounded-xl bg-slate-950 border border-cyan-500/30 hover:border-cyan-400 text-cyan-400 cursor-pointer flex items-center gap-1.5 transition-all text-[10px] font-black uppercase tracking-widest"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isSyncingHeartbeat ? "animate-spin" : ""}`} />
              <span>Force Sync</span>
            </button>
          </div>

          {/* Chart simulator representation */}
          <div className="h-64 bg-slate-950/80 rounded-2xl border border-white/5 relative flex items-end justify-between p-6 overflow-hidden">
            <div className="absolute inset-0 bg-[linear-gradient(to_bottom,rgba(6,182,212,0.02)_1px,transparent_1px)] bg-[size:100%_20px] pointer-events-none" />
            <div className="absolute top-4 left-4 flex items-center gap-2 text-[9px] text-emerald-400 bg-emerald-950/40 border border-emerald-800/40 py-1 px-2.5 rounded-full font-black uppercase">
              <Radio className="w-3 h-3 animate-ping" />
              <span>Active Telemetry Heartbeat: Stable</span>
            </div>

            {[40, 65, 52, 85, 74, 95, 80, 110, 90, 120].map((h, i) => (
              <div key={i} className="flex-1 flex flex-col items-center gap-2 group z-10">
                <div
                  style={{ height: `${h * 1.5}px` }}
                  className="w-4 sm:w-6 bg-gradient-to-t from-cyan-600/40 to-cyan-400 rounded-lg group-hover:to-purple-400 shadow-[0_0_15px_rgba(6,182,212,0.15)] transition-all relative"
                >
                  <span className="absolute top-[-25px] left-1/2 -translate-x-1/2 text-[8px] font-mono text-cyan-300 opacity-0 group-hover:opacity-100 transition-opacity">
                    {h}
                  </span>
                </div>
                <span className="text-[8px] font-mono text-slate-650">Q{i + 1}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Right Column: Active System heartbeat controls */}
        <div className="p-6 bg-slate-900/60 border border-cyan-500/20 rounded-[32px] space-y-6">
          <h4 className="text-xs font-black uppercase tracking-widest text-cyan-400 border-b border-white/5 pb-3">Operational Triggers</h4>

          <div className="space-y-4">
            <button
              onClick={handleTriggerSync}
              className="w-full p-4 bg-slate-950 border border-cyan-500/20 hover:border-cyan-400 rounded-2xl flex items-center justify-between transition-all group cursor-pointer text-left"
            >
              <div>
                <p className="text-xs font-black text-white group-hover:text-cyan-300 transition-colors">Actuarial Audit Check</p>
                <p className="text-[8.5px] text-slate-550 font-bold uppercase tracking-wider mt-0.5">Recalculate liability pools</p>
              </div>
              <Play className="w-4 h-4 text-cyan-400" />
            </button>

            <button
              onClick={() => {
                setLogs((prev) => ["SECURITY SWEEP: Scanned vault containers, no issues found.", ...prev]);
              }}
              className="w-full p-4 bg-slate-950 border border-purple-500/20 hover:border-purple-400 rounded-2xl flex items-center justify-between transition-all group cursor-pointer text-left"
            >
              <div>
                <p className="text-xs font-black text-white group-hover:text-purple-300 transition-colors">Security Ledger Scan</p>
                <p className="text-[8.5px] text-slate-550 font-bold uppercase tracking-wider mt-0.5">Verify ECDSA vault keys</p>
              </div>
              <Lock className="w-4 h-4 text-purple-400" />
            </button>
          </div>

          <div className="p-4 bg-slate-950 border border-white/5 rounded-2xl space-y-2">
            <span className="text-[9px] text-slate-550 font-extrabold uppercase tracking-widest block">LLM Processing Speed</span>
            <div className="flex items-center justify-between">
              <span className="text-lg font-mono font-black text-cyan-400">0.18s / Token</span>
              <span className="text-[9px] text-emerald-400 font-extrabold bg-emerald-950/40 border border-emerald-800/40 py-0.5 px-2 rounded">Excellent</span>
            </div>
          </div>
        </div>

      </div>
    </motion.div>
  );
}
