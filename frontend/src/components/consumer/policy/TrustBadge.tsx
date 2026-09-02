"use client";

import { CheckCircle2, FileQuestion, HelpCircle, Info, MessageCircleQuestion } from "lucide-react";
import { cn } from "@/lib/cn";
import { localise } from "@/lib/documents/localise";
import type { DocumentLocale } from "@/types/documents";
import { TRUST_STATE_META, TRUST_TONE_CLASS } from "@/lib/consumer/documents";
import type { ConsumerPolicy, TrustState } from "@/services/api";

/**
 * What Aegis can currently say about a policy.
 *
 * Two rules it will not break, both of them about not frightening somebody
 * about their own paperwork.
 *
 * The state is always words. Colour carries the same message a second time, for
 * people who read a screen quickly — never the only time, because a badge that
 * means something different in amber than in green is unreadable to somebody who
 * cannot tell them apart, and this screen is about whether they are insured.
 *
 * The scope note is rendered from the same object as the label, so no screen can
 * show "Details check out" without the sentence saying what was actually
 * checked. That sentence is the difference between an honest claim about our own
 * record and an implied promise that an insurer confirmed the cover.
 */

const ICONS: Record<TrustState, typeof Info> = {
  UPLOADED: FileQuestion,
  NEEDS_CONFIRMATION: HelpCircle,
  CONSISTENCY_VERIFIED: CheckCircle2,
  VERIFICATION_REQUIRED: MessageCircleQuestion,
};

/** The compact form, for a list row. Label only. */
export function TrustPill({
  state,
  locale = "en",
}: {
  state: TrustState;
  locale?: DocumentLocale;
}) {
  const meta = TRUST_STATE_META[state];
  const Icon = ICONS[state];

  return (
    <span
      data-testid="trust-pill"
      data-state={state}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-bold",
        TRUST_TONE_CLASS[meta.tone]
      )}
    >
      <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
      {localise(meta.short, locale)}
    </span>
  );
}

/**
 * The full form, for the policy's own screen: label, why, and what happens next.
 *
 * Takes no locale, deliberately. Every sentence it renders was resolved by the
 * API in the customer's language — a component holding its own copy would be a
 * second, English-only source of the same words, and the two would drift the
 * first time one of them was edited.
 */
export function TrustBadge({ policy }: { policy: ConsumerPolicy }) {
  const { trust, trustCopy } = policy;
  const meta = TRUST_STATE_META[trust.state];
  const Icon = ICONS[trust.state];

  return (
    <section
      data-testid="trust-badge"
      data-state={trust.state}
      aria-labelledby="trust-heading"
      className={cn("flex flex-col gap-3 rounded-4xl border p-5", TRUST_TONE_CLASS[meta.tone])}
    >
      <h2 id="trust-heading" className="flex items-center gap-2 text-sm font-bold">
        <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
        {trustCopy.label}
      </h2>

      <p className="text-sm font-medium leading-relaxed">{trustCopy.reason}</p>

      <p className="text-sm font-semibold leading-relaxed">{trustCopy.action}</p>

      {/* Required beside the badge, always. Rendered from the same object so the
          two cannot become separated by an edit to one screen. */}
      <p
        data-testid="trust-scope-note"
        className="flex gap-2 border-t border-current/15 pt-3 text-xs font-medium leading-relaxed opacity-80"
      >
        <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
        <span>{trustCopy.scopeNote}</span>
      </p>
    </section>
  );
}
