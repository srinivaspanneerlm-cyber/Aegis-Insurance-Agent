"use client";

import { motion, AnimatePresence } from "framer-motion";
import type { ConnectingAgent } from "@/app/advisor/transferRules";

/**
 * "Establishing Secure Channel" overlay shown instantly after the user accepts
 * a transfer, dismissed on the first SSE event. Purely presentational.
 */
export function ConnectingOverlay({ connectingTo }: { connectingTo: ConnectingAgent | null }) {
  return (
    <AnimatePresence>
      {connectingTo && (
        <motion.div
          key="connecting-overlay"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.25 }}
          className="absolute inset-0 z-20 flex flex-col items-center justify-center"
          style={{ background: "rgba(1, 4, 16, 0.9)", backdropFilter: "blur(16px)" }}
        >
          <motion.div
            initial={{ scale: 0.82, y: 20, opacity: 0 }}
            animate={{ scale: 1, y: 0, opacity: 1 }}
            exit={{ scale: 0.88, y: 12, opacity: 0 }}
            transition={{ type: "spring", stiffness: 200, damping: 24 }}
            className="flex flex-col items-center gap-6 w-full max-w-[260px]"
          >
            {/* Agent avatar — layered rings */}
            <div className="relative flex items-center justify-center">
              <motion.div
                className="absolute rounded-3xl"
                style={{
                  width: 88, height: 88,
                  border: "1px solid rgba(255,255,255,0.08)",
                  borderRadius: 26,
                }}
                animate={{ scale: [1, 1.18, 1], opacity: [0.5, 0, 0.5] }}
                transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
              />
              <motion.div
                className="absolute rounded-3xl"
                style={{
                  width: 72, height: 72,
                  border: "1px solid rgba(255,255,255,0.12)",
                  borderRadius: 22,
                }}
                animate={{ scale: [1, 1.12, 1], opacity: [0.6, 0, 0.6] }}
                transition={{ duration: 2, repeat: Infinity, ease: "easeInOut", delay: 0.3 }}
              />
              <div
                className={`w-14 h-14 rounded-[18px] bg-gradient-to-tr ${connectingTo.theme} text-white font-black text-lg flex items-center justify-center shadow-2xl relative z-10`}
              >
                {connectingTo.avatar}
              </div>
            </div>

            {/* Label */}
            <div className="text-center">
              <p className="text-[9px] font-black uppercase tracking-[0.2em] text-slate-500 mb-2">
                Establishing Secure Channel
              </p>
              <div className="flex items-baseline gap-1.5 justify-center">
                <p className="text-[15px] font-black text-white leading-none">
                  Connecting to {connectingTo.name}
                </p>
                <span className="flex gap-0.5 pb-0.5">
                  {[0, 1, 2].map(i => (
                    <motion.span
                      key={i}
                      className="w-1 h-1 rounded-full bg-white/70 inline-block"
                      animate={{ opacity: [0.2, 1, 0.2] }}
                      transition={{ duration: 1.1, repeat: Infinity, delay: i * 0.2 }}
                    />
                  ))}
                </span>
              </div>
            </div>

            {/* Step progress */}
            <div className="w-full flex flex-col gap-2">
              {[
                { label: "Saving session context", delay: 0 },
                { label: "Routing to specialist", delay: 0.28 },
                { label: "Establishing connection", delay: 0.56 },
                { label: "Ready", delay: 0.82 },
              ].map(({ label, delay }) => (
                <motion.div
                  key={label}
                  className="flex items-center gap-2.5"
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay, duration: 0.3 }}
                >
                  <motion.div
                    className={`w-1.5 h-1.5 rounded-full flex-shrink-0 bg-gradient-to-tr ${connectingTo.theme}`}
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ delay: delay + 0.1, type: "spring", stiffness: 260, damping: 18 }}
                  />
                  <p className="text-[10px] font-semibold text-slate-400">{label}</p>
                </motion.div>
              ))}
            </div>

            {/* Progress bar */}
            <div
              className="w-full h-px rounded-full overflow-hidden"
              style={{ background: "rgba(255,255,255,0.07)" }}
            >
              <motion.div
                className={`h-full rounded-full bg-gradient-to-r ${connectingTo.theme}`}
                initial={{ width: "0%" }}
                animate={{ width: "100%" }}
                transition={{ duration: 1.2, ease: [0.22, 1, 0.36, 1] }}
              />
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
