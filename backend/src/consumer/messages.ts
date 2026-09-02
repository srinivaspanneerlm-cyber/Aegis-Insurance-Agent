/**
 * What a customer actually reads.
 *
 * The engine in `renewalStatus.ts` returns keys, never sentences. That split is
 * the point: the arithmetic has one right answer and the wording has three, and
 * a function that returned English prose would have quietly made English the
 * only language the product works in.
 *
 * Tamil and Thanglish are first-class here rather than a later translation
 * pass. The people this product is for — first-time buyers, senior citizens,
 * rural households — are the ones most likely to be reading in Tamil, and a
 * renewal warning they cannot read is a renewal warning that did not happen.
 *
 * Two rules govern every string below, and both are enforced by tests rather
 * than by review:
 *
 *   1. **English is always present.** Tamil and Thanglish are optional and fall
 *      back, so a half-translated catalogue degrades to English instead of
 *      rendering a blank label at the top of somebody's policy screen.
 *   2. **Nothing accuses anybody.** No string here says fraud, fake, suspicious,
 *      invalid or rejected. This copy is shown to the person who typed the
 *      details, about their own paperwork, and an accusation is both
 *      unactionable and — far more often than not — wrong.
 */
import type { RenewalActionKey, RenewalMessageKey } from "./renewalStatus";

/**
 * Customer-facing copy in the three languages the platform speaks.
 *
 * Mirrors `LocalisedText` in `frontend/src/types/documents.ts` deliberately, so
 * a string can move between the API and the portal without being reshaped. The
 * two are not imported across the service boundary — they are re-declared,
 * because a shared type between a Node service and a Next app is a build
 * coupling neither of them needs.
 */
export interface LocalisedText {
  readonly en: string;
  readonly ta?: string;
  readonly taEn?: string;
}

export const CONSUMER_LOCALES = ["en", "ta", "taEn"] as const;
export type ConsumerLocale = (typeof CONSUMER_LOCALES)[number];

export const isConsumerLocale = (value: unknown): value is ConsumerLocale =>
  typeof value === "string" && (CONSUMER_LOCALES as readonly string[]).includes(value);

/**
 * Resolve copy for a locale.
 *
 * Thanglish falls back to Tamil before English, not straight to English: a
 * Thanglish reader understands the Tamil line, so it is the closer of the two.
 * Mirrors `localise()` in `frontend/src/lib/documents/localise.ts`.
 */
export function localise(text: LocalisedText, locale: ConsumerLocale = "en"): string {
  if (locale === "ta") return text.ta || text.en;
  if (locale === "taEn") return text.taEn || text.ta || text.en;
  return text.en;
}

// ── The mandated disclaimer ──────────────────────────────────────────────────

/**
 * Shown with every renewal result, without exception.
 *
 * A single exported constant rather than a string repeated per screen, because
 * the English wording is fixed by the product specification and the failure
 * mode of copy-pasting it is one screen quietly drifting into a promise the
 * platform cannot keep.
 */
export const GUIDANCE_DISCLAIMER: LocalisedText = {
  en: "Guidance only. Exact coverage, eligibility and renewal terms depend on official policy wording and insurer/partner confirmation.",
  ta: "வழிகாட்டுதல் மட்டுமே. சரியான கவரேஜ், தகுதி மற்றும் புதுப்பிப்பு விதிமுறைகள் அதிகாரப்பூர்வ பாலிசி வாசகம் மற்றும் காப்பீட்டு நிறுவனம்/பங்குதாரர் உறுதிப்படுத்தலைப் பொறுத்தே அமையும்.",
  taEn: "Idhu guidance mattum thaan. Exact coverage, eligibility, renewal terms ellaam official policy wording-um insurer/partner confirmation-um thaan decide pannum.",
};

/**
 * Which wording was shown, so a stored record can name it.
 *
 * Bump this whenever a string in this file changes meaning. A consent or an
 * audit row that says "v1" is only useful while v1 means one thing.
 */
export const CONSUMER_COPY_VERSION = "consumer-renewal-copy-v1";

// ── Status copy ──────────────────────────────────────────────────────────────

/**
 * One entry per band, keyed by what the engine emits.
 *
 * `Record<RenewalMessageKey, …>` rather than a loose object: adding a band to
 * the engine without writing its copy is then a compile error here, instead of
 * a customer seeing a raw key like `renewal.status.actionSoon` on screen.
 */
export const RENEWAL_STATUS_COPY: Record<RenewalMessageKey, LocalisedText> = {
  "renewal.status.active": {
    en: "Your policy is active. There is plenty of time before it needs renewing.",
    ta: "உங்கள் பாலிசி செயலில் உள்ளது. புதுப்பிக்க இன்னும் நிறைய நாட்கள் உள்ளன.",
    taEn: "Ungal policy active-a irukku. Renew panna innum niraiya naal irukku.",
  },
  "renewal.status.comingSoon": {
    en: "Your renewal is coming up. This is a good time to check what your policy covers.",
    ta: "உங்கள் பாலிசியின் புதுப்பிப்பு நெருங்குகிறது. உங்கள் பாலிசி எதையெல்லாம் உள்ளடக்கியது என்பதைப் பார்க்க இது நல்ல நேரம்.",
    taEn: "Ungal renewal nerungudhu. Policy-la enna cover aagudhu-nu paakka idhu nalla time.",
  },
  "renewal.status.actionSoon": {
    en: "Your policy expires within a month. It is worth starting the renewal now.",
    ta: "உங்கள் பாலிசி ஒரு மாதத்திற்குள் காலாவதியாகிறது. இப்போதே புதுப்பிப்பைத் தொடங்குவது நல்லது.",
    taEn: "Oru month-ukkulla ungal policy mudinjidum. Ippove renewal start panradhu nalladhu.",
  },
  "renewal.status.urgent": {
    en: "Your policy expires in a few days. Renewing now avoids a gap in your cover.",
    ta: "உங்கள் பாலிசி சில நாட்களில் காலாவதியாகிறது. இப்போதே புதுப்பித்தால் உங்கள் பாதுகாப்பில் இடைவெளி வராது.",
    taEn: "Konja naal-la ungal policy mudinjidum. Ippove renew panna cover-la gap varaadhu.",
  },
  "renewal.status.mayBeExpired": {
    en: "Your policy may have expired. Driving without valid cover is an offence, so please check with your insurer straight away.",
    ta: "உங்கள் பாலிசி காலாவதியாகி இருக்கலாம். செல்லுபடியாகும் காப்பீடு இல்லாமல் வாகனம் ஓட்டுவது குற்றம், எனவே உடனடியாக உங்கள் காப்பீட்டு நிறுவனத்திடம் உறுதிப்படுத்திக் கொள்ளுங்கள்.",
    taEn: "Ungal policy expire aagi irukkalaam. Valid cover illaama vandi ottaradhu offence, so udane insurer-kitta check pannunga.",
  },
  "renewal.status.unknown": {
    en: "We do not have an expiry date for this policy yet, so we cannot tell you how long is left.",
    ta: "இந்தப் பாலிசிக்கான காலாவதி தேதி எங்களிடம் இன்னும் இல்லை, எனவே எத்தனை நாட்கள் உள்ளன என்று சொல்ல முடியவில்லை.",
    taEn: "Indha policy-kku expiry date engalukku innum theriyala, adhanaala ethana naal iruku-nu sollala.",
  },
};

// ── Next-action copy ─────────────────────────────────────────────────────────

/**
 * Every result carries one of these.
 *
 * A status with no next step leaves somebody informed and stuck, which for a
 * customer with a week left on their cover is worse than useless. Even "nothing
 * to do" is stated, so the absence of an action is a decision rather than an
 * omission.
 */
export const RENEWAL_ACTION_COPY: Record<RenewalActionKey, LocalisedText> = {
  "renewal.action.noneNeeded": {
    en: "Nothing to do right now. We will remind you when it is time.",
    ta: "இப்போது எதுவும் செய்யத் தேவையில்லை. நேரம் வரும்போது நாங்கள் நினைவூட்டுவோம்.",
    taEn: "Ippo onnum panna vendaam. Time varumbodhu naanga nyaabagapaduthurom.",
  },
  "renewal.action.reviewCover": {
    en: "Have a look at what your policy covers. Renewal is the easiest time to change it.",
    ta: "உங்கள் பாலிசி எதையெல்லாம் உள்ளடக்கியது என்று பாருங்கள். மாற்றங்கள் செய்ய புதுப்பிப்பு நேரமே எளிதானது.",
    taEn: "Ungal policy-la enna cover aagudhu-nu paarunga. Maathanum-na renewal time thaan easy.",
  },
  "renewal.action.startRenewal": {
    en: "Start your renewal now so you are not rushed later. We can help.",
    ta: "பிறகு அவசரப்படாமல் இருக்க இப்போதே புதுப்பிப்பைத் தொடங்குங்கள். நாங்கள் உதவுகிறோம்.",
    taEn: "Appuram avasarapadaama irukka ippove renewal start pannunga. Naanga help panrom.",
  },
  "renewal.action.renewNow": {
    en: "Renew now. Ask us for help if you are not sure where to start.",
    ta: "இப்போதே புதுப்பியுங்கள். எங்கிருந்து தொடங்குவது என்று தெரியவில்லை என்றால் எங்களிடம் உதவி கேளுங்கள்.",
    taEn: "Ippove renew pannunga. Enga irundhu start panradhu-nu theriyalana engakitta kelunga.",
  },
  "renewal.action.checkImmediately": {
    en: "Check with your insurer today. If it has lapsed, we can help you get covered again.",
    ta: "இன்றே உங்கள் காப்பீட்டு நிறுவனத்திடம் உறுதிப்படுத்துங்கள். காலாவதியாகி இருந்தால், மீண்டும் பாதுகாப்பு பெற நாங்கள் உதவுகிறோம்.",
    taEn: "Innaikke insurer-kitta check pannunga. Lapse aagi irundha, thirumba cover edukka naanga help panrom.",
  },
  "renewal.action.addExpiryDate": {
    en: "Add the expiry date from your policy certificate and we will work out the rest.",
    ta: "உங்கள் பாலிசி சான்றிதழில் உள்ள காலாவதி தேதியைச் சேர்த்தால், மீதியை நாங்கள் கணக்கிடுகிறோம்.",
    taEn: "Ungal policy certificate-la irukka expiry date-a add pannunga, meedhi-ya naanga paathukurom.",
  },
};

// ── Resolution ───────────────────────────────────────────────────────────────

export interface ResolvedRenewalCopy {
  readonly status: string;
  readonly nextAction: string;
  readonly disclaimer: string;
  readonly copyVersion: string;
}

/**
 * The three strings a renewal result is rendered from, in one locale.
 *
 * The disclaimer is returned alongside rather than left to the caller, so
 * "forgot to show the disclaimer" is not a thing a screen can do by omission.
 */
export function resolveRenewalCopy(
  messageKey: RenewalMessageKey,
  nextActionKey: RenewalActionKey,
  locale: ConsumerLocale = "en"
): ResolvedRenewalCopy {
  return {
    status: localise(RENEWAL_STATUS_COPY[messageKey], locale),
    nextAction: localise(RENEWAL_ACTION_COPY[nextActionKey], locale),
    disclaimer: localise(GUIDANCE_DISCLAIMER, locale),
    copyVersion: CONSUMER_COPY_VERSION,
  };
}
