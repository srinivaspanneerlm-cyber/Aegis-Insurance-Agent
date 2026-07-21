"use client";

import { Sparkles } from "lucide-react";

interface SuggestedQuestionsProps {
  questions: string[];
  /** Called with the chosen question — the page routes it to the normal send. */
  onSelect: (question: string) => void;
  disabled?: boolean;
}

/**
 * Starter-question chips shown in the empty advisor state. Purely presentational:
 * it renders the questions and reports a click via `onSelect`; it holds no chat
 * state and never touches the streaming/voice path.
 */
export function SuggestedQuestions({ questions, onSelect, disabled = false }: SuggestedQuestionsProps) {
  if (questions.length === 0) return null;

  return (
    <div className="px-4 pb-3 pt-1 flex-shrink-0">
      <div className="flex items-center gap-1.5 mb-2 text-[10px] font-bold uppercase tracking-widest text-slate-500">
        <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
        <span>Not sure where to start? Try one of these</span>
      </div>
      <ul className="flex flex-wrap gap-2">
        {questions.map((q) => (
          <li key={q}>
            <button
              type="button"
              onClick={() => onSelect(q)}
              disabled={disabled}
              className="text-left text-[11px] font-semibold leading-snug rounded-xl border border-white/10 bg-white/[0.03] text-slate-300 px-3 py-2 transition-all hover:bg-white/[0.07] hover:text-white hover:border-cyan-400/30 disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/50"
            >
              {q}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
