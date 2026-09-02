/**
 * Aegis Kural Lite — the six motor questions, and where each answer comes from.
 *
 * This is a *catalogue*, not a model. Nothing here is generated: every answer is
 * a fixed string with a recorded provenance, and the matcher below chooses
 * between them rather than composing anything. That is the whole design, and it
 * follows from one constraint — the platform must not claim what a policy covers
 * unless a verified source says so. A language model asked "does this cover
 * theft?" will answer confidently and sometimes wrongly, to somebody deciding
 * whether they are insured.
 *
 * ## Provenance
 *
 * Every answer carries a `source`, and the three kinds are not interchangeable:
 *
 *   • `layer1` — verbatim from the approved knowledge base at
 *     `Aegis-AI/layer1/insurance-data/motor/…`. A test reads those files and
 *     fails if a character drifts, so this catalogue cannot quietly diverge from
 *     the source it claims to quote.
 *   • `aegis-copy` — a string already shipped and reviewed elsewhere in this
 *     product, reused rather than rewritten. The cover-type explanations are the
 *     ones a customer already reads when choosing their policy type, and saying
 *     it differently here would be two answers to one question.
 *   • `aegis-editorial` — written for this catalogue. Permitted **only** for
 *     definitional facts that are not claims about cover: what IDV stands for,
 *     what a no-claim bonus is. A test asserts that no editorial answer contains
 *     a coverage claim, which is what keeps that boundary from eroding.
 *
 * ## What is deliberately absent
 *
 * No prices, no quotes, no "your policy covers X". Every answer ends in the
 * disclaimer and an offer to talk to a person, because the honest end of a
 * general answer about somebody's specific policy is a human being.
 */
import type { LocalisedText } from "../messages";

export const KURAL_TOPICS = [
  "POLICY_EXPIRY",
  "COVER_TYPES",
  "IDV",
  "NCB",
  "ZERO_DEPRECIATION",
  "RENEWAL_STEPS",
] as const;

export type KuralTopic = (typeof KURAL_TOPICS)[number];

export const isKuralTopic = (value: unknown): value is KuralTopic =>
  typeof value === "string" && (KURAL_TOPICS as readonly string[]).includes(value);

/** Where an answer came from, recorded so it can be checked rather than trusted. */
export type AnswerSource =
  | { kind: "layer1"; file: string; question: string }
  | { kind: "aegis-copy"; module: string; entry: string }
  | { kind: "aegis-editorial"; note: string };

export interface KuralEntry {
  readonly id: KuralTopic;
  /** What the topic is called, for a suggestion chip. */
  readonly title: LocalisedText;
  /** The answer. Fixed, never assembled. */
  readonly answer: LocalisedText;
  readonly source: AnswerSource;
  /**
   * Words that point at this topic.
   *
   * Lowercase, matched as whole words against a normalised question. Tamil and
   * Thanglish terms sit beside the English ones because a customer asking
   * "vandi value enna?" is asking about IDV, and a matcher that only knows the
   * English acronym would send them to a human for a question it can answer.
   */
  readonly keywords: readonly string[];
  /**
   * Terms that are worth more than one keyword.
   *
   * "IDV" and "NCB" are unambiguous; "cover" appears in half the questions
   * somebody might ask. Without weighting, three weak words beat one exact one.
   */
  readonly strongKeywords?: readonly string[];
}

export const KURAL_ENTRIES: readonly KuralEntry[] = [
  {
    id: "POLICY_EXPIRY",
    title: {
      en: "When does my policy run out?",
      ta: "என் பாலிசி எப்போது முடிகிறது?",
      taEn: "En policy eppo mudiyudhu?",
    },
    answer: {
      en: "A motor policy runs to the expiry date printed on your certificate, and cover stops at the end of that day. Driving without valid cover is an offence. Most insurers allow a grace period of about 30 days to renew after expiry, and after that they usually want to inspect the vehicle before covering it again.",
      ta: "மோட்டார் பாலிசி உங்கள் சான்றிதழில் அச்சிடப்பட்ட காலாவதி தேதி வரை செல்லுபடியாகும்; அந்த நாள் முடிவில் பாதுகாப்பு நின்றுவிடும். செல்லுபடியாகும் காப்பீடு இல்லாமல் வாகனம் ஓட்டுவது குற்றம். காலாவதிக்குப் பிறகு புதுப்பிக்க பெரும்பாலான காப்பீட்டு நிறுவனங்கள் சுமார் 30 நாட்கள் சலுகைக் காலம் தருகின்றன; அதற்குப் பிறகு மீண்டும் பாதுகாப்பு அளிப்பதற்கு முன் வாகனத்தைப் பரிசோதிக்கக் கேட்பார்கள்.",
      taEn: "Motor policy ungal certificate-la print aagi irukka expiry date varai thaan; andha naal mudiyum bodhu cover nikkum. Valid cover illaama vandi ottaradhu offence. Neraya insurer expire aana appuram renew panna 30 naal maadhiri grace period kudukkaraanga; adhukku appuram thirumba cover panradhukku munnaadi vandiya inspect panna kepaanga.",
    },
    source: {
      kind: "layer1",
      file: "Aegis-AI/layer1/insurance-data/motor/two-wheeler/knowledge/rules.json",
      question: "renewal_rules",
    },
    keywords: [
      "expire", "expires", "expired", "expiry", "run out", "runs out", "ends",
      "end date", "valid", "validity", "how long", "when does",
      "mudiyum", "mudiyudhu", "kaalaavadhi", "eppo mudiyum", "eppo mudiyudhu",
      "காலாவதி", "முடியும்", "முடிகிறது",
    ],
    strongKeywords: [
      "expiry", "expired", "expire", "kaalaavadhi",
      "eppo mudiyum", "eppo mudiyudhu", "காலாவதி",
    ],
  },
  {
    id: "COVER_TYPES",
    title: {
      en: "Third-party or comprehensive?",
      ta: "மூன்றாம் தரப்பா, முழு பாதுகாப்பா?",
      taEn: "Third-party-aa comprehensive-aa?",
    },
    answer: {
      en: "Third-party only covers damage you cause to other people and their property. Your own vehicle is not covered. This is the minimum the law requires. Comprehensive covers damage to other people and to your own vehicle, including theft. This is the fuller cover. Which one you hold is printed on your certificate, and we can help you work it out if you are not sure.",
      ta: "மூன்றாம் தரப்பு பாலிசி நீங்கள் மற்றவர்களுக்கும் அவர்களின் சொத்துக்கும் ஏற்படுத்தும் சேதத்தை மட்டும் ஈடு செய்யும்; உங்கள் சொந்த வாகனத்திற்கு பாதுகாப்பு இல்லை. இதுவே சட்டப்படி குறைந்தபட்சம். முழு பாதுகாப்பு (comprehensive) மற்றவர்களுக்கு ஏற்படும் சேதத்துடன், திருட்டு உட்பட உங்கள் சொந்த வாகனத்திற்கும் பாதுகாப்பு அளிக்கும். உங்களிடம் எது உள்ளது என்பது சான்றிதழில் அச்சிடப்பட்டிருக்கும்; தெரியவில்லை என்றால் கண்டுபிடிக்க நாங்கள் உதவுவோம்.",
      taEn: "Third-party-la neenga vera aalungalukku pannura damage mattum cover aagum; ungal vandi-kku cover kidaiyaadhu. Idhu thaan law-la minimum. Comprehensive-la vera aalungalukkum, theft உட்பட ungal vandi-kkum cover kidaikkum. Idhu thaan full cover. Ungakitta edhu irukku-nu certificate-la irukkum; theriyalana naanga kandupidikka help panrom.",
    },
    source: {
      kind: "aegis-copy",
      module: "frontend/src/lib/consumer/vocabulary.ts",
      entry: "POLICY_TYPE_CHOICES[THIRD_PARTY,COMPREHENSIVE].meaning",
    },
    keywords: [
      "third party", "third-party", "thirdparty", "comprehensive", "difference",
      "which cover", "type of cover", "cover type", "full cover", "only cover",
      "moondram tharappu", "muzhu", "vithyaasam",
      "மூன்றாம் தரப்பு", "முழு பாதுகாப்பு", "வித்தியாசம்",
    ],
    strongKeywords: [
      "third party", "third-party", "thirdparty", "comprehensive",
      "மூன்றாம் தரப்பு", "முழு பாதுகாப்பு",
    ],
  },
  {
    id: "IDV",
    title: { en: "What is IDV?", ta: "IDV என்றால் என்ன?", taEn: "IDV-nna enna?" },
    answer: {
      en: "IDV stands for Insured Declared Value. It is the value your vehicle is insured for, set when the policy is taken and reduced each year as the vehicle ages. It is the most a claim can pay out if the vehicle is stolen or written off, so a very low IDV makes the premium cheaper and the payout smaller. It is printed on your policy schedule.",
      ta: "IDV என்பது Insured Declared Value. இது உங்கள் வாகனம் எவ்வளவு தொகைக்கு காப்பீடு செய்யப்பட்டுள்ளது என்பதைக் குறிக்கும். பாலிசி எடுக்கும்போது நிர்ணயிக்கப்பட்டு, வாகனத்தின் வயதுக்கு ஏற்ப ஆண்டுதோறும் குறையும். வாகனம் திருடப்பட்டாலோ முழுமையாகச் சேதமடைந்தாலோ கிளைமில் கிடைக்கக்கூடிய அதிகபட்சத் தொகை இதுவே. எனவே மிகக் குறைந்த IDV பிரீமியத்தைக் குறைக்கும், ஆனால் கிடைக்கும் தொகையையும் குறைக்கும். இது உங்கள் பாலிசி அட்டவணையில் அச்சிடப்பட்டிருக்கும்.",
      taEn: "IDV-nna Insured Declared Value. Idhu ungal vandi evvalavu value-ku insure aagi irukku-nu; policy edukkum bodhu set aagum, vandi vayasaana varum bodhu varusham varusham korayum. Vandi thirudu poitaalum illa full-a damage aanaalum claim-la maximum ithuvarai thaan varum. Adhanaala IDV romba korainja premium mattam aagum, aana kidaikkura thogaiyum korayum. Idhu ungal policy schedule-la print aagi irukkum.",
    },
    source: {
      kind: "aegis-editorial",
      note: "Definitional. States what the acronym means and where to find the number; makes no claim about what any policy covers.",
    },
    keywords: [
      "idv", "insured declared value", "declared value", "vehicle value",
      "how much is my vehicle", "vandi value", "vandi vilai",
      "வாகன மதிப்பு",
    ],
    strongKeywords: ["idv", "insured declared value", "declared value"],
  },
  {
    id: "NCB",
    title: { en: "What is a no-claim bonus?", ta: "நோ-கிளைம் போனஸ் என்றால் என்ன?", taEn: "No-claim bonus-nna enna?" },
    answer: {
      en: "A no-claim bonus is a discount you earn for each year you do not make a claim. It builds up year on year and is applied when you renew. Making a claim usually resets it, and it is normally lost if you let the policy lapse for too long after expiry. It belongs to you rather than to the vehicle, so it can usually move with you to a new policy or a new insurer.",
      ta: "நோ-கிளைம் போனஸ் என்பது கிளைம் செய்யாத ஒவ்வொரு ஆண்டுக்கும் நீங்கள் பெறும் தள்ளுபடி. ஆண்டுதோறும் கூடிக்கொண்டே போகும், புதுப்பிக்கும்போது பயன்படும். கிளைம் செய்தால் பொதுவாக அது மீண்டும் பூஜ்ஜியமாகும்; காலாவதிக்குப் பிறகு நீண்ட நாட்கள் பாலிசி இல்லாமல் விட்டாலும் இழக்க நேரிடும். இது வாகனத்திற்கு அல்ல, உங்களுக்கே உரியது; எனவே புதிய பாலிசிக்கோ புதிய நிறுவனத்திற்கோ மாறும்போது உங்களுடன் வரும்.",
      taEn: "No-claim bonus-nna oru varusham claim pannaama irundha kidaikkura discount. Varusha varusham koodikittey pogum, renew pannum bodhu apply aagum. Claim panna adhu usually reset aagidum; expire aana appuram romba naal policy illaama vittaalum poidum. Adhu vandi-kku illa, ungalukku thaan; adhanaala pudhu policy-ku illa pudhu insurer-ku maarum bodhum ungaloda varum.",
    },
    source: {
      kind: "aegis-editorial",
      note: "Definitional. Describes how the discount is earned and carried; makes no claim about what any policy covers.",
    },
    keywords: [
      "ncb", "no claim", "no-claim", "noclaim", "bonus", "discount",
      "claim pannala", "discount kidaikkuma", "போனஸ்", "தள்ளுபடி",
    ],
    strongKeywords: ["ncb", "no claim", "no-claim", "noclaim"],
  },
  {
    id: "ZERO_DEPRECIATION",
    title: {
      en: "What is zero depreciation?",
      ta: "ஸீரோ டெப்ரிசியேஷன் என்றால் என்ன?",
      taEn: "Zero depreciation-nna enna?",
    },
    answer: {
      en: "Zero depreciation cover helps you receive a higher claim amount by reducing the depreciation deducted on replaced parts. Without it, an insurer subtracts an amount for wear and age on parts like bumpers and panels, and you pay that difference yourself. It is an add-on, so whether you have it is printed on your policy schedule rather than assumed.",
      ta: "ஸீரோ டெப்ரிசியேஷன் பாதுகாப்பு, மாற்றப்படும் பாகங்களுக்கான தேய்மானக் கழிவைக் குறைப்பதன் மூலம் அதிக கிளைம் தொகை கிடைக்க உதவுகிறது. இது இல்லாதபோது, பம்பர், பேனல் போன்ற பாகங்களின் வயதுக்காக ஒரு தொகையைக் காப்பீட்டு நிறுவனம் கழிக்கும்; அந்த வித்தியாசத்தை நீங்களே செலுத்த வேண்டும். இது ஒரு கூடுதல் சேர்க்கை (add-on); எனவே உங்களிடம் இது உள்ளதா என்பதைப் பாலிசி அட்டவணையில் பார்க்க வேண்டும்.",
      taEn: "Zero depreciation cover-la maathura parts-oda depreciation kuraivaa pudikkapadum; adhanaala claim thogai adhigamaa kidaikkum. Idhu illaana, bumper, panel maadhiri parts-oda vayasu-kaaga insurer oru thogaiya kuraippaanga; andha difference-a neenga thaan kattanum. Idhu oru add-on; adhanaala ungakitta idhu irukkaa-nu policy schedule-la thaan paakkanum.",
    },
    source: {
      kind: "layer1",
      file: "Aegis-AI/layer1/insurance-data/motor/two-wheeler/knowledge/faq.json",
      question: "What is Zero Depreciation Cover?",
    },
    keywords: [
      "zero dep", "zero depreciation", "zerodep", "depreciation", "bumper to bumper",
      "nil depreciation", "thegimaanam", "தேய்மானம்",
    ],
    strongKeywords: ["zero dep", "zero depreciation", "zerodep", "bumper to bumper", "nil depreciation"],
  },
  {
    id: "RENEWAL_STEPS",
    title: {
      en: "How do I renew?",
      ta: "எப்படிப் புதுப்பிப்பது?",
      taEn: "Eppadi renew panradhu?",
    },
    answer: {
      en: "You can renew an expired policy, subject to the insurer's inspection and underwriting rules. The usual steps are: find your policy number and expiry date on your certificate, decide whether you want the same cover, contact your insurer or a partner before the expiry date, and pay to put the new policy in force. If it has already expired, expect the insurer to want to inspect the vehicle first. We can put you in touch with somebody to walk through it with you.",
      ta: "காலாவதியான பாலிசியையும் புதுப்பிக்கலாம்; அது காப்பீட்டு நிறுவனத்தின் பரிசோதனை மற்றும் நிபந்தனைகளுக்கு உட்பட்டது. வழக்கமான படிகள்: சான்றிதழில் உங்கள் பாலிசி எண்ணையும் காலாவதி தேதியையும் பாருங்கள்; அதே பாதுகாப்பு வேண்டுமா என்று முடிவு செய்யுங்கள்; காலாவதி தேதிக்கு முன் உங்கள் காப்பீட்டு நிறுவனத்தையோ பங்குதாரரையோ தொடர்பு கொள்ளுங்கள்; புதிய பாலிசி அமலுக்கு வரப் பணம் செலுத்துங்கள். ஏற்கனவே காலாவதியாகி இருந்தால், வாகனத்தைப் பரிசோதிக்கக் கேட்பார்கள். உங்களுடன் சேர்ந்து இதைப் பார்க்க ஒருவரை நாங்கள் இணைத்து வைப்போம்.",
      taEn: "Expire aana policy-yum renew pannalaam; insurer-oda inspection-um underwriting rules-um adhukku badhil solla vendum. Usual steps: certificate-la ungal policy number-um expiry date-um paarunga; adhe cover venuma-nu mudivu pannunga; expiry date-ukku munnadi insurer illa partner-a contact pannunga; pudhu policy amalukku vara panam kattunga. Already expire aagirundha, insurer vandiya inspect panna kepaanga. Ungaloda serndhu idha paakka oru aala naanga connect panrom.",
    },
    source: {
      kind: "layer1",
      file: "Aegis-AI/layer1/insurance-data/motor/two-wheeler/knowledge/faq.json",
      question: "Can I renew an expired policy?",
    },
    keywords: [
      "renew", "renewal", "renewing", "how do i renew", "next step", "next steps",
      "what do i do", "lapsed", "restart", "puthupikka", "renew panna",
      "புதுப்பிக்க", "புதுப்பிப்பு",
    ],
    strongKeywords: [
      "renew", "renewal", "renewing", "lapsed", "puthupikka",
      "புதுப்பிக்க", "புதுப்பிப்பு",
    ],
  },
];

export const kuralEntry = (id: KuralTopic): KuralEntry | undefined =>
  KURAL_ENTRIES.find((entry) => entry.id === id);
