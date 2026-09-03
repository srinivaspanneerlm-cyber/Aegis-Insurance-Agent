"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { BookOpen, Info, Loader2, MessageCircleQuestion, Send, Sparkles } from "lucide-react";
import { cn } from "@/lib/cn";
import { consumerService, type KuralAnswer, type KuralTopics } from "@/services/api";

/**
 * Aegis Kural Lite.
 *
 * Text only, six topics, no model. What is on screen is a transcript of fixed
 * answers the API chose between — nothing here composes a sentence, and that is
 * why the panel can be honest about its limits without hedging every reply.
 *
 * Three rules it holds to.
 *
 * **It says what it can answer before it is asked.** The six topics are chips
 * on the empty state, not a message shown after a failure. A customer who has to
 * discover the boundary by hitting it has already been told the product does not
 * work.
 *
 * **The three outcomes look different.** An answer, "that is outside what I
 * know", and "I could not read that" are drawn distinctly, because a screen that
 * renders them alike teaches somebody to keep rephrasing a question that was
 * never going to be answered.
 *
 * **Every reply ends with a person.** The offer comes from the API alongside the
 * answer, so a turn cannot render without it.
 */

interface Turn {
  readonly id: number;
  readonly question: string;
  readonly answer: KuralAnswer;
}

const OUTCOME_CLASS: Record<KuralAnswer["outcome"], string> = {
  ANSWERED: "border-line bg-surface-raised",
  NO_MATCH:
    "border-amber-300 bg-amber-50 dark:border-amber-500/30 dark:bg-amber-500/10",
  UNREADABLE: "border-line bg-surface-sunken",
};

export interface AskPanelProps {
  /** Attached to expiry questions so the answer can speak to their own policy. */
  policyId?: string | null;
  locale?: string;
}

export function AskPanel({ policyId = null, locale }: AskPanelProps) {
  const [intro, setIntro] = useState<KuralTopics | null>(null);
  const [question, setQuestion] = useState("");
  const [turns, setTurns] = useState<Turn[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const nextId = useRef(0);

  useEffect(() => {
    let cancelled = false;
    consumerService
      .getKuralTopics(locale)
      .then((data) => { if (!cancelled) setIntro(data); })
      // The suggestions failing is not a reason to withhold the box. Somebody
      // who knows what they want to ask can still ask it.
      .catch(() => { if (!cancelled) setIntro(null); });
    return () => { cancelled = true; };
  }, [locale]);

  const send = useCallback(
    async (asked: string) => {
      const trimmed = asked.trim();
      if (trimmed === "" || busy) return;

      setBusy(true);
      setError(null);
      try {
        const answer = await consumerService.askKural(trimmed, { policyId, ...(locale ? { locale } : {}) });
        nextId.current += 1;
        setTurns((current) => [...current, { id: nextId.current, question: trimmed, answer }]);
        setQuestion("");
      } catch (caught) {
        // Only a real failure reaches here — "I do not know" arrives as a 200.
        const message =
          (caught as { response?: { data?: { message?: string } } })?.response?.data?.message ??
          "We could not reach the assistant just now. Please try again.";
        setError(message);
      } finally {
        setBusy(false);
      }
    },
    [busy, locale, policyId]
  );

  return (
    <div className="flex flex-col gap-5">
      {/* The transcript, or what can be asked. */}
      {turns.length === 0 ? (
        <section
          data-testid="kural-intro"
          aria-labelledby="kural-intro-heading"
          className="flex flex-col gap-3 rounded-4xl border border-line bg-surface-raised p-5"
        >
          <h2
            id="kural-intro-heading"
            className="flex items-center gap-2 text-sm font-bold text-content"
          >
            <Sparkles className="h-4 w-4 shrink-0 text-brand" aria-hidden="true" />
            Aegis Kural Lite
          </h2>

          <p className="text-sm font-medium leading-relaxed text-content-muted">
            {intro?.intro ??
              "Ask me about motor insurance basics. I answer from a small set of checked notes."}
          </p>

          {intro && intro.topics.length > 0 && (
            <ul className="flex flex-wrap gap-2">
              {intro.topics.map((topic) => (
                <li key={topic.topic}>
                  <button
                    type="button"
                    data-testid={`kural-topic-${topic.topic}`}
                    disabled={busy}
                    onClick={() => void send(topic.title)}
                    className="min-h-[44px] rounded-2xl border border-line bg-surface px-4 text-sm font-semibold text-content transition-colors hover:border-brand/50 disabled:opacity-50"
                  >
                    {topic.title}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
      ) : (
        <ol className="flex flex-col gap-4">
          {turns.map((turn) => (
            <li key={turn.id} className="flex flex-col gap-2">
              <p className="self-end rounded-2xl bg-brand px-4 py-2.5 text-sm font-semibold text-white">
                {turn.question}
              </p>

              <section
                data-testid="kural-answer"
                data-outcome={turn.answer.outcome}
                data-topic={turn.answer.topic ?? ""}
                className={cn("flex flex-col gap-3 rounded-4xl border p-5", OUTCOME_CLASS[turn.answer.outcome])}
              >
                <p className="text-sm font-medium leading-relaxed text-content">
                  {turn.answer.answer}
                </p>

                {/* The one place a fact about their own policy appears, and it
                    comes from the renewal engine rather than from anything the
                    assistant knows about insurance. */}
                {turn.answer.aboutYourPolicy && (
                  <div
                    data-testid="kural-about-your-policy"
                    className="flex flex-col gap-1 rounded-2xl border border-brand/20 bg-brand/5 p-4"
                  >
                    <p className="text-xs font-bold uppercase tracking-wide text-brand">
                      About your policy
                    </p>
                    <p className="text-sm font-semibold text-content">
                      {turn.answer.aboutYourPolicy.status}
                    </p>
                    <p className="text-sm font-medium text-content-muted">
                      {turn.answer.aboutYourPolicy.nextAction}
                    </p>
                  </div>
                )}

                {turn.answer.suggestions.length > 0 && (
                  <ul className="flex flex-wrap gap-2">
                    {turn.answer.suggestions.map((suggestion) => (
                      <li key={suggestion.topic}>
                        <button
                          type="button"
                          data-testid={`kural-suggestion-${suggestion.topic}`}
                          disabled={busy}
                          onClick={() => void send(suggestion.title)}
                          className="min-h-[40px] rounded-xl border border-line bg-surface px-3 text-xs font-bold text-content transition-colors hover:border-brand/50 disabled:opacity-50"
                        >
                          {suggestion.title}
                        </button>
                      </li>
                    ))}
                  </ul>
                )}

                {/* Where the answer came from. Shown rather than implied — a
                    checked answer that cannot be traced is just a confident one. */}
                {turn.answer.source && (
                  <p
                    data-testid="kural-source"
                    className="flex gap-2 text-xs font-medium text-content-subtle"
                  >
                    <BookOpen className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                    <span>From Aegis&rsquo;s checked notes ({turn.answer.source.kind}).</span>
                  </p>
                )}

                <p
                  data-testid="kural-scope-note"
                  className="flex gap-2 border-t border-line pt-3 text-xs font-medium leading-relaxed text-content-subtle"
                >
                  <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                  <span>
                    {turn.answer.scopeNote} {turn.answer.disclaimer}
                  </span>
                </p>

                <div
                  data-testid="kural-human-cta"
                  className="flex flex-col gap-2 rounded-2xl bg-surface-sunken/60 p-4"
                >
                  <p className="flex gap-2 text-xs font-medium leading-relaxed text-content-muted">
                    <MessageCircleQuestion className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                    <span>{turn.answer.humanCta}</span>
                  </p>
                  <Link
                    href={policyId ? `/consumer/policy/${policyId}/renew` : "/consumer/policy"}
                    className="inline-flex min-h-[44px] items-center justify-center rounded-2xl border border-brand/40 px-4 text-sm font-bold text-brand"
                  >
                    Talk to a person
                  </Link>
                </div>
              </section>
            </li>
          ))}
        </ol>
      )}

      {error && (
        <p
          role="alert"
          className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-800 dark:border-rose-500/25 dark:bg-rose-500/10 dark:text-rose-300"
        >
          {error}
        </p>
      )}

      <form
        className="flex items-end gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          void send(question);
        }}
      >
        <label htmlFor="kural-question" className="sr-only">
          Ask about motor insurance
        </label>
        <input
          id="kural-question"
          name="question"
          type="text"
          value={question}
          maxLength={500}
          autoComplete="off"
          placeholder="What is IDV?"
          onChange={(event) => setQuestion(event.target.value)}
          className="min-h-[52px] w-full rounded-2xl border border-line bg-surface-raised px-4 text-base font-medium text-content placeholder:text-content-subtle focus:border-brand focus:outline-none focus-visible:ring-2 focus-visible:ring-brand/40"
        />
        <button
          type="submit"
          data-testid="kural-send"
          disabled={busy || question.trim() === ""}
          className="inline-flex min-h-[52px] shrink-0 items-center gap-2 rounded-2xl bg-brand px-5 text-sm font-bold text-white transition-colors hover:bg-brand-strong disabled:opacity-50"
        >
          {busy ? (
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
          ) : (
            <Send className="h-4 w-4" aria-hidden="true" />
          )}
          Ask
        </button>
      </form>
    </div>
  );
}
