/**
 * Tiny framework-agnostic toast bus. UI code calls `notify.error(msg)` (etc.)
 * and the mounted <Toaster/> subscribes to render them. Kept out of React
 * context so any module — hooks, plain functions — can raise a toast without
 * prop-drilling.
 */

export type ToastKind = "success" | "error" | "info";

export interface Toast {
  id: number;
  kind: ToastKind;
  message: string;
}

type Listener = (toast: Toast) => void;

const listeners = new Set<Listener>();
let counter = 0;

/** Subscribe to emitted toasts; returns an unsubscribe function. */
export function subscribeToast(fn: Listener): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

function emit(kind: ToastKind, message: string): void {
  const toast: Toast = { id: ++counter, kind, message };
  listeners.forEach((fn) => fn(toast));
}

export const notify = {
  success: (message: string) => emit("success", message),
  error: (message: string) => emit("error", message),
  info: (message: string) => emit("info", message),
};
