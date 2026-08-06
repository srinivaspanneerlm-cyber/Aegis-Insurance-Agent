"use client";

import { useState, type FormEvent } from "react";
import { Icon } from "@/components/Icon";
import { platformApi } from "@/lib/api";

/**
 * Re-confirm the operator before a structural change.
 *
 * Every mutation in this console suspends a tenant, evicts sessions or changes
 * behaviour for every request the platform serves. The API refuses those
 * without a fresh confirmation; this is the prompt that gets one, shown at the
 * moment of the action rather than as a periodic interruption.
 */
export function StepUpDialog({
  open,
  onConfirmed,
  onCancel,
  action,
}: {
  open: boolean;
  onConfirmed: () => void;
  onCancel: () => void;
  action: string;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!open) return null;

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const password = String(new FormData(event.currentTarget).get("password") ?? "");
    setBusy(true);
    setError(null);
    try {
      await platformApi.stepUp(password);
      onConfirmed();
    } catch (err) {
      setError(err instanceof Error ? err.message : "That did not work.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-modal flex items-center justify-center bg-overlay/70 p-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="stepup-title"
        className="w-full max-w-sm rounded-card border border-line bg-surface p-6"
      >
        <span className="mb-4 inline-flex h-11 w-11 items-center justify-center rounded-control border border-line/60 bg-surface-raised/60 text-brand">
          <Icon name="lock" size={20} />
        </span>
        <h2 id="stepup-title" className="text-h3 font-semibold text-content">
          Confirm it&rsquo;s you
        </h2>
        <p className="mt-2 text-pretty text-body-sm text-content-secondary">
          {action} affects the whole platform, so it needs your password again. This confirmation
          lasts five minutes.
        </p>

        <form onSubmit={submit} className="mt-5 flex flex-col gap-3">
          {error ? (
            <p
              role="alert"
              className="rounded-control bg-danger/10 px-3 py-2 text-caption text-danger"
            >
              {error}
            </p>
          ) : null}
          <label htmlFor="stepup-password" className="sr-only">
            Password
          </label>
          <input
            id="stepup-password"
            name="password"
            type="password"
            required
            autoFocus
            autoComplete="current-password"
            className="h-11 rounded-control border border-line/60 bg-surface-raised/40 px-3 text-body-sm text-content focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/40"
          />
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={busy}
              className="focus-ring h-11 flex-1 rounded-control bg-brand text-body-sm font-semibold text-brand-fg transition-colors hover:bg-brand-hover disabled:opacity-50"
            >
              {busy ? "Confirming…" : "Confirm"}
            </button>
            <button
              type="button"
              onClick={onCancel}
              className="focus-ring h-11 rounded-control border border-line px-4 text-body-sm font-medium text-content transition-colors hover:border-line-strong"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
