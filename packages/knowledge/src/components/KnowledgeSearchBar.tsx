"use client";

import { useId } from "react";

export interface KnowledgeSearchBarProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit?: (value: string) => void;
  placeholder?: string;
  /** How the search actually works, shown once rather than assumed. */
  method?: "LEXICAL" | "SEMANTIC" | "HYBRID";
  autoFocus?: boolean;
  busy?: boolean;
}

const METHOD_HINT: Record<string, string> = {
  LEXICAL: "Matches words, not meaning — use the term the policy or circular uses.",
  SEMANTIC: "Understands meaning as well as words.",
  HYBRID: "Matches both wording and meaning.",
};

/**
 * The search box.
 *
 * A real `<form>` with `role="search"`, so Enter submits and assistive
 * technology can jump straight to it.
 *
 * The method hint is the important part. Search here is lexical, and an advisor
 * who assumes it is semantic stops after one empty page — for a regulation
 * lookup, that is how somebody gives advice the platform could have corrected.
 * Saying so costs one line and prevents that.
 */
export function KnowledgeSearchBar({
  value,
  onChange,
  onSubmit,
  placeholder = "Search guidance, circulars and procedures",
  method = "LEXICAL",
  autoFocus,
  busy,
}: KnowledgeSearchBarProps) {
  const inputId = useId();
  const hintId = useId();

  return (
    <form
      role="search"
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit?.(value);
      }}
      className="flex flex-col gap-1.5"
    >
      <label htmlFor={inputId} className="sr-only">
        Search knowledge
      </label>
      <div className="flex gap-2">
        <input
          id={inputId}
          type="search"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder={placeholder}
          aria-describedby={hintId}
          // Opt-in only. Callers set it on a page whose whole purpose is
          // search; auto-focusing a box that is one of several controls moves
          // somebody's cursor out from under them.
          autoFocus={autoFocus}
          className="rounded-control border-line/60 bg-surface-raised/40 text-body-sm text-content placeholder:text-content-muted focus:border-brand focus:ring-brand/40 h-10 flex-1 border px-3 focus:ring-2 focus:outline-none"
        />
        <button
          type="submit"
          disabled={busy}
          className="focus-ring rounded-control bg-brand text-brand-fg hover:bg-brand-hover text-caption px-4 font-semibold transition-colors disabled:opacity-50"
        >
          {busy ? "Searching…" : "Search"}
        </button>
      </div>
      <p id={hintId} className="text-caption text-content-muted text-pretty">
        {METHOD_HINT[method]}
      </p>
    </form>
  );
}
