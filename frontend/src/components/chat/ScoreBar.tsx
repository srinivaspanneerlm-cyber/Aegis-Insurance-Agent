"use client";
import React from "react";
import { motion } from "framer-motion";

// ── Score bar ─────────────────────────────────────────────────────────────────

export function ScoreBar({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between">
        <span className="text-[9px] text-slate-500 font-bold uppercase tracking-wide">{label}</span>
        <span className={`text-[9px] font-black font-mono ${color}`}>{value}%</span>
      </div>
      <div className="h-1 rounded-full bg-white/5 overflow-hidden">
        <motion.div
          className={`h-full rounded-full ${color.replace("text-", "bg-")}`}
          initial={{ width: 0 }}
          animate={{ width: `${value}%` }}
          transition={{ duration: 0.7, ease: "easeOut", delay: 0.1 }}
        />
      </div>
    </div>
  );
}
