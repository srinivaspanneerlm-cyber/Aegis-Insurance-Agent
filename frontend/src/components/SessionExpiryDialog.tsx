"use client";

import { useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Clock, ShieldCheck } from "lucide-react";
import { formatCountdown } from "@/lib/session-lifecycle";

interface Props {
  open: boolean;
  msUntilSignOut: number;
  onStaySignedIn: () => void;
  onSignOut: () => void;
}

/**
 * The last word before an unattended session ends.
 *
 * The tone matters more than the mechanism here. A customer who stepped away to
 * answer the door should come back to something that reads as care, not as an
 * error — so it explains why (a device someone else might use), what will
 * happen, and gives them one obvious way to carry on.
 *
 * The countdown is deliberately hidden from screen readers: a number changing
 * every second would be read aloud every second. The written explanation says
 * everything the digits do, once.
 */
export default function SessionExpiryDialog({
  open,
  msUntilSignOut,
  onStaySignedIn,
  onSignOut,
}: Props) {
  const stayButtonRef = useRef<HTMLButtonElement>(null);

  // Put the keyboard on the way out, not on the way to being signed out.
  useEffect(() => {
    if (open) stayButtonRef.current?.focus();
  }, [open]);

  // Escape is the customer reaching for "make this go away", which here means
  // staying — never the destructive half of the choice.
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onStaySignedIn();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onStaySignedIn]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          key="session-expiry-overlay"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.22 }}
          className="fixed inset-0 z-[70] flex items-center justify-center p-6"
          style={{ background: "rgba(1, 4, 16, 0.86)", backdropFilter: "blur(14px)" }}
        >
          <motion.div
            key="session-expiry-card"
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="session-expiry-title"
            aria-describedby="session-expiry-body"
            initial={{ opacity: 0, scale: 0.88, y: 28 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 18 }}
            transition={{ type: "spring", stiffness: 200, damping: 24 }}
            className="w-full max-w-[400px] relative overflow-hidden"
            style={{
              background:
                "linear-gradient(160deg, rgba(15,23,42,0.98) 0%, rgba(8,14,30,0.98) 100%)",
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
                background:
                  "linear-gradient(to right, transparent 5%, rgba(255,255,255,0.15) 50%, transparent 95%)",
              }}
            />

            <div className="px-7 pt-7 pb-5">
              <div className="flex items-center gap-2 mb-3">
                <Clock className="w-3.5 h-3.5 text-amber-400" />
                <p className="text-[9px] font-black uppercase tracking-[0.18em] text-amber-400/75">
                  Still there?
                </p>
              </div>
              <h3
                id="session-expiry-title"
                className="text-[16px] font-black text-white leading-tight tracking-tight"
              >
                We&apos;re about to sign you out
              </h3>
              <p
                id="session-expiry-body"
                className="text-[11.5px] text-slate-400 mt-2 leading-relaxed"
              >
                You haven&apos;t used this page for a while. We sign you out
                automatically so nobody else who uses this device can see your
                policies. Choose <span className="text-slate-200 font-bold">Stay signed in</span>{" "}
                to carry on where you left off.
              </p>
            </div>

            {/* Countdown */}
            <div className="px-7 pb-5">
              <div
                className="px-4 py-4 rounded-2xl flex items-center justify-center gap-3"
                style={{
                  background: "rgba(245,158,11,0.06)",
                  border: "1px solid rgba(245,158,11,0.22)",
                }}
              >
                <span className="text-[10.5px] text-amber-300/70 font-bold">
                  Signing out in
                </span>
                <span
                  aria-hidden="true"
                  className="text-[22px] font-black text-amber-200 tabular-nums leading-none"
                >
                  {formatCountdown(msUntilSignOut)}
                </span>
              </div>
            </div>

            <div
              className="mx-7 mb-5 px-4 py-3 rounded-2xl flex items-start gap-3"
              style={{
                background: "rgba(16,185,129,0.04)",
                border: "1px solid rgba(16,185,129,0.12)",
              }}
            >
              <ShieldCheck className="w-4 h-4 text-emerald-400 flex-shrink-0 mt-0.5" />
              <p className="text-[10.5px] text-emerald-300/65 leading-relaxed">
                Nothing is lost either way — your details are saved to your account, not to
                this device.
              </p>
            </div>

            {/* Actions — full-height targets, because a rushed tap on a phone is
                the likeliest way this dialog is answered. */}
            <div className="px-7 pb-7 flex gap-3">
              <button
                onClick={onSignOut}
                className="flex-1 py-4 rounded-[16px] text-slate-400 text-[11.5px] font-black hover:text-white transition-all cursor-pointer active:scale-[0.97] touch-manipulation"
                style={{
                  border: "1px solid rgba(255,255,255,0.08)",
                  background: "rgba(255,255,255,0.03)",
                }}
              >
                Sign out now
              </button>
              <motion.button
                ref={stayButtonRef}
                onClick={onStaySignedIn}
                whileTap={{ scale: 0.97 }}
                className="flex-1 py-4 rounded-[16px] text-slate-950 text-[11.5px] font-black transition-all cursor-pointer touch-manipulation"
                style={{
                  background: "linear-gradient(135deg, #fff 0%, rgba(255,255,255,0.88) 100%)",
                  boxShadow: "0 0 28px rgba(255,255,255,0.12), 0 4px 12px rgba(0,0,0,0.3)",
                }}
              >
                Stay signed in
              </motion.button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
