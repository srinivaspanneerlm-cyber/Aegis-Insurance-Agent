"use client";

import { Dispatch, SetStateAction } from "react";
import { motion } from "framer-motion";

interface LogsViewportProps {
  logs: string[];
  setLogs: Dispatch<SetStateAction<string[]>>;
}

/** System Core Logs: live telemetry console with clear action (nav: "telemetry"). */
export function LogsViewport({ logs, setLogs }: LogsViewportProps) {
  return (
    <motion.div
      key="telemetry"
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -15 }}
      className="bg-slate-900/60 border border-cyan-500/20 rounded-[32px] p-6 sm:p-8 space-y-6"
    >
      <div className="border-b border-white/5 pb-4 flex items-center justify-between">
        <div>
          <h3 className="font-extrabold text-white text-base">System Telemetry Log streams</h3>
          <p className="text-xs text-slate-400 mt-1 font-semibold">Real-time command actions monitored dynamically inside the network.</p>
        </div>
        <button
          onClick={() => setLogs([])}
          className="text-[9px] text-cyan-400 hover:text-cyan-300 underline font-black uppercase tracking-widest cursor-pointer"
        >
          Clear Console
        </button>
      </div>

      <div className="p-6 bg-slate-950 border border-white/5 rounded-2xl font-mono text-[10.5px] text-cyan-400/90 space-y-2.5 min-h-[300px] overflow-y-auto max-h-[320px] shadow-inner text-left">
        {logs.map((log, idx) => (
          <div key={idx} className="flex items-start gap-2.5 border-b border-white/[0.02] pb-1.5 last:border-0">
            <span className="text-slate-650 select-none">[{new Date().toLocaleTimeString()}]</span>
            <span className="text-cyan-400 font-bold">&gt;&gt;</span>
            <span className="leading-relaxed">{log}</span>
          </div>
        ))}
      </div>
    </motion.div>
  );
}
