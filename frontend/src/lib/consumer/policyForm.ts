import type { LocalisedText } from "@/types/documents";
import { POLICY_TYPES, VEHICLE_TYPES, type PolicyType, type VehicleType } from "./vocabulary";

/**
 * The manual policy form: its shape, its steps, and what makes each one valid.
 *
 * Pure — no React, no network. That is what lets the rules be tested directly
 * rather than through six rendered screens, and it is why the wizard component
 * underneath is mostly layout.
 *
 * The form is split into short steps on purpose. One long form asking for nine
 * things at once is the surface that loses a first-time buyer on a phone: they
 * cannot see progress, an error at the bottom scrolls the top out of view, and
 * there is no moment where it feels safe to stop. Four questions, one screen at
 * a time, with the two optional ones last and skippable.
 *
 * Client-side validation here is a courtesy, not a boundary. The API validates
 * everything again, because everything here can be bypassed by anyone talking
 * to it directly.
 */

export interface PolicyDraft {
  registrationNumber: string;
  vehicleType: VehicleType | "";
  make: string;
  model: string;
  insurer: string;
  policyNumber: string;
  policyType: PolicyType | "";
  startDate: string;
  expiryDate: string;
  idv: string;
  ncbPercent: string;
}

export const EMPTY_DRAFT: PolicyDraft = {
  registrationNumber: "",
  vehicleType: "",
  make: "",
  model: "",
  insurer: "",
  policyNumber: "",
  policyType: "",
  startDate: "",
  expiryDate: "",
  idv: "",
  ncbPercent: "",
};

export type DraftField = keyof PolicyDraft;

/** Field-keyed errors. Absent means the field is fine. */
export type DraftErrors = Partial<Record<DraftField, LocalisedText>>;

/**
 * Whether this form is entering a policy or correcting one.
 *
 * One rule changes between the two, and only one: the policy number. The API
 * never sends a full policy number back to the browser — only the last few
 * characters — so a correction form cannot pre-fill it without inventing the
 * part it was not given. An empty policy number therefore means "leave the one
 * you already hold" when editing, and "you have not answered yet" when adding.
 *
 * Everything else is required in both directions on purpose. A customer who
 * clears their expiry date while correcting a typo would otherwise be left with
 * a policy the renewal engine cannot say anything about, which is the one thing
 * this product exists to avoid.
 */
export type FormMode = "create" | "edit";

export interface FormStep {
  readonly id: string;
  readonly title: LocalisedText;
  /** Why we are asking. Shown under the title, so no question is a demand. */
  readonly help: LocalisedText;
  readonly fields: readonly DraftField[];
  /** Whether this step may be passed without answering anything. */
  readonly optional?: boolean;
}

export const FORM_STEPS: readonly FormStep[] = [
  {
    id: "vehicle",
    title: { en: "Which vehicle?", ta: "எந்த வாகனம்?", taEn: "Endha vandi?" },
    help: {
      en: "The number on your number plate, and what kind of vehicle it is.",
      ta: "உங்கள் வாகனத்தின் பதிவு எண், மற்றும் அது எந்த வகை வாகனம்.",
      taEn: "Ungal number plate-la irukka number, appuram enna vandi-nu.",
    },
    fields: ["registrationNumber", "vehicleType"],
  },
  {
    id: "insurer",
    title: { en: "Who insures it?", ta: "யார் காப்பீடு செய்துள்ளனர்?", taEn: "Yaaru insure panniyirukkaanga?" },
    help: {
      en: "Both are printed at the top of your policy certificate.",
      ta: "இரண்டும் உங்கள் பாலிசி சான்றிதழின் மேற்பகுதியில் அச்சிடப்பட்டிருக்கும்.",
      taEn: "Rendum ungal policy certificate mela pakkam print aagi irukkum.",
    },
    fields: ["insurer", "policyNumber"],
  },
  {
    id: "type",
    title: { en: "What kind of cover?", ta: "எந்த வகையான பாதுகாப்பு?", taEn: "Enna maadhiri cover?" },
    help: {
      en: "If you are not sure, say so — that is a normal answer and we will help.",
      ta: "தெரியவில்லை என்றால் அப்படியே சொல்லுங்கள் — அது சாதாரணமான பதில், நாங்கள் உதவுவோம்.",
      taEn: "Theriyalana appadiye sollunga — adhu normal badhil, naanga help panrom.",
    },
    fields: ["policyType"],
  },
  {
    id: "dates",
    title: { en: "When does it run out?", ta: "எப்போது முடிகிறது?", taEn: "Eppo mudiyudhu?" },
    help: {
      en: "The expiry date is the one thing we really need — everything we tell you comes from it.",
      ta: "காலாவதி தேதி மட்டும் கட்டாயம் தேவை — நாங்கள் சொல்வது அனைத்தும் அதிலிருந்தே வருகிறது.",
      taEn: "Expiry date mattum kandippa venum — naanga solradhu ellame adhula irundhu thaan varudhu.",
    },
    fields: ["expiryDate", "startDate"],
  },
  {
    id: "extras",
    title: { en: "Anything else?", ta: "வேறு ஏதாவது?", taEn: "Vera edhaavadhu?" },
    help: {
      en: "You can skip this. It only makes our guidance a little sharper.",
      ta: "இதைத் தவிர்க்கலாம். இது எங்கள் வழிகாட்டுதலைச் சற்று துல்லியமாக்கும், அவ்வளவுதான்.",
      taEn: "Idha skip pannalaam. Idhu engal guidance-a konjam sharp-a aakkum, adhu mattum thaan.",
    },
    fields: ["idv", "ncbPercent"],
    optional: true,
  },
  {
    id: "review",
    title: { en: "Does this look right?", ta: "இது சரியாக உள்ளதா?", taEn: "Idhu sariyaa irukka?" },
    help: {
      en: "Check it over before we save it. You can change any of it later.",
      ta: "சேமிப்பதற்கு முன் ஒருமுறை பாருங்கள். பிறகு எதை வேண்டுமானாலும் மாற்றலாம்.",
      taEn: "Save panradhukku munnadi oru vaati paarunga. Appuram edhu venumnaalum maathalaam.",
    },
    fields: [],
  },
];

export const REVIEW_STEP_INDEX = FORM_STEPS.length - 1;

// ── Validation ───────────────────────────────────────────────────────────────

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

const required = (label: string, ta: string, taEn: string): LocalisedText => ({
  en: label,
  ta,
  taEn,
});

/** Whether `YYYY-MM-DD` names a day that exists. */
export function isRealDate(value: string): boolean {
  if (!DATE_ONLY.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  const parsed = new Date(Date.UTC(year, month - 1, day));
  return (
    parsed.getUTCFullYear() === year &&
    parsed.getUTCMonth() + 1 === month &&
    parsed.getUTCDate() === day
  );
}

/**
 * Check one field.
 *
 * Returns the message rather than throwing, and returns it in three languages,
 * so the caller decides both when to show it and which words to use.
 */
export function validateField(
  field: DraftField,
  draft: PolicyDraft,
  mode: FormMode = "create"
): LocalisedText | null {
  const value = draft[field].trim();

  switch (field) {
    case "registrationNumber": {
      if (value === "") {
        return required(
          "Please enter your vehicle number.",
          "உங்கள் வாகன எண்ணைப் பதிவு செய்யுங்கள்.",
          "Ungal vandi number-a podunga."
        );
      }
      // Length only, never a format. Older and out-of-state plates do not match
      // the current pattern, and their owners are exactly who this is for.
      if (value.replace(/[^A-Za-z0-9]/g, "").length < 4) {
        return required(
          "That looks too short — please check the number.",
          "இது மிகக் குறைவாக உள்ளது — எண்ணைச் சரிபாருங்கள்.",
          "Idhu romba chinnadhaa irukku — number-a check pannunga."
        );
      }
      return null;
    }

    case "vehicleType": {
      if (!(VEHICLE_TYPES as readonly string[]).includes(value)) {
        return required(
          "Please choose the kind of vehicle.",
          "வாகன வகையைத் தேர்ந்தெடுங்கள்.",
          "Vandi vagai-ya select pannunga."
        );
      }
      return null;
    }

    case "insurer": {
      if (value.length < 2) {
        return required(
          "Please enter your insurer's name.",
          "உங்கள் காப்பீட்டு நிறுவனத்தின் பெயரைப் பதிவு செய்யுங்கள்.",
          "Ungal insurance company peyar-a podunga."
        );
      }
      return null;
    }

    case "policyNumber": {
      // Blank while correcting means "keep the number I already gave you" — the
      // browser was never sent it to re-submit. See `FormMode`.
      if (mode === "edit" && value === "") return null;
      if (value.length < 3) {
        return required(
          "Please enter your policy number.",
          "உங்கள் பாலிசி எண்ணைப் பதிவு செய்யுங்கள்.",
          "Ungal policy number-a podunga."
        );
      }
      return null;
    }

    case "policyType": {
      if (!(POLICY_TYPES as readonly string[]).includes(value)) {
        return required(
          "Please choose one. \"I'm not sure\" is a real answer.",
          "ஒன்றைத் தேர்ந்தெடுங்கள். \"எனக்குத் தெரியவில்லை\" என்பதும் ஒரு உண்மையான பதில்.",
          "Onnu select pannunga. \"Enakku theriyala\"-um oru real badhil."
        );
      }
      return null;
    }

    case "expiryDate": {
      if (value === "") {
        return required(
          "We need the expiry date — it is what everything else is worked out from.",
          "காலாவதி தேதி தேவை — மற்ற அனைத்தும் அதிலிருந்தே கணக்கிடப்படுகிறது.",
          "Expiry date venum — meedhi ellame adhula irundhu thaan kanakku pannuvom."
        );
      }
      if (!isRealDate(value)) {
        return required(
          "That is not a date we can read. Please use the date picker.",
          "இது எங்களால் படிக்க முடியாத தேதி. தேதி தேர்வியைப் பயன்படுத்துங்கள்.",
          "Idhu padikka mudiyaadha date. Date picker-a use pannunga."
        );
      }
      return null;
    }

    case "startDate": {
      if (value === "") return null; // optional
      if (!isRealDate(value)) {
        return required(
          "That is not a date we can read.",
          "இது எங்களால் படிக்க முடியாத தேதி.",
          "Idhu padikka mudiyaadha date."
        );
      }
      if (draft.expiryDate && isRealDate(draft.expiryDate) && value >= draft.expiryDate) {
        // Almost always the two dates typed the wrong way round. Said plainly,
        // because "invalid date range" tells nobody which box to fix.
        return required(
          "The start date should come before the expiry date. Are they the other way round?",
          "தொடக்க தேதி காலாவதி தேதிக்கு முன் இருக்க வேண்டும். இரண்டும் மாறிவிட்டதா?",
          "Start date expiry date-ukku munnadi irukkanum. Rendum maari poachaa?"
        );
      }
      return null;
    }

    case "idv":
    case "ncbPercent": {
      if (value === "") return null; // both optional
      const parsed = Number(value);
      if (!Number.isFinite(parsed) || parsed < 0) {
        return required(
          "Please enter a number, or leave it blank.",
          "ஒரு எண்ணைப் பதிவு செய்யுங்கள், அல்லது காலியாக விடுங்கள்.",
          "Oru number podunga, illana kaaliya vidunga."
        );
      }
      if (field === "ncbPercent" && parsed > 100) {
        return required(
          "A no-claim bonus is a percentage, so it cannot be above 100.",
          "நோ-கிளைம் போனஸ் ஒரு சதவீதம், எனவே 100-ஐ விட அதிகமாக இருக்க முடியாது.",
          "No-claim bonus oru percentage, so 100-ku mela irukka mudiyaadhu."
        );
      }
      return null;
    }

    default:
      return null;
  }
}

/** Every error on one step. Empty means the step may be left. */
export function validateStep(
  stepIndex: number,
  draft: PolicyDraft,
  mode: FormMode = "create"
): DraftErrors {
  const step = FORM_STEPS[stepIndex];
  if (!step) return {};

  const errors: DraftErrors = {};
  for (const field of step.fields) {
    const error = validateField(field, draft, mode);
    if (error) errors[field] = error;
  }
  return errors;
}

/**
 * Every error in the whole draft.
 *
 * Used before submitting, so a draft that was edited backwards — a customer
 * returning to step one and clearing the plate — cannot reach the API on the
 * strength of a step that passed earlier.
 */
export function validateDraft(draft: PolicyDraft, mode: FormMode = "create"): DraftErrors {
  const errors: DraftErrors = {};
  for (const step of FORM_STEPS) {
    Object.assign(errors, validateStep(FORM_STEPS.indexOf(step), draft, mode));
  }
  return errors;
}

export const hasErrors = (errors: DraftErrors): boolean => Object.keys(errors).length > 0;

/**
 * The request body, from a validated draft.
 *
 * Empty optional fields are omitted rather than sent as empty strings: the API
 * treats an absent field as "not supplied" and an empty string would have to be
 * separately understood as the same thing in two places.
 */
export function toCreatePayload(draft: PolicyDraft): Record<string, unknown> {
  const payload: Record<string, unknown> = {
    insurer: draft.insurer.trim(),
    policyNumber: draft.policyNumber.trim(),
    policyType: draft.policyType,
    expiryDate: draft.expiryDate,
    vehicle: {
      registrationNumber: draft.registrationNumber.trim(),
      vehicleType: draft.vehicleType,
    },
  };

  const vehicle = payload.vehicle as Record<string, unknown>;
  if (draft.make.trim()) vehicle.make = draft.make.trim();
  if (draft.model.trim()) vehicle.model = draft.model.trim();

  if (draft.startDate) payload.startDate = draft.startDate;
  if (draft.idv.trim()) payload.idv = Number(draft.idv);
  if (draft.ncbPercent.trim()) payload.ncbPercent = Number(draft.ncbPercent);

  return payload;
}

// ── Editing an existing policy ───────────────────────────────────────────────

/**
 * The parts of a saved policy this form can be filled from.
 *
 * Structural rather than an import of `ConsumerPolicy`, so this module stays
 * pure — nothing here should have to know that a policy arrives over HTTP. The
 * API type satisfies this shape, and TypeScript checks that at the call site.
 */
export interface EditablePolicy {
  insurer: string | null;
  policyType: PolicyType | null;
  startDate: string | null;
  expiryDate: string | null;
  idv: number | null;
  ncbPercent: number | null;
  vehicle: {
    registrationNumber: string;
    vehicleType: string;
    make: string | null;
    model: string | null;
  } | null;
}

/**
 * A saved policy, back in the form it was typed into.
 *
 * `policyNumber` is deliberately empty. The API sends only the masked last few
 * characters, and putting those into an editable box would invite a customer to
 * "correct" a value that was never theirs to see — and would then save the mask
 * as the real number. Blank means unchanged; the wizard says so on screen.
 */
export function draftFromPolicy(policy: EditablePolicy): PolicyDraft {
  return {
    registrationNumber: policy.vehicle?.registrationNumber ?? "",
    vehicleType: (policy.vehicle?.vehicleType ?? "") as VehicleType | "",
    make: policy.vehicle?.make ?? "",
    model: policy.vehicle?.model ?? "",
    insurer: policy.insurer ?? "",
    policyNumber: "",
    policyType: policy.policyType ?? "",
    startDate: policy.startDate ?? "",
    expiryDate: policy.expiryDate ?? "",
    idv: policy.idv === null ? "" : String(policy.idv),
    ncbPercent: policy.ncbPercent === null ? "" : String(policy.ncbPercent),
  };
}

/**
 * The request body for a correction.
 *
 * Different from `toCreatePayload` in two ways, both of them about what a blank
 * box means once a value already exists.
 *
 * The optional fields — start date, IDV, no-claim bonus — are sent even when
 * empty, because a customer who clears one is asking for it to be removed and
 * omitting it would silently keep the old value. The API reads an empty string
 * as "no value", which is the same thing it does on create.
 *
 * The policy number is the exception: empty is omitted, because the browser was
 * never given the full number to send back. See `draftFromPolicy`.
 */
export function toUpdatePayload(draft: PolicyDraft): Record<string, unknown> {
  const payload: Record<string, unknown> = {
    insurer: draft.insurer.trim(),
    policyType: draft.policyType,
    expiryDate: draft.expiryDate,
    startDate: draft.startDate,
    idv: draft.idv.trim(),
    ncbPercent: draft.ncbPercent.trim(),
    vehicle: {
      registrationNumber: draft.registrationNumber.trim(),
      vehicleType: draft.vehicleType,
      make: draft.make.trim(),
      model: draft.model.trim(),
    },
  };

  if (draft.policyNumber.trim()) payload.policyNumber = draft.policyNumber.trim();

  return payload;
}

/**
 * Whether the vehicle details in the form differ from the ones already stored.
 *
 * Asked so a policy correction that never touched the vehicle does not write to
 * it anyway. That write would be harmless to the data and wrong in the audit
 * trail, which is read later to answer "what did this customer change, and
 * when" — and an entry saying they edited a vehicle they did not touch makes
 * that record less true, not more complete.
 */
export function vehicleChanged(draft: PolicyDraft, original: PolicyDraft): boolean {
  return (
    draft.registrationNumber.trim() !== original.registrationNumber.trim() ||
    draft.vehicleType !== original.vehicleType ||
    draft.make.trim() !== original.make.trim() ||
    draft.model.trim() !== original.model.trim()
  );
}
