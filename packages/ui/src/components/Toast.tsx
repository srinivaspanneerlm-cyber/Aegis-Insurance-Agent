"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  type ReactNode,
} from "react";
import { cn, invariant } from "@aegis/utils";

export type ToastTone = "info" | "success" | "warning" | "danger";

export interface Toast {
  id: string;
  tone: ToastTone;
  title: string;
  description?: string;
  /** Milliseconds before auto-dismiss. `null` keeps it until dismissed. */
  durationMs?: number | null;
}

type ToastInput = Omit<Toast, "id">;

interface ToastContextValue {
  toasts: readonly Toast[];
  notify: (toast: ToastInput) => string;
  dismiss: (id: string) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

type Action = { type: "add"; toast: Toast } | { type: "remove"; id: string };

function reducer(state: readonly Toast[], action: Action): readonly Toast[] {
  switch (action.type) {
    case "add":
      // Bounded. An error inside a retry loop can produce toasts faster than
      // anyone can read them, and an unbounded list would bury the screen.
      return [...state, action.toast].slice(-4);
    case "remove":
      return state.filter((toast) => toast.id !== action.id);
  }
}

const DEFAULT_DURATIONS: Record<ToastTone, number | null> = {
  info: 5000,
  success: 4000,
  warning: 8000,
  // Never auto-dismisses. Something went wrong and the customer may need to
  // read it twice, or copy it — taking that away on a timer is hostile.
  danger: null,
};

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, dispatch] = useReducer(reducer, [] as readonly Toast[]);

  const dismiss = useCallback((id: string) => dispatch({ type: "remove", id }), []);

  const notify = useCallback((input: ToastInput): string => {
    const id = `toast-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    dispatch({ type: "add", toast: { ...input, id } });
    return id;
  }, []);

  const value = useMemo(() => ({ toasts, notify, dismiss }), [toasts, notify, dismiss]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <ToastViewport toasts={toasts} onDismiss={dismiss} />
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const context = useContext(ToastContext);
  invariant(context, "useToast must be used within a <ToastProvider>");
  return context;
}

const toneStyles: Record<ToastTone, string> = {
  info: "border-info/30",
  success: "border-success/30",
  danger: "border-danger/40",
  warning: "border-warning/30",
};

const toneAccent: Record<ToastTone, string> = {
  info: "bg-info",
  success: "bg-success",
  danger: "bg-danger",
  warning: "bg-warning",
};

function ToastViewport({
  toasts,
  onDismiss,
}: {
  toasts: readonly Toast[];
  onDismiss: (id: string) => void;
}) {
  return (
    /**
     * One live region for the whole app.
     *
     * `polite` waits for a natural pause rather than cutting across whatever a
     * screen reader is mid-sentence on. `assertive` would interrupt, which is
     * only justified for something the person must act on immediately — and a
     * toast is never that.
     */
    <div
      aria-live="polite"
      aria-relevant="additions"
      className="z-toast pointer-events-none fixed right-4 bottom-4 flex w-full max-w-sm flex-col gap-2"
    >
      {toasts.map((toast) => (
        <ToastItem key={toast.id} toast={toast} onDismiss={onDismiss} />
      ))}
    </div>
  );
}

function ToastItem({ toast, onDismiss }: { toast: Toast; onDismiss: (id: string) => void }) {
  const duration =
    toast.durationMs === undefined ? DEFAULT_DURATIONS[toast.tone] : toast.durationMs;

  useEffect(() => {
    if (duration === null) return;
    const timer = window.setTimeout(() => onDismiss(toast.id), duration);
    return () => window.clearTimeout(timer);
  }, [duration, toast.id, onDismiss]);

  return (
    <div
      className={cn(
        "animate-slide-in-right pointer-events-auto relative flex gap-3 overflow-hidden",
        "glass rounded-card shadow-floating p-4",
        toneStyles[toast.tone]
      )}
    >
      <span
        className={cn("absolute inset-y-0 left-0 w-1", toneAccent[toast.tone])}
        aria-hidden="true"
      />
      <div className="flex-1 pl-2">
        <p className="text-body-sm text-content font-bold">{toast.title}</p>
        {toast.description ? (
          <p className="text-caption text-content-muted mt-1">{toast.description}</p>
        ) : null}
      </div>
      <button
        type="button"
        onClick={() => onDismiss(toast.id)}
        aria-label="Dismiss notification"
        className="focus-ring text-content-muted hover:text-content h-6 shrink-0 rounded px-2"
      >
        ×
      </button>
    </div>
  );
}
