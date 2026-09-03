"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowRight, X, CheckCircle2, Loader2 } from "lucide-react";
import { AgentAvatar } from "./brand/AgentAvatar";
import type { BrandId } from "./brand/geometry";

export interface InterruptRequest {
  fromName: string;
  fromAvatar: string;
  fromBrand: BrandId;
  fromTheme: string;
  fromEmoji: string;
  fromDomain: string;
  fromLabel: string;
  toName: string;
  toAvatar: string;
  toBrand: BrandId;
  toTheme: string;
  toEmoji: string;
  toDomain: string;
  toLabel: string;
}

interface Props {
  request: InterruptRequest | null;
  onConfirm: () => void;
  onDecline: () => void;
}

export default function InterruptDialog({ request, onConfirm, onDecline }: Props) {
  const [confirming, setConfirming] = useState(false);

  const handleConfirm = () => {
    setConfirming(true);
    setTimeout(() => onConfirm(), 80);
  };

  const handleDecline = () => {
    setConfirming(false);
    onDecline();
  };

  return (
    <AnimatePresence>
      {request && (
        <motion.div
          key="interrupt-overlay"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
          className="fixed inset-0 z-[60] flex items-center justify-center p-6"
          style={{ background: "rgba(2, 6, 23, 0.85)", backdropFilter: "blur(10px)" }}
        >
          <motion.div
            key="interrupt-card"
            initial={{ opacity: 0, scale: 0.92, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.92, y: 20 }}
            transition={{ type: "spring", stiffness: 160, damping: 22 }}
            className="w-full max-w-md relative overflow-hidden"
            style={{
              background: "rgba(15, 23, 42, 0.97)",
              border: "1px solid rgba(255,255,255,0.08)",
              borderRadius: "28px",
              boxShadow: "0 25px 60px rgba(0,0,0,0.65), inset 0 1px 1px rgba(255,255,255,0.06)",
            }}
          >
            {/* Top glow strip */}
            <div
              className="absolute top-0 left-0 right-0 h-px"
              style={{ background: "linear-gradient(to right, transparent, rgba(255,255,255,0.12), transparent)" }}
            />

            {/* Dismiss */}
            <button
              onClick={handleDecline}
              aria-label="Dismiss"
              className="absolute right-4 top-4 z-10 p-2 rounded-xl text-slate-500 hover:text-white transition-colors cursor-pointer active:scale-95"
              style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)" }}
            >
              <X className="w-3.5 h-3.5" />
            </button>

            {/* Header */}
            <div className="px-7 pt-7 pb-5" style={{ borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
              <div className="flex items-center gap-2 mb-2">
                <div className="w-1.5 h-1.5 rounded-full bg-violet-400 animate-pulse" />
                <p className="text-[9.5px] font-black uppercase tracking-widest text-violet-400/80">
                  Topic Change Detected
                </p>
              </div>
              <h3 className="text-[15px] font-black text-white leading-tight">
                Switching to {request.toLabel} Insurance
              </h3>
              <p className="text-[11px] text-slate-400 mt-1.5 leading-relaxed">
                You were working on{" "}
                <span className="text-white font-bold">{request.fromLabel} Insurance</span> —
                would you like to switch to{" "}
                <span className="text-white font-bold">{request.toLabel} Insurance</span> instead?
              </p>
            </div>

            {/* Agent transition */}
            <div className="px-7 py-5 flex items-center gap-3">
              {/* From */}
              <div
                className="flex-1 p-3.5 rounded-2xl text-center opacity-70"
                style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)" }}
              >
                <AgentAvatar brand={request.fromBrand} size={40} className="mx-auto mb-2" />
                <p className="text-[11px] font-black text-slate-400">{request.fromName}</p>
                <p className="text-[9px] font-semibold text-slate-600 mt-0.5">{request.fromLabel}</p>
              </div>

              {/* Arrow */}
              <div className="flex flex-col items-center gap-1 flex-shrink-0">
                <div
                  className="w-8 h-8 rounded-full flex items-center justify-center"
                  style={{ background: "rgba(139,92,246,0.12)", border: "1px solid rgba(139,92,246,0.25)" }}
                >
                  <ArrowRight className="w-3.5 h-3.5 text-violet-400" />
                </div>
                <p className="text-[8px] font-bold text-slate-600 uppercase tracking-wider">Switch</p>
              </div>

              {/* To */}
              <div
                className="flex-1 p-3.5 rounded-2xl text-center"
                style={{ background: "rgba(139,92,246,0.05)", border: "1px solid rgba(139,92,246,0.18)" }}
              >
                <AgentAvatar brand={request.toBrand} size={40} className="mx-auto mb-2" />
                <p className="text-[11px] font-black text-violet-200">{request.toName}</p>
                <p className="text-[9px] font-semibold text-violet-400/60 mt-0.5">{request.toLabel}</p>
              </div>
            </div>

            {/* Progress saved notice */}
            <div
              className="mx-7 mb-5 p-3 rounded-xl flex items-start gap-2.5"
              style={{ background: "rgba(16,185,129,0.05)", border: "1px solid rgba(16,185,129,0.14)" }}
            >
              <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-[10px] font-black text-emerald-300 mb-0.5">Progress Automatically Saved</p>
                <p className="text-[10px] text-emerald-300/60 leading-relaxed">
                  Your {request.fromLabel} consultation — profile, questions, and any recommendations —
                  has been saved. Return at any time and you&apos;ll pick up exactly where you left off.
                </p>
              </div>
            </div>

            {/* Action buttons */}
            <div className="px-7 pb-7 flex gap-3">
              <button
                onClick={handleDecline}
                disabled={confirming}
                className="flex-1 py-3 rounded-[14px] text-slate-300 text-[11px] font-black hover:text-white transition-all cursor-pointer active:scale-95 touch-manipulation disabled:opacity-40"
                style={{ border: "1px solid rgba(255,255,255,0.09)", background: "rgba(255,255,255,0.04)" }}
              >
                No, Continue {request.fromLabel}
              </button>
              <button
                onClick={handleConfirm}
                disabled={confirming}
                className="flex-1 py-3 rounded-[14px] text-[11px] font-black transition-all cursor-pointer active:scale-95 touch-manipulation disabled:opacity-80 flex items-center justify-center gap-2"
                style={{
                  background: "linear-gradient(135deg, rgba(139,92,246,0.9), rgba(109,40,217,0.9))",
                  border: "1px solid rgba(139,92,246,0.4)",
                  boxShadow: "0 0 20px rgba(139,92,246,0.25)",
                  color: "white",
                }}
              >
                {confirming ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Switching…</span>
                  </>
                ) : (
                  `Yes, Switch to ${request.toLabel}`
                )}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
