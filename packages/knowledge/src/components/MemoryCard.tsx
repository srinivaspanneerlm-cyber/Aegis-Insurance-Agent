"use client";

import { cn } from "@aegis/utils";
import {
  MEMORY_SOURCE_META,
  TONE_BORDER,
  confidenceLabel,
  timeAgo,
  type MemoryFact,
} from "../lib/types";

export interface MemoryCardProps {
  fact: MemoryFact;
  onHistory?: (key: string) => void;
  onForget?: (key: string) => void;
}

/** Renders a JSON value as something a person reads, not as JSON. */
function present(value: unknown): string {
  if (value === null || value === undefined) return "—";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (typeof value === "string" || typeof value === "number") return String(value);
  if (Array.isArray(value)) return value.map(present).join(", ");
  return JSON.stringify(value);
}

/**
 * One thing the platform believes about somebody.
 *
 * Where it came from is shown as prominently as what it says. "Aegis inferred"
 * and "They told us" are very different claims, and a card that renders them
 * identically invites an advisor to repeat a guess back to a customer as fact.
 *
 * Confidence is words first, number second. "62%" alone implies a precision a
 * rule engine on self-reported facts does not have.
 */
export function MemoryCard({ fact, onHistory, onForget }: MemoryCardProps) {
  const source = MEMORY_SOURCE_META[fact.source] ?? {
    label: fact.source,
    tone: "neutral" as const,
    hint: "",
  };
  const superseded = fact.current === false;

  return (
    <article
      className={cn(
        "rounded-card border p-3.5",
        superseded
          ? "border-line/30 bg-surface-raised/10 opacity-70"
          : "border-line/50 bg-surface-raised/30"
      )}
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          {/* The key is shown, because an advisor challenged on a fact needs to
              be able to name it. */}
          <p className="text-caption text-content-muted font-mono">{fact.key}</p>
          <p className="text-body-sm text-content mt-0.5 font-medium text-pretty">
            {present(fact.value)}
          </p>
        </div>

        <span
          title={source.hint}
          className={cn(
            "rounded-pill shrink-0 border px-2 py-0.5 text-[0.625rem] font-semibold",
            TONE_BORDER[source.tone]
          )}
        >
          {source.label}
        </span>
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1">
        <span className="text-caption text-content-secondary">
          {confidenceLabel(fact.confidence)}
          <span className="text-content-muted"> ({Math.round(fact.confidence * 100)}%)</span>
        </span>
        <span className="text-caption text-content-muted">{fact.kind.toLowerCase()}</span>
        <span className="text-caption text-content-muted">{timeAgo(fact.createdAt)}</span>
        {superseded ? (
          <span className="text-caption text-warning font-medium">Replaced</span>
        ) : null}
        {fact.expiresAt ? (
          <span className="text-caption text-content-muted">expires {timeAgo(fact.expiresAt)}</span>
        ) : null}
      </div>

      {fact.sourceRef ? (
        <p className="text-caption text-content-muted mt-1 truncate" title={fact.sourceRef}>
          from {fact.sourceRef}
        </p>
      ) : null}

      {onHistory || onForget ? (
        <div className="mt-2.5 flex flex-wrap gap-2">
          {onHistory ? (
            <button
              type="button"
              onClick={() => onHistory(fact.key)}
              className="focus-ring rounded-control text-caption text-brand font-medium"
            >
              How this changed
            </button>
          ) : null}
          {onForget ? (
            <button
              type="button"
              onClick={() => onForget(fact.key)}
              className="focus-ring rounded-control text-caption text-danger font-medium"
            >
              Forget this
            </button>
          ) : null}
        </div>
      ) : null}
    </article>
  );
}
