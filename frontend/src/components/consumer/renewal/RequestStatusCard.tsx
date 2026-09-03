"use client";

import { useState } from "react";
import { Clock, Loader2, ShieldOff } from "lucide-react";
import { cn } from "@/lib/cn";
import { localise } from "@/lib/documents/localise";
import type { DocumentLocale } from "@/types/documents";
import {
  CHANNEL_CHOICES,
  REQUEST_STATUS_EXPLAINER,
  REQUEST_STATUS_TONE,
  channelChoice,
} from "@/lib/consumer/renewal";
import type { ConsentRecord, RenewalRequest } from "@/services/api";

/**
 * Where a request has got to, and how to stop it.
 *
 * The status word comes from the API already in words — but "Partner handoff"
 * is an operations term, and a customer who reads it has been told a piece of
 * internal vocabulary rather than what is happening to them. So the explanation
 * beneath it is the part that matters, and it is the part written in their
 * language.
 *
 * Withdrawal sits on the same card as the status, not in a settings screen. The
 * moment somebody wants to stop being contacted is the moment they are looking
 * at the thing that will contact them.
 */

const TONE_CLASS: Record<string, string> = {
  neutral: "border-line bg-surface-sunken text-content",
  active: "border-sky-300 bg-sky-50 text-sky-900 dark:border-sky-500/30 dark:bg-sky-500/10 dark:text-sky-200",
  settled: "border-emerald-300 bg-emerald-50 text-emerald-900 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-200",
};

const COPY = {
  raised: { en: "Asked on", ta: "கேட்ட தேதி", taEn: "Kettha date" },
  how: { en: "You asked to be contacted by", ta: "தொடர்பு கொள்ளும் வழி", taEn: "Contact panra vazhi" },
  permissions: {
    en: "What you have agreed to",
    ta: "நீங்கள் ஒப்புக்கொண்டவை",
    taEn: "Neenga oppukondadhu",
  },
  stop: { en: "Stop this", ta: "இதை நிறுத்துங்கள்", taEn: "Idha niruthhunga" },
  stopping: { en: "Stopping…", ta: "நிறுத்துகிறோம்…", taEn: "Niruthhurom…" },
  stopped: { en: "Stopped", ta: "நிறுத்தப்பட்டது", taEn: "Niruthhiduchu" },
  purposeAssist: {
    en: "Being contacted about this renewal",
    ta: "இந்தப் புதுப்பிப்பு குறித்துத் தொடர்பு கொள்வது",
    taEn: "Indha renewal pathi contact panradhu",
  },
  purposeRemind: {
    en: "Being reminded next time",
    ta: "அடுத்த முறை நினைவூட்டுவது",
    taEn: "Adutha vaati nyaabagapaduthuradhu",
  },
  nothingChanges: {
    en: "Stopping this changes nothing about your policy. It stays exactly as you entered it.",
    ta: "இதை நிறுத்துவதால் உங்கள் பாலிசியில் எதுவும் மாறாது. நீங்கள் பதிவு செய்தபடியே இருக்கும்.",
    taEn: "Idha niruthhinaa ungal policy-la onnum maaraadhu. Neenga podadhu padiye irukkum.",
  },
};

const DATE = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "long", year: "numeric" });
const formatDate = (iso: string) => DATE.format(new Date(iso));

export interface RequestStatusCardProps {
  request: RenewalRequest;
  /** The permissions given for this policy, live and withdrawn alike. */
  consents: ConsentRecord[];
  locale?: DocumentLocale;
  onWithdraw: (consentId: string) => Promise<void>;
}

export function RequestStatusCard({
  request,
  consents,
  locale = "en",
  onWithdraw,
}: RequestStatusCardProps) {
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const chosen = channelChoice(request.preferredChannel) ?? CHANNEL_CHOICES[0];
  const explainer = REQUEST_STATUS_EXPLAINER[request.status];
  const tone = REQUEST_STATUS_TONE[request.status] ?? "neutral";

  const stop = async (consentId: string) => {
    setBusy(consentId);
    setError(null);
    try {
      await onWithdraw(consentId);
    } catch {
      setError("We could not stop that just now. Please try again.");
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="flex flex-col gap-5">
      <section
        data-testid="request-status"
        data-status={request.status}
        aria-labelledby="request-status-heading"
        className={cn("flex flex-col gap-3 rounded-4xl border p-5", TONE_CLASS[tone])}
      >
        <h2 id="request-status-heading" className="flex items-center gap-2 text-sm font-bold">
          <Clock className="h-4 w-4 shrink-0" aria-hidden="true" />
          {request.statusLabel}
        </h2>

        {explainer && (
          <p className="text-sm font-medium leading-relaxed">{localise(explainer, locale)}</p>
        )}

        <dl className="flex flex-col gap-1 text-xs font-medium opacity-90">
          <div className="flex gap-2">
            <dt>{localise(COPY.raised, locale)}:</dt>
            <dd className="font-bold">{formatDate(request.createdAt)}</dd>
          </div>
          <div className="flex gap-2">
            <dt>{localise(COPY.how, locale)}:</dt>
            <dd className="font-bold">{localise(chosen.label, locale)}</dd>
          </div>
        </dl>
      </section>

      <section aria-labelledby="permissions-heading" className="flex flex-col gap-3">
        <h2 id="permissions-heading" className="text-sm font-bold text-content">
          {localise(COPY.permissions, locale)}
        </h2>

        <ul className="flex flex-col gap-2">
          {consents.map((consent) => (
            <li
              key={consent.id}
              data-testid={`consent-${consent.purpose}`}
              className="flex items-center gap-3 rounded-2xl border border-line bg-surface-raised p-4"
            >
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="text-sm font-semibold text-content">
                  {localise(
                    consent.purpose === "RENEWAL_REMINDER" ? COPY.purposeRemind : COPY.purposeAssist,
                    locale
                  )}
                </span>
                <span className="text-xs font-medium text-content-subtle">
                  {localise(chosen.label, locale)} ·{" "}
                  {consent.active
                    ? formatDate(consent.grantedAt)
                    : `${localise(COPY.stopped, locale)} · ${formatDate(consent.withdrawnAt as string)}`}
                </span>
              </span>

              {consent.active ? (
                <button
                  type="button"
                  disabled={busy === consent.id}
                  onClick={() => void stop(consent.id)}
                  className="inline-flex min-h-[44px] shrink-0 items-center gap-1.5 rounded-xl border border-line px-3 text-xs font-bold text-content-muted transition-colors hover:border-rose-300 hover:text-rose-600 disabled:opacity-50 dark:hover:border-rose-500/40 dark:hover:text-rose-400"
                >
                  {busy === consent.id ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                  ) : (
                    <ShieldOff className="h-3.5 w-3.5" aria-hidden="true" />
                  )}
                  {localise(busy === consent.id ? COPY.stopping : COPY.stop, locale)}
                </button>
              ) : (
                <span className="shrink-0 text-xs font-bold text-content-subtle">
                  {localise(COPY.stopped, locale)}
                </span>
              )}
            </li>
          ))}
        </ul>

        {/* The fear this addresses is real and common: that saying "stop calling
            me" will cost them the cover they already have. */}
        <p className="text-xs font-medium leading-relaxed text-content-subtle">
          {localise(COPY.nothingChanges, locale)}
        </p>

        {error && (
          <p role="alert" className="text-sm font-semibold text-rose-600 dark:text-rose-400">
            {error}
          </p>
        )}
      </section>
    </div>
  );
}
