"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ShieldCheck, Loader2, Sparkles } from "lucide-react";
import { AgentAvatar } from "./brand/AgentAvatar";
import type { BrandId } from "./brand/geometry";

export interface TransferRequest {
  fromName: string;
  fromAvatar: string;
  fromBrand: BrandId;
  fromTheme: string;
  fromEmoji: string;
  fromDomain: string;
  toName: string;
  toAvatar: string;
  toBrand: BrandId;
  toTheme: string;
  toEmoji: string;
  toDomain: string;
  reason: string;
}

interface Props {
  request: TransferRequest | null;
  onConfirm: () => void;
  onDecline: () => void;
}

// Flowing dot between two agent cards
function FlowingDots() {
  return (
    <div className="relative flex items-center justify-center w-16 flex-shrink-0">
      {/* Track line */}
      <div
        className="absolute w-full h-px"
        style={{ background: "linear-gradient(to right, rgba(255,255,255,0.04), rgba(255,255,255,0.14), rgba(255,255,255,0.04))" }}
      />
      {/* Travelling dots */}
      {[0, 1, 2].map(i => (
        <motion.div
          key={i}
          className="absolute w-1.5 h-1.5 rounded-full"
          style={{ background: "rgba(255,255,255,0.7)" }}
          animate={{ x: ["-24px", "24px"], opacity: [0, 1, 1, 0] }}
          transition={{
            duration: 1.4,
            repeat: Infinity,
            delay: i * 0.38,
            ease: "easeInOut",
          }}
        />
      ))}
      {/* Arrow head */}
      <div
        className="absolute right-0 w-2 h-2 border-t border-r border-white/25 rotate-45"
        style={{ marginRight: "4px" }}
      />
    </div>
  );
}

export default function TransferDialog({ request, onConfirm, onDecline }: Props) {
  const [confirming, setConfirming] = useState(false);

  const handleConfirm = () => {
    setConfirming(true);
    setTimeout(() => onConfirm(), 80);
  };

  const handleDecline = () => {
    setConfirming(false);
    onDecline();
  };

  // The reason arrives as a domain slug ("motor") from some paths and as a
  // phrase that already ends in the word ("health insurance") from others, so
  // appending it unconditionally produced "Health Insurance Insurance" on
  // screen, in the dialog a customer is asked to consent in.
  const reasonLabel = (() => {
    if (!request?.reason) return "a specialised area";
    const spoken = request.reason
      .replace(/-/g, " ")
      .replace(/\b\w/g, (c) => c.toUpperCase());
    return /insurance$/i.test(spoken) ? spoken : `${spoken} Insurance`;
  })();

  return (
    <AnimatePresence>
      {request && (
        <motion.div
          key="transfer-overlay"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.22 }}
          className="fixed inset-0 z-[60] flex items-center justify-center p-6"
          style={{ background: "rgba(1, 4, 16, 0.86)", backdropFilter: "blur(14px)" }}
        >
          <motion.div
            key="transfer-card"
            initial={{ opacity: 0, scale: 0.88, y: 28 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 18 }}
            transition={{ type: "spring", stiffness: 200, damping: 24 }}
            className="w-full max-w-[400px] relative overflow-hidden"
            style={{
              background: "linear-gradient(160deg, rgba(15,23,42,0.98) 0%, rgba(8,14,30,0.98) 100%)",
              border: "1px solid rgba(255,255,255,0.075)",
              borderRadius: "32px",
              boxShadow:
                "0 32px 80px rgba(0,0,0,0.7), 0 0 0 1px rgba(255,255,255,0.03), inset 0 1px 1px rgba(255,255,255,0.06)",
            }}
          >
            {/* Top shimmer line */}
            <div
              className="absolute top-0 left-0 right-0 h-px"
              style={{
                background: "linear-gradient(to right, transparent 5%, rgba(255,255,255,0.15) 50%, transparent 95%)",
              }}
            />

            {/* Header */}
            <div className="px-7 pt-7 pb-5">
              <div className="flex items-center gap-2 mb-3">
                <motion.div
                  animate={{ scale: [1, 1.15, 1] }}
                  transition={{ duration: 2, repeat: Infinity }}
                >
                  <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                </motion.div>
                <p className="text-[9px] font-black uppercase tracking-[0.18em] text-amber-400/75">
                  Specialist Handoff
                </p>
              </div>
              <h3 className="text-[16px] font-black text-white leading-tight tracking-tight">
                Better expertise available
              </h3>
              <p className="text-[11.5px] text-slate-400 mt-2 leading-relaxed">
                Your question is about{" "}
                <span className="text-slate-200 font-bold">{reasonLabel}</span>.{" "}
                A specialist can give you a more accurate answer.
              </p>
            </div>

            {/* Divider */}
            <div className="mx-7" style={{ borderTop: "1px solid rgba(255,255,255,0.05)" }} />

            {/* Agent cards */}
            <div className="px-7 py-5 flex items-center gap-0">
              {/* FROM */}
              <div
                className="flex-1 flex flex-col items-center gap-2 py-3.5 px-3 rounded-2xl"
                style={{ background: "rgba(255,255,255,0.025)", border: "1px solid rgba(255,255,255,0.06)" }}
              >
                <AgentAvatar brand={request.fromBrand} size={44} />
                <div className="text-center">
                  <p className="text-[11px] font-black text-slate-300 leading-none">{request.fromName}</p>
                  <p className="text-[9px] text-slate-500 mt-1 capitalize leading-none">
                    {request.fromDomain.replace(/-/g, " ")}
                  </p>
                </div>
                <span
                  className="text-[8px] font-black px-2 py-0.5 rounded-full uppercase tracking-wider"
                  style={{ background: "rgba(255,255,255,0.05)", color: "rgba(255,255,255,0.3)" }}
                >
                  Current
                </span>
              </div>

              {/* Arrow */}
              <FlowingDots />

              {/* TO */}
              <div
                className="flex-1 flex flex-col items-center gap-2 py-3.5 px-3 rounded-2xl relative overflow-hidden"
                style={{
                  background: "rgba(245,158,11,0.06)",
                  border: "1px solid rgba(245,158,11,0.22)",
                }}
              >
                {/* Glow behind card */}
                <div
                  className="absolute inset-0 pointer-events-none"
                  style={{
                    background: "radial-gradient(ellipse at 50% 0%, rgba(245,158,11,0.12), transparent 70%)",
                  }}
                />
                <AgentAvatar brand={request.toBrand} size={44} className="relative z-10" />
                <div className="text-center relative z-10">
                  <p className="text-[11px] font-black text-amber-200 leading-none">{request.toName}</p>
                  <p className="text-[9px] text-amber-500/60 mt-1 capitalize leading-none">
                    {request.toDomain.replace(/-/g, " ")}
                  </p>
                </div>
                <span
                  className="text-[8px] font-black px-2 py-0.5 rounded-full uppercase tracking-wider relative z-10"
                  style={{ background: "rgba(245,158,11,0.15)", color: "rgba(245,158,11,0.9)" }}
                >
                  Specialist
                </span>
              </div>
            </div>

            {/* Session preservation */}
            <div
              className="mx-7 mb-5 px-4 py-3 rounded-2xl flex items-start gap-3"
              style={{ background: "rgba(16,185,129,0.04)", border: "1px solid rgba(16,185,129,0.12)" }}
            >
              <ShieldCheck className="w-4 h-4 text-emerald-400 flex-shrink-0 mt-0.5" />
              <p className="text-[10.5px] text-emerald-300/65 leading-relaxed">
                Your session, profile, and conversation history are preserved. You can return anytime.
              </p>
            </div>

            {/* Actions */}
            <div className="px-7 pb-7 flex gap-3">
              <button
                onClick={handleDecline}
                disabled={confirming}
                className="flex-1 py-3.5 rounded-[16px] text-slate-400 text-[11.5px] font-black hover:text-white transition-all cursor-pointer active:scale-[0.97] touch-manipulation disabled:opacity-40"
                style={{ border: "1px solid rgba(255,255,255,0.08)", background: "rgba(255,255,255,0.03)" }}
              >
                Stay Here
              </button>
              <motion.button
                onClick={handleConfirm}
                disabled={confirming}
                whileTap={{ scale: 0.97 }}
                className="flex-1 py-3.5 rounded-[16px] text-slate-950 text-[11.5px] font-black transition-all cursor-pointer touch-manipulation disabled:opacity-75 flex items-center justify-center gap-2"
                style={{
                  background: confirming
                    ? "rgba(255,255,255,0.85)"
                    : "linear-gradient(135deg, #fff 0%, rgba(255,255,255,0.88) 100%)",
                  boxShadow: "0 0 28px rgba(255,255,255,0.12), 0 4px 12px rgba(0,0,0,0.3)",
                }}
              >
                {confirming ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Connecting…</span>
                  </>
                ) : (
                  "Yes, Connect Me"
                )}
              </motion.button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
