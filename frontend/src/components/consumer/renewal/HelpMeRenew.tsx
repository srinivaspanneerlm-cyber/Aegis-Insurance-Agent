"use client";

import Link from "next/link";
import { LifeBuoy } from "lucide-react";
import { localise } from "@/lib/documents/localise";
import type { DocumentLocale } from "@/types/documents";
import type { ConsumerPolicy } from "@/services/api";

/**
 * Help Me Renew.
 *
 * Deliberately not on every policy, and not the loudest thing on the screen. A
 * customer whose cover has eight months left does not need a renewal button;
 * showing one anyway is how a guidance product starts reading as a sales
 * funnel, which is the thing this product is defined against.
 *
 * So it appears when the renewal engine says the policy is inside its renewal
 * window — or when it has no expiry date at all, because somebody who cannot
 * tell us when their cover ends is exactly who most needs a person to talk to.
 *
 * It offers a conversation and says so. "Get a quote" would be a promise this
 * milestone cannot keep: no price is produced anywhere in this flow.
 */

const COPY = {
  heading: {
    en: "Would you like help renewing?",
    ta: "புதுப்பிக்க உதவி வேண்டுமா?",
    taEn: "Renew panna help venuma?",
  },
  body: {
    en: "Someone from Aegis can talk it through with you — what you have, what it would cost to keep, and what your options are. It is free, and nothing is bought or sold here.",
    ta: "ஏஜிஸிலிருந்து ஒருவர் உங்களுடன் பேசுவார் — உங்களிடம் என்ன உள்ளது, அதைத் தொடர எவ்வளவு ஆகும், வேறு என்ன வழிகள் உள்ளன. இது இலவசம்; இங்கு எதுவும் வாங்கவோ விற்கவோ படுவதில்லை.",
    taEn: "Aegis-la irundhu oruthar ungaloda pesuvaanga — ungakitta enna irukku, adha thodara evvalavu aagum, vera enna vazhi irukku. Idhu free; inga onnum vaangavum illa vikkavum illa.",
  },
  cta: { en: "Help me renew", ta: "புதுப்பிக்க உதவுங்கள்", taEn: "Renew panna help pannunga" },
  pending: {
    en: "Your request is with us.",
    ta: "உங்கள் கோரிக்கை எங்களிடம் உள்ளது.",
    taEn: "Ungal request engakitta irukku.",
  },
  view: {
    en: "See where it has got to",
    ta: "எங்கு உள்ளது என்று பாருங்கள்",
    taEn: "Enga irukku-nu paarunga",
  },
};

/**
 * Whether this policy is at a point where a renewal conversation makes sense.
 *
 * Exported so the decision is testable on its own, rather than inferred from
 * whether a button rendered.
 */
export function shouldOfferRenewal(policy: ConsumerPolicy): boolean {
  if (!policy.renewal.ok) return true; // no expiry date — a person can help most
  return policy.renewal.status !== "ACTIVE";
}

export interface HelpMeRenewProps {
  policy: ConsumerPolicy;
  locale?: DocumentLocale;
  /** True when a request is already open, so the card reports rather than asks. */
  requestOpen?: boolean;
}

export function HelpMeRenew({ policy, locale = "en", requestOpen = false }: HelpMeRenewProps) {
  if (!shouldOfferRenewal(policy)) return null;

  return (
    <section
      data-testid="help-me-renew"
      aria-labelledby="renew-heading"
      className="flex flex-col gap-3 rounded-4xl border border-brand/25 bg-brand/5 p-5"
    >
      <h2 id="renew-heading" className="flex items-center gap-2 text-sm font-bold text-content">
        <LifeBuoy className="h-4 w-4 shrink-0 text-brand" aria-hidden="true" />
        {localise(COPY.heading, locale)}
      </h2>

      <p className="text-sm font-medium leading-relaxed text-content-muted">
        {requestOpen ? localise(COPY.pending, locale) : localise(COPY.body, locale)}
      </p>

      <Link
        href={`/consumer/policy/${policy.id}/renew`}
        data-testid="help-me-renew-cta"
        className="inline-flex min-h-[52px] items-center justify-center gap-2 rounded-2xl bg-brand px-5 text-sm font-bold text-white transition-colors hover:bg-brand-strong"
      >
        {localise(requestOpen ? COPY.view : COPY.cta, locale)}
      </Link>
    </section>
  );
}
