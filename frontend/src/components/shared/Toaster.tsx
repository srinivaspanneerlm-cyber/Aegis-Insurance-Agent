"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { CheckCircle, AlertCircle, Info, X } from "lucide-react";
import { subscribeToast, type Toast, type ToastKind } from "@/lib/toast";

/** How long a toast stays before auto-dismissing (ms). */
const AUTO_DISMISS_MS = 5000;

const KIND: Record<
  ToastKind,
  { icon: typeof Info; ring: string; text: string; bg: string }
> = {
  success: { icon: CheckCircle, ring: "border-emerald-500/30", text: "text-emerald-300", bg: "bg-emerald-500/10" },
  error:   { icon: AlertCircle, ring: "border-rose-500/30",    text: "text-rose-300",    bg: "bg-rose-500/10" },
  info:    { icon: Info,        ring: "border-cyan-500/30",    text: "text-cyan-300",    bg: "bg-cyan-500/10" },
};

/** Renders app-wide toasts raised via `notify` from `@/lib/toast`. */
export function Toaster() {
  const [toasts, setToasts] = useState<Toast[]>([]);

  useEffect(() => {
    return subscribeToast((toast) => {
      setToasts((prev) => [...prev, toast]);
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== toast.id));
      }, AUTO_DISMISS_MS);
    });
  }, []);

  const dismiss = (id: number) => setToasts((prev) => prev.filter((t) => t.id !== id));

  return (
    <div className="fixed bottom-6 right-6 z-[100] flex flex-col gap-2.5 pointer-events-none">
      <AnimatePresence>
        {toasts.map((t) => {
          const cfg = KIND[t.kind];
          const Icon = cfg.icon;
          return (
            <motion.div
              key={t.id}
              initial={{ opacity: 0, x: 40, scale: 0.95 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, x: 40, scale: 0.95 }}
              transition={{ type: "spring", stiffness: 300, damping: 26 }}
              className={`pointer-events-auto flex items-start gap-3 max-w-sm rounded-2xl border ${cfg.ring} ${cfg.bg} bg-slate-950/90 backdrop-blur-xl px-4 py-3 shadow-2xl`}
              role="alert"
            >
              <Icon className={`w-4.5 h-4.5 flex-shrink-0 mt-0.5 ${cfg.text}`} />
              <p className="text-[12.5px] font-semibold text-slate-100 leading-snug flex-1">{t.message}</p>
              <button
                onClick={() => dismiss(t.id)}
                className="text-slate-500 hover:text-slate-300 transition-colors flex-shrink-0"
                aria-label="Dismiss"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}
