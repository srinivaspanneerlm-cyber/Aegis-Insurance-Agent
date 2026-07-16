"use client";
import React, { useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowRight, Copy, Check } from "lucide-react";

// ── Streaming cursor ───────────────────────────────────────────────────────────

export function StreamingCursor() {
  return (
    <motion.span
      className="inline-block w-[2px] h-4 bg-white/60 ml-[1px] align-middle rounded-full"
      animate={{ opacity: [1, 0, 1] }}
      transition={{ duration: 0.8, repeat: Infinity }}
    />
  );
}

// ── Transfer badge ─────────────────────────────────────────────────────────────

export function TransferBadge({ from, to }: { from?: string; to?: string }) {
  if (!from && !to) return null;
  return (
    <motion.div
      initial={{ opacity: 0, y: -4 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/5 border border-white/10 text-[9px] text-white/40 font-medium w-fit mb-1.5"
    >
      {from && <span>{from}</span>}
      {from && to && <ArrowRight className="w-3 h-3" />}
      {to && <span className="text-cyan-400">{to}</span>}
    </motion.div>
  );
}

// ── Copy button ────────────────────────────────────────────────────────────────

export function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const copy = useCallback(() => {
    const clean = text.replace(/\[RECOMMENDATION:\{[\s\S]*?\}\]/g, "").trim();
    navigator.clipboard.writeText(clean).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [text]);

  return (
    <button onClick={copy} className="p-1.5 rounded-lg hover:bg-white/5 text-white/25 hover:text-white/50 transition-colors" title="Copy response">
      <AnimatePresence mode="wait">
        {copied
          ? <motion.div key="check" initial={{ scale: 0 }} animate={{ scale: 1 }}><Check className="w-3.5 h-3.5 text-emerald-400" /></motion.div>
          : <motion.div key="copy" initial={{ scale: 0 }} animate={{ scale: 1 }}><Copy className="w-3.5 h-3.5" /></motion.div>
        }
      </AnimatePresence>
    </button>
  );
}
