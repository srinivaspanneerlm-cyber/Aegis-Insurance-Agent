"use client";

import { useEffect, useId, useRef, type ReactNode } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { AlertTriangle } from "lucide-react";
import { Button } from "./Button";

export type ConfirmTone = "danger" | "default";

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  description?: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: ConfirmTone;
  onConfirm: () => void;
  onCancel: () => void;
}

// Danger confirm overrides the primary button's neutral surface with a rose
// treatment; `className` wins over the variant defaults via tailwind-merge.
const DANGER_CONFIRM =
  "bg-rose-600 hover:bg-rose-500 text-white border-rose-600 " +
  "dark:bg-rose-600 dark:hover:bg-rose-500 dark:text-white dark:border-rose-500 " +
  "focus-visible:ring-rose-500/60";

/**
 * Accessible confirmation modal for irreversible or destructive actions
 * (clearing a conversation, logging out). It is `role="dialog"` + `aria-modal`,
 * labelled by its title and described by its body; focus moves to the safe
 * (cancel) action on open, is trapped within the dialog, and returns to the
 * trigger on close; Escape and a backdrop click both cancel.
 *
 * Purely presentational — it decides nothing itself, only reports the reader's
 * confirm/cancel choice to the caller.
 */
export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  tone = "danger",
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const titleId = useId();
  const descId = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);
  const restoreRef = useRef<HTMLElement | null>(null);

  // Move focus to the safe action on open; restore it to the trigger on close.
  useEffect(() => {
    if (!open) return;
    restoreRef.current = document.activeElement as HTMLElement | null;
    const t = window.setTimeout(() => cancelRef.current?.focus(), 0);
    return () => {
      window.clearTimeout(t);
      restoreRef.current?.focus?.();
    };
  }, [open]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === "Escape") {
      e.stopPropagation();
      onCancel();
      return;
    }
    if (e.key !== "Tab") return;
    const focusable = panelRef.current?.querySelectorAll<HTMLElement>(
      'button:not([disabled]), [href], [tabindex]:not([tabindex="-1"])',
    );
    if (!focusable || focusable.length === 0) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
          className="fixed inset-0 z-[70] flex items-center justify-center p-6 bg-slate-950/70 backdrop-blur-sm"
          onClick={onCancel}
        >
          <motion.div
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            aria-describedby={description ? descId : undefined}
            onKeyDown={handleKeyDown}
            onClick={(e) => e.stopPropagation()}
            initial={{ opacity: 0, scale: 0.94, y: 16 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 12 }}
            transition={{ type: "spring", stiffness: 240, damping: 24 }}
            className="w-full max-w-[400px] rounded-3xl border p-7 shadow-2xl bg-white border-slate-200 text-slate-900 dark:bg-slate-900 dark:border-white/10 dark:text-white"
          >
            <div className="flex items-start gap-3.5 mb-5">
              {tone === "danger" && (
                <span className="flex-shrink-0 w-9 h-9 rounded-2xl flex items-center justify-center bg-rose-500/10 text-rose-500">
                  <AlertTriangle className="w-5 h-5" />
                </span>
              )}
              <div className="min-w-0">
                <h2 id={titleId} className="text-[15px] font-black leading-tight tracking-tight">
                  {title}
                </h2>
                {description && (
                  <p id={descId} className="text-[11.5px] leading-relaxed mt-2 text-slate-500 dark:text-slate-400">
                    {description}
                  </p>
                )}
              </div>
            </div>

            <div className="flex gap-3">
              <Button ref={cancelRef} variant="secondary" size="md" fullWidth onClick={onCancel}>
                {cancelLabel}
              </Button>
              <Button
                variant="primary"
                size="md"
                fullWidth
                onClick={onConfirm}
                className={tone === "danger" ? DANGER_CONFIRM : undefined}
              >
                {confirmLabel}
              </Button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
