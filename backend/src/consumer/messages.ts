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
import type { TrustActionKey, TrustReasonKey, TrustState } from "./trustStatus";

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

// ── Trust copy ───────────────────────────────────────────────────────────────

/**
 * What each trust state is called, in words a customer would use.
 *
 * The state names themselves are not shown. "CONSISTENCY_VERIFIED" is a useful
 * label in a database and a frightening one on a screen, and "VERIFICATION
 * REQUIRED" in capitals reads as an accusation even though it is a request for
 * a conversation. The labels below are what appears; the states stay in the
 * record, where operations and the audit trail need them stable.
 */
export const TRUST_STATE_LABEL: Record<TrustState, LocalisedText> = {
  UPLOADED: {
    en: "As you entered it",
    ta: "நீங்கள் பதிவு செய்தபடி",
    taEn: "Neenga podadhu padiye",
  },
  NEEDS_CONFIRMATION: {
    en: "One thing to confirm",
    ta: "ஒன்றை உறுதிப்படுத்த வேண்டும்",
    taEn: "Onnu confirm panna venum",
  },
  CONSISTENCY_VERIFIED: {
    en: "Details check out",
    ta: "விவரங்கள் பொருந்துகின்றன",
    taEn: "Details sariyaa porundhudhu",
  },
  VERIFICATION_REQUIRED: {
    en: "We will check this with you",
    ta: "இதை உங்களுடன் சேர்ந்து பார்ப்போம்",
    taEn: "Idha ungaloda serndhu paapom",
  },
};

/**
 * Why the record is in that state.
 *
 * Every sentence describes the platform's own position — what we hold, what we
 * have not checked — rather than characterising the customer or their document.
 * The word "we" doing the not-knowing is deliberate throughout.
 */
export const TRUST_REASON_COPY: Record<TrustReasonKey, LocalisedText> = {
  "trust.reason.nothingAttached": {
    en: "This is exactly what you typed in. We have not compared it against your certificate yet.",
    ta: "நீங்கள் பதிவு செய்தது இதுதான். இதை உங்கள் சான்றிதழுடன் நாங்கள் இன்னும் ஒப்பிடவில்லை.",
    taEn: "Neenga type panna details ithu thaan. Ungal certificate-oda naanga innum compare pannala.",
  },
  "trust.reason.detailsIncomplete": {
    en: "A couple of details are still missing, so there is less for us to go on.",
    ta: "சில விவரங்கள் இன்னும் இல்லை, எனவே எங்களுக்குக் கிடைத்த தகவல் குறைவு.",
    taEn: "Konjam details innum illa, adhanaala engalukku thagaval korachal.",
  },
  "trust.reason.coverTypeUnknown": {
    en: "You told us you are not sure which kind of cover this is — which is a perfectly normal answer.",
    ta: "எந்த வகைப் பாதுகாப்பு என்று உறுதியாகத் தெரியவில்லை என்று சொன்னீர்கள் — அது முற்றிலும் சாதாரணமான பதில்.",
    taEn: "Enna vagai cover-nu ungalukku theriyala-nu sonneenga — adhu romba normal badhil.",
  },
  "trust.reason.alreadyExpired": {
    en: "The expiry date you gave us has already passed, so it is worth checking we have the right one.",
    ta: "நீங்கள் தந்த காலாவதி தேதி ஏற்கனவே கடந்துவிட்டது, எனவே சரியான தேதி உள்ளதா என்று பார்ப்பது நல்லது.",
    taEn: "Neenga kudutha expiry date already mudinjiduchu, so correct date-aa-nu paakradhu nalladhu.",
  },
  "trust.reason.documentMatchesAnotherPolicy": {
    en: "This is the same file you added to another policy. That often happens — one certificate can cover more than one thing, and files are easy to pick twice.",
    ta: "இதே கோப்பை வேறொரு பாலிசியிலும் சேர்த்துள்ளீர்கள். இது அடிக்கடி நடக்கும் — ஒரே சான்றிதழ் ஒன்றுக்கு மேற்பட்டவற்றை உள்ளடக்கலாம், கோப்புகளை இரண்டு முறை தேர்ந்தெடுப்பதும் எளிது.",
    taEn: "Idhe file-a innoru policy-la-um add pannirukeenga. Idhu adikkadi nadakkum — oru certificate-e paraya vishayangala cover pannalaam, file-a rendu vaati select panradhum easy.",
  },
  "trust.reason.policyNumberOnAnotherPolicy": {
    en: "This policy number is also on another of your policies. Usually that is a small typing slip, and we would rather ask than assume.",
    ta: "இந்தப் பாலிசி எண் உங்கள் மற்றொரு பாலிசியிலும் உள்ளது. பொதுவாக இது ஒரு சிறிய தட்டச்சுப் பிழை; ஊகிப்பதை விடக் கேட்பதே சரி என்று நினைக்கிறோம்.",
    taEn: "Indha policy number ungal innoru policy-la-um irukku. Usually idhu chinna typing thappu; nammalaave assume panradhukku badhil kekkalaam.",
  },
  "trust.reason.recordConsistent": {
    en: "Your details are complete and your certificate is on file. Everything we hold about this policy agrees with itself.",
    ta: "உங்கள் விவரங்கள் முழுமையாக உள்ளன, சான்றிதழும் சேமிக்கப்பட்டுள்ளது. இந்தப் பாலிசி குறித்து எங்களிடம் உள்ள அனைத்தும் ஒன்றுக்கொன்று பொருந்துகின்றன.",
    taEn: "Ungal details complete-a irukku, certificate-um file-la irukku. Indha policy pathi engakitta irukkura ellaame onnukkonnu porundhudhu.",
  },
};

/**
 * What to do about it.
 *
 * Present even for the settled state, so "nothing to do" is a decision rather
 * than an empty space a customer has to interpret.
 */
export const TRUST_ACTION_COPY: Record<TrustActionKey, LocalisedText> = {
  "trust.action.addDocument": {
    en: "Add a photo or PDF of your certificate if you have one handy. It is optional — everything here works without it.",
    ta: "உங்கள் சான்றிதழின் புகைப்படம் அல்லது PDF இருந்தால் சேர்க்கலாம். இது கட்டாயம் அல்ல — இல்லாமலும் எல்லாம் வேலை செய்யும்.",
    taEn: "Ungal certificate photo illa PDF irundha add pannunga. Idhu kandippa venaam — adhu illaamalum ellaam work aagum.",
  },
  "trust.action.completeDetails": {
    en: "Fill in the insurer and policy number when you have your certificate to hand.",
    ta: "உங்கள் சான்றிதழ் கையில் இருக்கும்போது காப்பீட்டு நிறுவனத்தையும் பாலிசி எண்ணையும் நிரப்புங்கள்.",
    taEn: "Certificate kaila irukkumbodhu insurer-um policy number-um fill pannunga.",
  },
  "trust.action.confirmCoverType": {
    en: "Ask our advisor to help you work out which cover you have — it takes a minute and we do not need the answer to help you.",
    ta: "எந்தப் பாதுகாப்பு உங்களிடம் உள்ளது என்பதைக் கண்டறிய எங்கள் ஆலோசகரிடம் கேளுங்கள் — ஒரு நிமிடம் போதும், உங்களுக்கு உதவ இந்தப் பதில் அவசியமும் இல்லை.",
    taEn: "Enna cover ungakitta irukku-nu kandupidikka engal advisor-kitta kelunga — oru nimisham podhum, help panna indha badhil avasiyamum illa.",
  },
  "trust.action.confirmExpiry": {
    en: "Check the date on your certificate and correct it here if it does not match. If it really has expired, we can help you sort it out.",
    ta: "உங்கள் சான்றிதழில் உள்ள தேதியைப் பாருங்கள்; பொருந்தவில்லை என்றால் இங்கே திருத்துங்கள். உண்மையிலேயே காலாவதியாகி இருந்தால், சரிசெய்ய நாங்கள் உதவுகிறோம்.",
    taEn: "Certificate-la irukka date-a paarunga; porundhalana inga correct pannunga. Nijamaave expire aagi irundha, sari panna naanga help panrom.",
  },
  "trust.action.weWillCheck": {
    en: "Nothing for you to do. We will go through it with you before we rely on it — and your policy details stay exactly as you entered them.",
    ta: "நீங்கள் எதுவும் செய்யத் தேவையில்லை. இதை நம்பி முடிவெடுப்பதற்கு முன் உங்களுடன் சேர்ந்து பார்ப்போம் — உங்கள் பாலிசி விவரங்கள் நீங்கள் பதிவு செய்தபடியே இருக்கும்.",
    taEn: "Neenga onnum panna vendaam. Idha nambi decide panradhukku munnadi ungaloda serndhu paapom — ungal policy details neenga podadhu padiye irukkum.",
  },
  "trust.action.nothingNeeded": {
    en: "Nothing to do. We will tell you when your renewal is coming up.",
    ta: "எதுவும் செய்யத் தேவையில்லை. புதுப்பிப்பு நெருங்கும்போது நாங்கள் சொல்கிறோம்.",
    taEn: "Onnum panna vendaam. Renewal nerungumbodhu naanga sollurom.",
  },
};

/**
 * Said wherever a trust state is shown.
 *
 * The specification's disclaimer covers what a *policy* means; this covers what
 * a *check* means, and the difference matters. "Details check out" could
 * otherwise be read as Aegis having confirmed the cover with the insurer, which
 * is a promise this milestone cannot keep and a dangerous one to imply to
 * somebody deciding whether they are insured.
 */
export const TRUST_SCOPE_NOTE: LocalisedText = {
  en: "These checks look at the details you gave us and whether they fit together. They are not a confirmation from your insurer.",
  ta: "இந்தச் சரிபார்ப்புகள் நீங்கள் தந்த விவரங்களையும் அவை ஒன்றுக்கொன்று பொருந்துகிறதா என்பதையும் மட்டுமே பார்க்கின்றன. இவை உங்கள் காப்பீட்டு நிறுவனத்தின் உறுதிப்படுத்தல் அல்ல.",
  taEn: "Indha check-ellaam neenga kudutha details-um adhu onnukkonnu porundhudhaa-nu mattum thaan paakkum. Idhu ungal insurer-oda confirmation illa.",
};

export interface ResolvedTrustCopy {
  readonly label: string;
  readonly reason: string;
  readonly action: string;
  readonly scopeNote: string;
  readonly copyVersion: string;
}

/** Everything a trust badge is rendered from, in one locale. */
export function resolveTrustCopy(
  state: TrustState,
  reasonKey: TrustReasonKey,
  actionKey: TrustActionKey,
  locale: ConsumerLocale = "en"
): ResolvedTrustCopy {
  return {
    label: localise(TRUST_STATE_LABEL[state], locale),
    reason: localise(TRUST_REASON_COPY[reasonKey], locale),
    action: localise(TRUST_ACTION_COPY[actionKey], locale),
    scopeNote: localise(TRUST_SCOPE_NOTE, locale),
    copyVersion: CONSUMER_COPY_VERSION,
  };
}

// ── Consent copy ─────────────────────────────────────────────────────────────

/**
 * The exact words somebody agrees to.
 *
 * This is the one catalogue in this file where the *string itself* is the
 * record. Everywhere else, copy is a rendering of a decision made elsewhere; a
 * consent is the wording, and "what were they shown" is the question a
 * regulator, an ombudsman or an angry customer asks first.
 *
 * So each entry is hashed and the hash is stored on the consent row alongside
 * the version. The version identifies the wording we *believe* was on screen;
 * the hash proves it. The two disagree the moment somebody edits a sentence
 * without bumping the version - which is exactly the mistake worth catching,
 * and a test in `tests/consumer.renewalLead.test.js` catches it.
 *
 * Written to be read, not to be scrolled past. Every line says who does what,
 * to whom, by which channel, and how to stop it.
 */
export const CONSENT_TEXT: Record<"RENEWAL_ASSISTANCE" | "RENEWAL_REMINDER", LocalisedText> = {
  RENEWAL_ASSISTANCE: {
    en: "I would like someone from Aegis to contact me about renewing this policy, using the way I have chosen above. Aegis is not an insurer and will not take any payment from me here. I can ask them to stop at any time, and my policy details stay exactly as I entered them.",
    ta: "இந்தப் பாலிசியைப் புதுப்பிப்பது குறித்து, நான் மேலே தேர்ந்தெடுத்த வழியில் ஏஜிஸ் நிறுவனத்திலிருந்து ஒருவர் என்னைத் தொடர்பு கொள்ள விரும்புகிறேன். ஏஜிஸ் ஒரு காப்பீட்டு நிறுவனம் அல்ல, இங்கு என்னிடமிருந்து எந்தப் பணமும் பெறாது. எப்போது வேண்டுமானாலும் நிறுத்தச் சொல்லலாம்; என் பாலிசி விவரங்கள் நான் பதிவு செய்தபடியே இருக்கும்.",
    taEn: "Indha policy renew panradhu pathi, naan mela select panna vazhiyila Aegis-la irundhu oruthar ennai contact panna virumbaren. Aegis oru insurance company illa, inga en kitta irundhu edhuvum panam vaangaadhu. Eppo venumnaalum niruthha sollalaam; en policy details naan podadhu padiye irukkum.",
  },
  RENEWAL_REMINDER: {
    en: "I would also like Aegis to remind me when this policy is coming up for renewal in future. This is a separate choice from the one above, and I can stop the reminders without stopping anything else.",
    ta: "எதிர்காலத்தில் இந்தப் பாலிசி புதுப்பிப்புக்கு வரும்போது ஏஜிஸ் எனக்கு நினைவூட்ட வேண்டும் என்றும் விரும்புகிறேன். இது மேலே உள்ளதிலிருந்து தனிப்பட்ட தேர்வு; மற்றவற்றை நிறுத்தாமல் இந்த நினைவூட்டல்களை மட்டும் நிறுத்த முடியும்.",
    taEn: "Adhukku appuram indha policy renewal-ku varumbodhu Aegis enakku nyaabagapaduthanum-nu-um virumbaren. Idhu mela irukkuradhu-la irundhu thani choice; matthadhu edhaiyum niruthhaama indha reminder-a mattum niruthhalaam.",
  },
};

/**
 * Bump this whenever a string in `CONSENT_TEXT` changes meaning.
 *
 * Separate from `CONSUMER_COPY_VERSION`: a renewal warning being reworded is a
 * copy edit, and a consent being reworded is a new agreement. Sharing one
 * version between them would make every consent row look re-agreed every time
 * somebody improved a status message.
 */
export const CONSENT_TEXT_VERSION = "consumer-consent-v1";

/**
 * What the customer is told before they agree, beyond the agreement itself.
 *
 * Shown on the same screen, never behind a link. A consent screen whose
 * consequences are one tap away is one where the consequences were not read.
 */
export const CONSENT_EXPLAINER: LocalisedText = {
  en: "Nothing is sent automatically. A person at Aegis reads your request and gets in touch the way you asked. We do not message you on WhatsApp automatically, and we never share your details with a partner without telling you first.",
  ta: "எதுவும் தானாக அனுப்பப்படாது. ஏஜிஸில் ஒருவர் உங்கள் கோரிக்கையைப் படித்து, நீங்கள் கேட்ட வழியில் தொடர்பு கொள்வார். வாட்ச்அப்பில் தானாகச் செய்திகள் அனுப்ப மாட்டோம்; உங்களிடம் சொல்லாமல் உங்கள் விவரங்களைப் பங்குதாரருடன் பகிர மாட்டோம்.",
  taEn: "Edhuvum thaana anuppapadaadhu. Aegis-la oruthar ungal request-a padichu, neenga kettha vazhiyila contact panuvaanga. WhatsApp-la thaana message anuppa maatom; ungakitta sollaama ungal details-a partner-kitta share panna maatom.",
};

/** What a customer is told once their request is in. */
export const RENEWAL_REQUEST_COPY: Record<"received" | "withdrawn", LocalisedText> = {
  received: {
    en: "Your request is in. Someone will get in touch the way you asked. You can stop this at any time and nothing about your policy changes if you do.",
    ta: "உங்கள் கோரிக்கை பதிவாகிவிட்டது. நீங்கள் கேட்ட வழியில் ஒருவர் தொடர்பு கொள்வார். எப்போது வேண்டுமானாலும் இதை நிறுத்தலாம்; நிறுத்தினாலும் உங்கள் பாலிசியில் எதுவும் மாறாது.",
    taEn: "Ungal request pathivaagiduchu. Neenga kettha vazhiyila oruthar contact panuvaanga. Eppo venumnaalum idha niruthhalaam; niruthhinaalum ungal policy-la onnum maaraadhu.",
  },
  withdrawn: {
    en: "That is stopped. We will not contact you about this again unless you ask us to, and your policy details are untouched.",
    ta: "அது நிறுத்தப்பட்டது. நீங்கள் கேட்காத வரை இது குறித்து மீண்டும் தொடர்பு கொள்ள மாட்டோம்; உங்கள் பாலிசி விவரங்கள் அப்படியே உள்ளன.",
    taEn: "Adhu niruthhiduchu. Neenga kekkaadha varai idha pathi thirumba contact panna maatom; ungal policy details appadiye irukku.",
  },
};

// ── Aegis Kural Lite ─────────────────────────────────────────────────────────

/**
 * The words that travel with every answer.
 *
 * Two of them are not optional and are enforced by the service rather than left
 * to a caller: the guidance disclaimer, and an offer to reach a person. A
 * general answer about motor insurance is useful; a general answer mistaken for
 * a statement about *your* policy is how somebody drives uninsured, and the
 * offer of a human is what keeps the difference visible.
 */
export const KURAL_SCOPE_NOTE: LocalisedText = {
  en: "This is general information about motor insurance, not a statement about your own policy. What you actually hold is printed on your certificate.",
  ta: "இது மோட்டார் காப்பீடு பற்றிய பொதுவான தகவல்; உங்கள் சொந்தப் பாலிசி பற்றியது அல்ல. உங்களிடம் உண்மையில் என்ன உள்ளது என்பது உங்கள் சான்றிதழில் அச்சிடப்பட்டிருக்கும்.",
  taEn: "Idhu motor insurance pathi general information; ungal policy pathi solradhu illa. Ungakitta nijamaave enna irukku-nu certificate-la thaan irukkum.",
};

/** The offer of a person. Present on every answer, matched or not. */
export const KURAL_HUMAN_CTA: LocalisedText = {
  en: "Would you like a person to go through this with you? We can arrange a call, a WhatsApp message or an email.",
  ta: "இதை உங்களுடன் சேர்ந்து ஒருவர் பார்க்க வேண்டுமா? அழைப்பு, வாட்ச்அப் செய்தி அல்லது மின்னஞ்சல் ஏற்பாடு செய்யலாம்.",
  taEn: "Idha ungaloda serndhu oruthar paakkanuma? Call, WhatsApp illa email-la arrange panrom.",
};

/**
 * What is said when the question is outside the six topics.
 *
 * It says what it does not know before it says what it does. A reply that opens
 * with a list of other subjects reads as a deflection; one that admits the gap
 * and then offers a person reads as an answer.
 */
export const KURAL_NO_MATCH: LocalisedText = {
  en: "I do not have a checked answer for that one. I can only help with a few motor insurance basics — when a policy runs out, the difference between third-party and comprehensive cover, IDV, no-claim bonus, zero depreciation, and how renewing works. For anything else, a person is the right answer rather than a guess from me.",
  ta: "அதற்கு என்னிடம் சரிபார்க்கப்பட்ட பதில் இல்லை. மோட்டார் காப்பீட்டின் சில அடிப்படைகளில் மட்டுமே என்னால் உதவ முடியும் — பாலிசி எப்போது முடிகிறது, மூன்றாம் தரப்புக்கும் முழு பாதுகாப்புக்கும் உள்ள வித்தியாசம், IDV, நோ-கிளைம் போனஸ், ஸீரோ டெப்ரிசியேஷன், மற்றும் புதுப்பிப்பது எப்படி. வேறு எதற்கும் நான் ஊகிப்பதை விட ஒருவரிடம் பேசுவதே சரி.",
  taEn: "Adhukku enakitta check panna badhil illa. Naan konjam motor insurance basics-la mattum thaan help panna mudiyum — policy eppo mudiyum, third-party-kkum comprehensive-kkum enna vithyaasam, IDV, no-claim bonus, zero depreciation, appuram renew eppadi panradhu. Vera edhukkum naan yosichu sollaradhukku badhil oru aal thaan sari.",
};

/** Said when a question arrives empty or absurdly long. */
export const KURAL_UNREADABLE: LocalisedText = {
  en: "I could not read that as a question. Try asking in a sentence or two — for example, \"what is IDV?\"",
  ta: "அதை ஒரு கேள்வியாகப் படிக்க முடியவில்லை. ஓரிரு வாக்கியங்களில் கேளுங்கள் — உதாரணமாக, \"IDV என்றால் என்ன?\"",
  taEn: "Adha oru kelvi-yaa padikka mudiyala. Oru rendu vaakkiyathula kelunga — udhaaranam, \"IDV-nna enna?\"",
};

/**
 * How the assistant introduces itself.
 *
 * It names its limits in its first sentence on purpose. An assistant that opens
 * by offering to help with anything has made a promise it will break within two
 * questions, and the person it breaks it on is the one least able to tell.
 */
export const KURAL_INTRO: LocalisedText = {
  en: "Ask me about motor insurance basics. I answer from a small set of checked notes, so I will tell you plainly when something is outside them.",
  ta: "மோட்டார் காப்பீட்டின் அடிப்படைகளைப் பற்றிக் கேளுங்கள். சரிபார்க்கப்பட்ட சில குறிப்புகளிலிருந்தே பதில் சொல்வேன்; அதற்கு வெளியே இருந்தால் அதையும் நேரடியாகச் சொல்வேன்.",
  taEn: "Motor insurance basics pathi kelunga. Naan check panna konja notes-la irundhu thaan badhil solluven; adhukku veliya irundha adhaiyum nerdiyaa solluven.",
};

export interface ResolvedKuralCopy {
  readonly scopeNote: string;
  readonly humanCta: string;
  readonly copyVersion: string;
}

/** The two lines that must accompany every answer, in one locale. */
export function resolveKuralCopy(locale: ConsumerLocale = "en"): ResolvedKuralCopy {
  return {
    scopeNote: localise(KURAL_SCOPE_NOTE, locale),
    humanCta: localise(KURAL_HUMAN_CTA, locale),
    copyVersion: CONSUMER_COPY_VERSION,
  };
}
