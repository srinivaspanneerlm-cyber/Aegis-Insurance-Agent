/**
 * Request shapes for the Aegis Consumer policy flow.
 *
 * Same contract as `schemas.ts` — a function returning error strings or null —
 * kept in its own file because that one is already long and these belong to a
 * flow that will keep growing.
 *
 * Two rules run through all of it. Every field is bounded, because everything
 * here is stored and later shown to somebody. And update is an allow-list
 * rather than a deny-list: the lesson `leadUpdateSchema` records is that
 * listing fields to reject has to be revisited every time a column is added,
 * and the one time it is missed, `deletedAt` becomes writable by anyone who can
 * edit a policy.
 */
import {
  EXPIRY_BOUNDS,
  FIELD_LIMITS,
  IDV_MAX,
  NCB_MAX_PERCENT,
  POLICY_TYPES,
  VEHICLE_TYPES,
  isPolicyType,
  isVehicleType,
} from "../consumer/vocabulary";
import {
  CONSENT_PURPOSES,
  CONTACT_CHANNELS,
  isConsentPurpose,
  isContactChannel,
} from "../consumer/renewalLead";

type RequestData = Record<string, unknown>;
type ValidationErrors = string[] | null;

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

/**
 * A required piece of text, bounded.
 *
 * The message names the field in the words the form uses, because a validation
 * error is read by the person who typed it and "insurer: invalid" tells them
 * nothing about which box to go back to.
 */
function requireText(
  data: RequestData,
  key: string,
  label: string,
  max: number,
  errors: string[],
  min = 1
): void {
  const value = data[key];
  if (typeof value !== "string" || value.trim().length < min) {
    errors.push(`${label} is required.`);
    return;
  }
  if (value.trim().length > max) {
    errors.push(`${label} must be ${max} characters or fewer.`);
  }
}

/** An optional piece of text. Absent and empty both mean "not supplied". */
function optionalText(
  data: RequestData,
  key: string,
  label: string,
  max: number,
  errors: string[]
): void {
  if (!(key in data) || data[key] === null || data[key] === undefined || data[key] === "") return;
  if (typeof data[key] !== "string") {
    errors.push(`${label} must be text.`);
    return;
  }
  if ((data[key] as string).trim().length > max) {
    errors.push(`${label} must be ${max} characters or fewer.`);
  }
}

/**
 * A calendar date, `YYYY-MM-DD`.
 *
 * Only that format is accepted, on purpose. A full timestamp would carry an
 * hour and a zone that the renewal engine deliberately ignores — an expiry is a
 * date printed on a certificate — and accepting one would invite a client to
 * send an instant whose calendar date differs from the one the customer typed.
 */
function validateDate(
  value: unknown,
  label: string,
  errors: string[],
  { required }: { required: boolean }
): void {
  if (value === null || value === undefined || value === "") {
    if (required) errors.push(`${label} is required.`);
    return;
  }

  if (typeof value !== "string" || !DATE_ONLY.test(value)) {
    errors.push(`${label} must be a date, written as YYYY-MM-DD.`);
    return;
  }

  // `2026-02-31` matches the pattern and is not a date. Round-tripping through
  // Date.UTC is what catches it: the components come back changed.
  const [year, month, day] = value.split("-").map(Number);
  const parsed = new Date(Date.UTC(year, month - 1, day));
  if (
    parsed.getUTCFullYear() !== year ||
    parsed.getUTCMonth() + 1 !== month ||
    parsed.getUTCDate() !== day
  ) {
    errors.push(`${label} is not a real date.`);
    return;
  }

  const nowYear = new Date().getUTCFullYear();
  if (year < nowYear - EXPIRY_BOUNDS.MAX_YEARS_PAST || year > nowYear + EXPIRY_BOUNDS.MAX_YEARS_FUTURE) {
    errors.push(`${label} does not look right — please check the year.`);
  }
}

/** An optional number within bounds. */
function optionalNumber(
  data: RequestData,
  key: string,
  label: string,
  max: number,
  errors: string[]
): void {
  if (!(key in data) || data[key] === null || data[key] === undefined || data[key] === "") return;
  const value = typeof data[key] === "string" ? Number(data[key]) : data[key];
  if (typeof value !== "number" || !Number.isFinite(value)) {
    errors.push(`${label} must be a number.`);
    return;
  }
  if (value < 0) errors.push(`${label} cannot be negative.`);
  if (value > max) errors.push(`${label} looks too large — please check it.`);
}

// ── Vehicle ──────────────────────────────────────────────────────────────────

const VEHICLE_FIELDS = ["registrationNumber", "vehicleType", "make", "model"] as const;

function validateVehicleFields(data: RequestData, errors: string[], partial: boolean): void {
  if (!partial || "registrationNumber" in data) {
    requireText(
      data,
      "registrationNumber",
      "The vehicle number",
      FIELD_LIMITS.REGISTRATION,
      errors,
      // Four characters is shorter than any real plate and is only here to
      // catch an empty-ish entry. Format is deliberately not checked: older and
      // out-of-state plates do not match the current pattern, and turning those
      // customers away at the first field is how this product loses them.
      4
    );
  }
  if (!partial || "vehicleType" in data) {
    if (!isVehicleType(data.vehicleType)) {
      errors.push(`Please choose a vehicle type: ${VEHICLE_TYPES.join(", ").toLowerCase()}.`);
    }
  }
  optionalText(data, "make", "The make", FIELD_LIMITS.MAKE, errors);
  optionalText(data, "model", "The model", FIELD_LIMITS.MODEL, errors);
}

export const vehicleCreateSchema = (data: RequestData): ValidationErrors => {
  const errors: string[] = [];
  rejectUnknown(data, VEHICLE_FIELDS, errors);
  validateVehicleFields(data, errors, false);
  return errors.length > 0 ? errors : null;
};

export const vehicleUpdateSchema = (data: RequestData): ValidationErrors => {
  const errors: string[] = [];
  rejectUnknown(data, VEHICLE_FIELDS, errors);
  if (Object.keys(data).length === 0) errors.push("Provide at least one field to update.");
  validateVehicleFields(data, errors, true);
  return errors.length > 0 ? errors : null;
};

// ── Policy ───────────────────────────────────────────────────────────────────

/**
 * Everything a policy may carry, on create or update.
 *
 * The vehicle arrives nested rather than as a separate call, because a customer
 * filling in one form should not be able to end up with a vehicle saved and a
 * policy lost. The service writes both in one transaction.
 */
const POLICY_FIELDS = [
  "insurer",
  "policyNumber",
  "policyType",
  "startDate",
  "expiryDate",
  "idv",
  "ncbPercent",
  "vehicle",
  "vehicleId",
] as const;

function rejectUnknown(data: RequestData, allowed: readonly string[], errors: string[]): void {
  const permitted = new Set<string>(allowed);
  const unknown = Object.keys(data).filter((key) => !permitted.has(key));
  if (unknown.length > 0) {
    errors.push(`These fields cannot be set here: ${unknown.sort().join(", ")}.`);
  }
}

function validatePolicyFields(data: RequestData, errors: string[], partial: boolean): void {
  if (!partial || "insurer" in data) {
    requireText(data, "insurer", "The insurer's name", FIELD_LIMITS.INSURER, errors, 2);
  }
  if (!partial || "policyNumber" in data) {
    requireText(data, "policyNumber", "The policy number", FIELD_LIMITS.POLICY_NUMBER, errors, 3);
  }
  if (!partial || "policyType" in data) {
    if (!isPolicyType(data.policyType)) {
      errors.push(
        `Please choose a policy type. If you are not sure, choose "unknown" — that is a real answer and we will help you find out. (${POLICY_TYPES.join(", ")})`
      );
    }
  }

  // The one date that is not optional. Everything this product does — the
  // status band, the urgency, the reminder — is derived from it, and a policy
  // without one cannot be given the answer the customer came for.
  if (!partial || "expiryDate" in data) {
    validateDate(data.expiryDate, "The expiry date", errors, { required: true });
  }
  validateDate(data.startDate, "The start date", errors, { required: false });

  optionalNumber(data, "idv", "The IDV", IDV_MAX, errors);
  optionalNumber(data, "ncbPercent", "The no-claim bonus", NCB_MAX_PERCENT, errors);

  // A start date after the expiry date is a transposition, and it is worth
  // catching here: stored, it would produce a confident status from a policy
  // that never existed as described.
  const start = typeof data.startDate === "string" ? data.startDate : null;
  const expiry = typeof data.expiryDate === "string" ? data.expiryDate : null;
  if (start && expiry && DATE_ONLY.test(start) && DATE_ONLY.test(expiry) && start >= expiry) {
    errors.push("The start date must be before the expiry date — please check the two.");
  }
}

function validateNestedVehicle(data: RequestData, errors: string[], partial: boolean): void {
  const hasVehicle = "vehicle" in data && data.vehicle !== null && data.vehicle !== undefined;
  const hasVehicleId = typeof data.vehicleId === "string" && data.vehicleId.length > 0;

  if (hasVehicle && hasVehicleId) {
    errors.push("Send either an existing vehicle or a new one, not both.");
    return;
  }

  if (hasVehicle) {
    if (typeof data.vehicle !== "object" || Array.isArray(data.vehicle)) {
      errors.push("The vehicle details are not in a form we can read.");
      return;
    }
    const nested = data.vehicle as RequestData;
    rejectUnknown(nested, VEHICLE_FIELDS, errors);
    validateVehicleFields(nested, errors, false);
    return;
  }

  if (!hasVehicleId && !partial) {
    errors.push("Please tell us which vehicle this policy covers.");
  }
}

export const consumerPolicyCreateSchema = (data: RequestData): ValidationErrors => {
  const errors: string[] = [];
  rejectUnknown(data, POLICY_FIELDS, errors);
  validatePolicyFields(data, errors, false);
  validateNestedVehicle(data, errors, false);
  return errors.length > 0 ? errors : null;
};

export const consumerPolicyUpdateSchema = (data: RequestData): ValidationErrors => {
  const errors: string[] = [];
  rejectUnknown(data, POLICY_FIELDS, errors);
  if (Object.keys(data).length === 0) errors.push("Provide at least one field to update.");
  validatePolicyFields(data, errors, true);
  validateNestedVehicle(data, errors, true);
  return errors.length > 0 ? errors : null;
};

/** `?locale=` on a read. Absent means the customer's stored preference. */
export const consumerLocaleQuerySchema = (data: RequestData): ValidationErrors => {
  if (data.locale === undefined) return null;
  if (typeof data.locale === "string" && ["en", "ta", "taEn"].includes(data.locale)) return null;
  return ["Unknown language."];
};

/**
 * `?policyId=` on the document list.
 *
 * Narrow on purpose: an id, or nothing. It is not an authorisation boundary —
 * the service scopes every read to the caller regardless of what arrives here —
 * but an unbounded string reaching a `where` clause is worth refusing at the
 * door rather than reasoning about downstream.
 */
export const consumerDocumentQuerySchema = (data: RequestData): ValidationErrors => {
  if (data.policyId === undefined) return null;
  if (typeof data.policyId !== "string" || data.policyId.trim() === "") {
    return ["Tell us which policy, or ask for all of them."];
  }
  if (data.policyId.length > 64) return ["That policy id is not one we recognise."];
  return null;
};

// ── Renewal help and consent ─────────────────────────────────────────────────

const CONSENT_FIELDS = ["channel", "purpose", "policyId"] as const;

/**
 * Recording a consent.
 *
 * The wording is deliberately not accepted from the client. A consent stores
 * which text was agreed to, and taking that text from the browser would let the
 * record say whatever the sender liked — the point of the hash is that the
 * server decides what the words were. Only the choices come in.
 */
export const consentCreateSchema = (data: RequestData): ValidationErrors => {
  const errors: string[] = [];
  rejectUnknown(data, CONSENT_FIELDS, errors);

  if (!isContactChannel(data.channel)) {
    errors.push(`Please choose how we may contact you: ${CONTACT_CHANNELS.join(", ").toLowerCase()}.`);
  }
  if (!isConsentPurpose(data.purpose)) {
    errors.push(`Please say what this permission is for: ${CONSENT_PURPOSES.join(", ")}.`);
  }
  if (data.policyId !== undefined && data.policyId !== null) {
    if (typeof data.policyId !== "string" || data.policyId.length > 64) {
      errors.push("That policy id is not one we recognise.");
    }
  }

  return errors.length > 0 ? errors : null;
};

const RENEWAL_REQUEST_FIELDS = ["preferredChannel", "contactPhone", "alsoRemind", "agreed"] as const;

/**
 * Asking for help renewing.
 *
 * `agreed` must be exactly `true`. Not truthy — `true`. A consent screen whose
 * agreement can be satisfied by the string "no" or by the number 1 is not a
 * consent screen, and this is the field the whole record rests on.
 */
export const renewalRequestSchema = (data: RequestData): ValidationErrors => {
  const errors: string[] = [];
  rejectUnknown(data, RENEWAL_REQUEST_FIELDS, errors);

  if (!isContactChannel(data.preferredChannel)) {
    errors.push(`Please choose how we may contact you: ${CONTACT_CHANNELS.join(", ").toLowerCase()}.`);
  }
  if (data.agreed !== true) {
    errors.push("Please agree to be contacted before we pass your request on.");
  }
  if (data.alsoRemind !== undefined && typeof data.alsoRemind !== "boolean") {
    errors.push("The reminder choice must be yes or no.");
  }

  // Required for the two channels that need one, and bounded but not
  // pattern-matched. Numbers arrive with spaces, dashes, a country code or
  // none, and turning away a real number because of its punctuation is how this
  // flow loses the person it was built for. The service refuses an empty one.
  if (data.preferredChannel === "CALL" || data.preferredChannel === "WHATSAPP") {
    const phone = typeof data.contactPhone === "string" ? data.contactPhone.trim() : "";
    const digits = phone.replace(/\D/g, "");
    if (digits.length < 8 || digits.length > 15) {
      errors.push("Please give us a number we can reach you on, or choose email instead.");
    }
    if (phone.length > 32) errors.push("That number is longer than any we can dial.");
  } else if (data.contactPhone !== undefined && data.contactPhone !== null) {
    if (typeof data.contactPhone !== "string" || data.contactPhone.length > 32) {
      errors.push("That number is longer than any we can dial.");
    }
  }

  return errors.length > 0 ? errors : null;
};

// ── Aegis Kural Lite ─────────────────────────────────────────────────────────

const ASK_FIELDS = ["question", "policyId"] as const;

/**
 * A question for the assistant.
 *
 * Bounded hard, and refused rather than truncated. A 500-character limit is
 * generous for any real question about motor insurance, and silently cutting a
 * longer one would answer a question the customer did not finish asking.
 *
 * The service refuses an empty question too, and answers it as "I could not
 * read that" rather than as a validation error — the two are different things
 * to a person, and only one of them is worth a red message.
 */
export const kuralAskSchema = (data: RequestData): ValidationErrors => {
  const errors: string[] = [];
  rejectUnknown(data, ASK_FIELDS, errors);

  if (typeof data.question !== "string") {
    errors.push("Please type a question.");
  } else if (data.question.length > 500) {
    errors.push("That is longer than we can read. Please ask in a sentence or two.");
  }

  if (data.policyId !== undefined && data.policyId !== null) {
    if (typeof data.policyId !== "string" || data.policyId.length > 64) {
      errors.push("That policy id is not one we recognise.");
    }
  }

  return errors.length > 0 ? errors : null;
};
