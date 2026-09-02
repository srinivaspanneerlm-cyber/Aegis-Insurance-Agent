import type { LocalisedText } from "@/types/documents";

/**
 * The choices a customer picks from, with the words they read.
 *
 * The ids mirror `backend/src/consumer/vocabulary.ts` exactly — a test reads
 * that file and fails if the two drift. They have to agree or the failure is
 * silent in the worst way: the customer picks an option, the API rejects it,
 * and the form can only say that something was invalid.
 *
 * The labels are the opposite of the ids. `THIRD_PARTY` is what the database
 * stores; "Third-party only" with a sentence explaining what that means is what
 * somebody reads, because most people holding a motor policy have never been
 * told the difference and are about to make a decision that depends on it.
 */

export const VEHICLE_TYPES = ["BIKE", "CAR", "SCOOTER"] as const;
export type VehicleType = (typeof VEHICLE_TYPES)[number];

export const POLICY_TYPES = ["THIRD_PARTY", "COMPREHENSIVE", "OWN_DAMAGE", "UNKNOWN"] as const;
export type PolicyType = (typeof POLICY_TYPES)[number];

export interface Choice<T extends string> {
  readonly id: T;
  readonly label: LocalisedText;
  /** What this actually means, in one sentence. Never optional. */
  readonly meaning: LocalisedText;
}

export const VEHICLE_TYPE_CHOICES: readonly Choice<VehicleType>[] = [
  {
    id: "BIKE",
    label: { en: "Motorbike", ta: "மோட்டார் சைக்கிள்", taEn: "Bike" },
    meaning: {
      en: "A geared two-wheeler.",
      ta: "கியர் உள்ள இரு சக்கர வாகனம்.",
      taEn: "Gear irukkura two-wheeler.",
    },
  },
  {
    id: "SCOOTER",
    label: { en: "Scooter", ta: "ஸ்கூட்டர்", taEn: "Scooter" },
    meaning: {
      en: "A gearless two-wheeler, like an Activa.",
      ta: "கியர் இல்லாத இரு சக்கர வாகனம், உதாரணமாக ஆக்டிவா.",
      taEn: "Gear illaadha two-wheeler, Activa maadhiri.",
    },
  },
  {
    id: "CAR",
    label: { en: "Car", ta: "கார்", taEn: "Car" },
    meaning: {
      en: "A private four-wheeler.",
      ta: "தனிப்பட்ட நான்கு சக்கர வாகனம்.",
      taEn: "Sondha four-wheeler.",
    },
  },
];

/**
 * `UNKNOWN` is listed last and worded as an ordinary answer, not an escape.
 *
 * It is the honest choice for most first-time users, and a form that makes it
 * feel like failure pushes people into guessing — which puts a fiction on their
 * record that everything downstream then reasons from.
 */
export const POLICY_TYPE_CHOICES: readonly Choice<PolicyType>[] = [
  {
    id: "THIRD_PARTY",
    label: { en: "Third-party only", ta: "மூன்றாம் தரப்பு மட்டும்", taEn: "Third-party only" },
    meaning: {
      en: "Covers damage you cause to other people and their property. Your own vehicle is not covered. This is the minimum the law requires.",
      ta: "நீங்கள் மற்றவர்களுக்கும் அவர்களின் சொத்துக்கும் ஏற்படுத்தும் சேதத்தை மட்டும் ஈடு செய்யும். உங்கள் சொந்த வாகனத்திற்கு பாதுகாப்பு இல்லை. இதுவே சட்டப்படி குறைந்தபட்சம்.",
      taEn: "Neenga vera aalungalukku pannura damage-a mattum cover pannum. Ungal vandi-kku cover kidaiyaadhu. Idhu thaan law-la minimum.",
    },
  },
  {
    id: "COMPREHENSIVE",
    label: { en: "Comprehensive", ta: "முழு பாதுகாப்பு", taEn: "Comprehensive" },
    meaning: {
      en: "Covers damage to other people and to your own vehicle, including theft. This is the fuller cover.",
      ta: "மற்றவர்களுக்கு ஏற்படும் சேதத்துடன், திருட்டு உட்பட உங்கள் சொந்த வாகனத்திற்கும் பாதுகாப்பு அளிக்கும். இதுவே முழுமையான பாதுகாப்பு.",
      taEn: "Vera aalungalukkum, theft உட்பட ungal vandi-kkum cover pannum. Idhu thaan full cover.",
    },
  },
  {
    id: "OWN_DAMAGE",
    label: { en: "Own damage only", ta: "சொந்த சேதம் மட்டும்", taEn: "Own damage only" },
    meaning: {
      en: "Covers your own vehicle only. Usually taken alongside a separate third-party policy.",
      ta: "உங்கள் சொந்த வாகனத்திற்கு மட்டும் பாதுகாப்பு. பொதுவாக தனி மூன்றாம் தரப்பு பாலிசியுடன் சேர்த்து எடுக்கப்படும்.",
      taEn: "Ungal vandi-kku mattum cover. Usually thani third-party policy-oda serthu edupaanga.",
    },
  },
  {
    id: "UNKNOWN",
    label: { en: "I'm not sure", ta: "எனக்குத் தெரியவில்லை", taEn: "Enakku theriyala" },
    meaning: {
      en: "That is completely fine. Most people do not know, and we can help you find out from your certificate later.",
      ta: "அதில் எந்தத் தவறும் இல்லை. பெரும்பாலானோருக்குத் தெரிவதில்லை. உங்கள் சான்றிதழிலிருந்து பிறகு கண்டுபிடிக்க நாங்கள் உதவுவோம்.",
      taEn: "Adhula onnum thappu illa. Nirayaparukku theriyaadhu. Ungal certificate-la irundhu appuram kandupidikka naanga help panrom.",
    },
  },
];

/** Look up a choice's copy without a find() at every call site. */
export const policyTypeChoice = (id: PolicyType | null): Choice<PolicyType> | null =>
  POLICY_TYPE_CHOICES.find((choice) => choice.id === id) ?? null;

export const vehicleTypeChoice = (id: string | null): Choice<VehicleType> | null =>
  VEHICLE_TYPE_CHOICES.find((choice) => choice.id === id) ?? null;
