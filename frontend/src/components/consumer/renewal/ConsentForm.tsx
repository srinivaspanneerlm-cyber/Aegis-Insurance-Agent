"use client";

import { useState } from "react";
import { Info, Loader2, ShieldCheck } from "lucide-react";
import { cn } from "@/lib/cn";
import { localise } from "@/lib/documents/localise";
import type { DocumentLocale } from "@/types/documents";
import {
  CHANNEL_CHOICES,
  CONSENT_EXPLAINER,
  CONSENT_TEXT,
  channelNeedsPhone,
} from "@/lib/consumer/renewal";
import type { ContactChannel } from "@/services/api";

/**
 * The consent screen.
 *
 * One screen, not a flow, and that is the design. Somebody agreeing to be
 * telephoned should be able to see, without scrolling past anything, what they
 * are agreeing to, who will do it, how, and how to stop it. A wizard that puts
 * the agreement on a later step is one where the agreement is what people click
 * through to finish.
 *
 * Three rules it holds to:
 *
 *   • **The agreement is unticked and the button is disabled until it is not.**
 *     No pre-ticked box, no "by continuing you agree". Consent that was never
 *     an action is not consent.
 *   • **The reminder is a second, separate tick.** Being helped once and being
 *     contacted every year are different asks, and the API stores them as two
 *     records for exactly that reason.
 *   • **The full wording is on screen.** Not behind a link, not in a scroll box
 *     with the button visible above it.
 */

const COPY = {
  step1: { en: "How should we contact you?", ta: "எப்படித் தொடர்பு கொள்ளட்டும்?", taEn: "Eppadi contact pannanum?" },
  step2: { en: "Your agreement", ta: "உங்கள் ஒப்புதல்", taEn: "Ungal oppudhal" },
  phone: { en: "Number to reach you on", ta: "உங்களைத் தொடர்பு கொள்ள எண்", taEn: "Ungala contact panna number" },
  phoneHint: {
    en: "Only used for this request. We do not store it against your account.",
    ta: "இந்தக் கோரிக்கைக்கு மட்டுமே பயன்படும். உங்கள் கணக்கில் இதைச் சேமிப்பதில்லை.",
    taEn: "Indha request-ku mattum thaan use aagum. Ungal account-la idha save panradhilla.",
  },
  remind: {
    en: "Also remind me next time",
    ta: "அடுத்த முறையும் நினைவூட்டுங்கள்",
    taEn: "Adutha vaatiyum nyaabagapaduthunga",
  },
  submit: { en: "Send my request", ta: "என் கோரிக்கையை அனுப்புங்கள்", taEn: "En request-a anuppunga" },
  sending: { en: "Sending…", ta: "அனுப்புகிறோம்…", taEn: "Anuppurom…" },
  cancel: { en: "Not now", ta: "இப்போது வேண்டாம்", taEn: "Ippo vendaam" },
};

export interface ConsentFormProps {
  locale?: DocumentLocale;
  /** Persists the request. Rejects with a message the customer can read. */
  onSubmit: (payload: {
    preferredChannel: ContactChannel;
    contactPhone?: string | null;
    alsoRemind: boolean;
    agreed: true;
  }) => Promise<void>;
  onCancel?: () => void;
}

export function ConsentForm({ locale = "en", onSubmit, onCancel }: ConsentFormProps) {
  const [channel, setChannel] = useState<ContactChannel | "">("");
  const [phone, setPhone] = useState("");
  const [agreed, setAgreed] = useState(false);
  const [alsoRemind, setAlsoRemind] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const needsPhone = channelNeedsPhone(channel);
  const phoneGiven = phone.replace(/\D/g, "").length >= 8;

  // Every condition is visible here rather than spread through the markup: the
  // button is live only when a channel is chosen, a number is there if the
  // channel needs one, and the agreement has actually been ticked.
  const ready = channel !== "" && (!needsPhone || phoneGiven) && agreed;

  const submit = async () => {
    // `ready` already implies a channel was chosen; narrowing again keeps that
    // implication out of the type system's hands rather than asserting it.
    if (!ready || !channel) return;
    setSubmitting(true);
    setError(null);
    try {
      await onSubmit({
        preferredChannel: channel,
        ...(needsPhone ? { contactPhone: phone.trim() } : {}),
        alsoRemind,
        agreed: true,
      });
    } catch (caught) {
      const message =
        (caught as { response?: { data?: { message?: string } } })?.response?.data?.message ??
        "We could not send that just now. Please try again.";
      setError(message);
      setSubmitting(false);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      {/* Step one: how. */}
      <fieldset className="flex flex-col gap-3">
        <legend className="text-sm font-bold text-content">{localise(COPY.step1, locale)}</legend>

        <div className="flex flex-col gap-2">
          {CHANNEL_CHOICES.map((choice) => {
            const Icon = choice.icon;
            const selected = channel === choice.id;
            return (
              <label
                key={choice.id}
                data-testid={`channel-${choice.id}`}
                data-selected={selected}
                className={cn(
                  "flex min-h-[64px] cursor-pointer items-center gap-3 rounded-2xl border p-4 transition-colors",
                  selected
                    ? "border-brand bg-brand/5"
                    : "border-line bg-surface-raised hover:border-brand/40"
                )}
              >
                <input
                  type="radio"
                  name="preferredChannel"
                  value={choice.id}
                  checked={selected}
                  onChange={() => setChannel(choice.id)}
                  className="h-5 w-5 shrink-0 accent-[var(--brand,#4f46e5)]"
                />
                <Icon className="h-5 w-5 shrink-0 text-content-muted" aria-hidden="true" />
                <span className="flex min-w-0 flex-col">
                  <span className="text-sm font-bold text-content">
                    {localise(choice.label, locale)}
                  </span>
                  <span className="text-xs font-medium text-content-muted">
                    {localise(choice.detail, locale)}
                  </span>
                </span>
              </label>
            );
          })}
        </div>

        {needsPhone && (
          <div className="flex flex-col gap-1.5">
            <label htmlFor="contactPhone" className="text-sm font-bold text-content">
              {localise(COPY.phone, locale)}
            </label>
            <p id="contactPhone-hint" className="text-xs font-medium text-content-muted">
              {localise(COPY.phoneHint, locale)}
            </p>
            <input
              id="contactPhone"
              name="contactPhone"
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              value={phone}
              aria-describedby="contactPhone-hint"
              onChange={(event) => setPhone(event.target.value)}
              className="w-full rounded-2xl border border-line bg-surface-raised px-4 py-3.5 text-base font-medium text-content focus:border-brand focus:outline-none focus-visible:ring-2 focus-visible:ring-brand/40"
            />
          </div>
        )}
      </fieldset>

      {/* Step two: the agreement, in full, on the same screen. */}
      <section aria-labelledby="agreement-heading" className="flex flex-col gap-3">
        <h2 id="agreement-heading" className="flex items-center gap-2 text-sm font-bold text-content">
          <ShieldCheck className="h-4 w-4 shrink-0 text-content-muted" aria-hidden="true" />
          {localise(COPY.step2, locale)}
        </h2>

        <p
          data-testid="consent-explainer"
          className="flex gap-2 rounded-2xl bg-surface-sunken/60 p-4 text-xs font-medium leading-relaxed text-content-muted"
        >
          <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          <span>{localise(CONSENT_EXPLAINER, locale)}</span>
        </p>

        <label className="flex cursor-pointer items-start gap-3 rounded-2xl border border-line bg-surface-raised p-4">
          <input
            type="checkbox"
            name="agreed"
            checked={agreed}
            onChange={(event) => setAgreed(event.target.checked)}
            className="mt-0.5 h-5 w-5 shrink-0 accent-[var(--brand,#4f46e5)]"
          />
          <span
            data-testid="consent-text"
            className="text-sm font-medium leading-relaxed text-content"
          >
            {localise(CONSENT_TEXT.RENEWAL_ASSISTANCE, locale)}
          </span>
        </label>

        <label className="flex cursor-pointer items-start gap-3 rounded-2xl border border-line bg-surface-raised p-4">
          <input
            type="checkbox"
            name="alsoRemind"
            checked={alsoRemind}
            onChange={(event) => setAlsoRemind(event.target.checked)}
            className="mt-0.5 h-5 w-5 shrink-0 accent-[var(--brand,#4f46e5)]"
          />
          <span className="flex min-w-0 flex-col gap-1">
            <span className="text-sm font-bold text-content">{localise(COPY.remind, locale)}</span>
            <span className="text-xs font-medium leading-relaxed text-content-muted">
              {localise(CONSENT_TEXT.RENEWAL_REMINDER, locale)}
            </span>
          </span>
        </label>
      </section>

      {error && (
        <p
          role="alert"
          className="rounded-2xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-900 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200"
        >
          {error}
        </p>
      )}

      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onCancel}
          disabled={submitting}
          className="inline-flex min-h-[52px] items-center rounded-2xl border border-line bg-surface-raised px-5 text-sm font-bold text-content disabled:opacity-50"
        >
          {localise(COPY.cancel, locale)}
        </button>

        <button
          type="button"
          data-testid="consent-submit"
          onClick={submit}
          disabled={!ready || submitting}
          className="inline-flex min-h-[52px] flex-1 items-center justify-center gap-2 rounded-2xl bg-brand px-5 text-sm font-bold text-white transition-colors hover:bg-brand-strong disabled:opacity-50"
        >
          {submitting && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
          {localise(submitting ? COPY.sending : COPY.submit, locale)}
        </button>
      </div>
    </div>
  );
}
