import { ONBOARDING } from "../config/constants";

type RequestData = Record<string, unknown>;
type ValidationErrors = string[] | null;

const validateEmail = (email: unknown): boolean => {
  if (typeof email !== "string") return false;
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return re.test(email);
};

export const registerSchema = (data: RequestData): ValidationErrors => {
  const errors: string[] = [];
  if (!data.name || typeof data.name !== "string" || data.name.trim().length < 2) {
    errors.push("Name must be at least 2 characters long.");
  }
  if (!data.email || !validateEmail(data.email)) {
    errors.push("A valid email address is required.");
  }
  // Presence only. How *strong* a password must be depends on the realm the
  // account belongs to, so that judgement lives in `auth/password.ts` and is
  // made once — including the bcrypt 72-byte ceiling, which used to be checked
  // here and would have drifted the moment a second entry point appeared.
  if (!data.password || typeof data.password !== "string") {
    errors.push("A password is required.");
  }
  // `role` is deliberately NOT validated here, and must never be.
  //
  // Validating it implied the field was accepted, which invited exactly the
  // wrong reading of this endpoint. Public registration always produces a
  // CUSTOMER; the service hardcodes it and ignores the body. A role is granted
  // by somebody who already holds the authority to grant it, through a
  // different route entirely.
  return errors.length > 0 ? errors : null;
};

export const loginSchema = (data: RequestData): ValidationErrors => {
  const errors: string[] = [];
  if (!data.email || !validateEmail(data.email)) {
    errors.push("A valid email address is required.");
  }
  if (!data.password) {
    errors.push("Password is required.");
  }
  validateOptionalRealm(data, errors);
  return errors.length > 0 ? errors : null;
};

/**
 * Re-confirmation before an irreversible action. Either a password or a
 * provider credential — an account created through a provider has a random
 * password it was never told, so demanding one would lock those holders out of
 * exactly the actions this protects.
 */
export const stepUpSchema = (data: RequestData): ValidationErrors => {
  const errors: string[] = [];
  const hasPassword = typeof data.password === "string" && data.password.length > 0;
  const hasCredential =
    typeof data.credential === "string" && typeof data.provider === "string";

  if (!hasPassword && !hasCredential) {
    errors.push("A password or a provider credential is required.");
  }
  if (hasPassword && (data.password as string).length > 200) {
    errors.push("Invalid password.");
  }
  if (hasCredential && (data.credential as string).length > 4096) {
    errors.push("Invalid sign-in credential.");
  }
  return errors.length > 0 ? errors : null;
};

const REALM_VALUES = ["CUSTOMER", "EMPLOYEE", "ENTERPRISE", "PLATFORM"];

/** Optional on every auth route; absent means the customer portal. */
const validateOptionalRealm = (data: RequestData, errors: string[]): void => {
  if (data.realm !== undefined && !REALM_VALUES.includes(data.realm as string)) {
    errors.push("Unknown portal.");
  }
};

export const emailOnlySchema = (data: RequestData): ValidationErrors => {
  const errors: string[] = [];
  if (!data.email || !validateEmail(data.email)) {
    errors.push("A valid email address is required.");
  }
  return errors.length > 0 ? errors : null;
};

/**
 * A one-time token from a link. Bounded and shape-checked only — whether it is
 * *valid* is a question for the store, and answering it here would leak which
 * tokens exist.
 */
const validateToken = (value: unknown, errors: string[]): void => {
  if (!value || typeof value !== "string" || value.length < 20 || value.length > 512) {
    errors.push("That link is not valid.");
  }
};

export const verifyEmailSchema = (data: RequestData): ValidationErrors => {
  const errors: string[] = [];
  validateToken(data.token, errors);
  return errors.length > 0 ? errors : null;
};

export const resetPasswordSchema = (data: RequestData): ValidationErrors => {
  const errors: string[] = [];
  validateToken(data.token, errors);
  // Strength is judged by the realm's policy in the service, which is the only
  // place that knows which realm the token's owner belongs to.
  if (!data.password || typeof data.password !== "string") {
    errors.push("A new password is required.");
  }
  return errors.length > 0 ? errors : null;
};

export const changePasswordSchema = (data: RequestData): ValidationErrors => {
  const errors: string[] = [];
  if (!data.currentPassword || typeof data.currentPassword !== "string") {
    errors.push("Your current password is required.");
  }
  if (!data.newPassword || typeof data.newPassword !== "string") {
    errors.push("A new password is required.");
  }
  return errors.length > 0 ? errors : null;
};

export const providerCredentialSchema = (data: RequestData): ValidationErrors => {
  const errors: string[] = [];
  // An OIDC ID token is a compact JWT — a few hundred bytes to ~2 KB. Bound it
  // so an oversized body can't be pushed into a provider's verifier.
  if (!data.credential || typeof data.credential !== "string") {
    errors.push("A sign-in credential is required.");
  } else if (data.credential.length > 4096) {
    errors.push("Invalid sign-in credential.");
  }
  validateOptionalRealm(data, errors);
  return errors.length > 0 ? errors : null;
};

/**
 * First-time onboarding answers. Both fields are allowlisted rather than merely
 * bounded: these values are written to the customer's profile and later drive
 * which advisor they meet, so free text has no business reaching them.
 */
export const onboardingSchema = (data: RequestData): ValidationErrors => {
  const errors: string[] = [];

  if (!ONBOARDING.LANGUAGES.includes(data.preferredLanguage as never)) {
    errors.push(`Preferred language must be one of: ${ONBOARDING.LANGUAGES.join(", ")}.`);
  }

  const interests = data.insuranceInterests;
  if (!Array.isArray(interests) || interests.length === 0) {
    errors.push("Please choose at least one insurance interest.");
  } else if (interests.length > ONBOARDING.MAX_INTERESTS) {
    errors.push(`Please choose at most ${ONBOARDING.MAX_INTERESTS} interests.`);
  } else if (interests.some((i) => !ONBOARDING.INTERESTS.includes(i as never))) {
    errors.push(`Interests must be from: ${ONBOARDING.INTERESTS.join(", ")}.`);
  } else if (new Set(interests).size !== interests.length) {
    errors.push("Interests must not repeat.");
  }

  return errors.length > 0 ? errors : null;
};

export const leadSchema = (data: RequestData): ValidationErrors => {
  const errors: string[] = [];
  if (!data.customerName || typeof data.customerName !== "string" || data.customerName.trim().length < 2) {
    errors.push("Customer name must be at least 2 characters long.");
  }
  if (!data.email || !validateEmail(data.email)) {
    errors.push("A valid email address is required.");
  }
  if (!data.phone || typeof data.phone !== "string" || data.phone.trim().length < 8) {
    errors.push("A valid contact number is required.");
  }
  if (!data.insuranceType || typeof data.insuranceType !== "string") {
    errors.push("Insurance type is required.");
  }
  if (!data.budget || typeof data.budget !== "string") {
    errors.push("Monthly budget scope selection is required.");
  }
  return errors.length > 0 ? errors : null;
};

/**
 * Fields a lead update may carry.
 *
 * `status` is included; the five identity fields are the same ones `leadSchema`
 * accepts on create. Nothing else is writable through this route.
 */
const LEAD_UPDATABLE = [
  "customerName",
  "email",
  "phone",
  "insuranceType",
  "budget",
  "status",
] as const;

/**
 * Statuses an operator may set.
 *
 * The first five are the pipeline the schema documents. `approved` is included
 * because the platform itself produces it — the auto-qualify job writes it —
 * and every lead in an existing deployment carries it, so refusing it would
 * reject a request that is both ordinary and already true of the record.
 */
const LEAD_STATUSES = ["pending", "contacted", "qualified", "won", "lost", "approved"];

/**
 * A partial update to a lead.
 *
 * Separate from `leadSchema` because create and update are different shapes:
 * create requires every identity field, update requires only that at least one
 * known field is present.
 *
 * The important half is the rejection of unknown keys. This route previously
 * had no body validation at all, and `leadService.update` spreads what it is
 * given straight into the row — so `deletedAt` soft-deleted a lead without the
 * `lead.delete` capability, which no role holding `lead.write` has. An
 * allow-list is the only form that closes that: listing the fields to reject
 * would have to be updated every time a column is added.
 */
export const leadUpdateSchema = (data: RequestData): ValidationErrors => {
  const errors: string[] = [];
  const allowed = new Set<string>(LEAD_UPDATABLE);

  const unknown = Object.keys(data).filter((key) => !allowed.has(key));
  if (unknown.length > 0) {
    errors.push(`These fields cannot be updated: ${unknown.sort().join(", ")}.`);
  }

  const provided = Object.keys(data).filter((key) => allowed.has(key));
  if (provided.length === 0 && unknown.length === 0) {
    errors.push("Provide at least one field to update.");
  }

  // Each field is checked only when present — this is a partial update, and an
  // absent field means "leave it alone", not "clear it".
  if ("customerName" in data) {
    if (typeof data.customerName !== "string" || data.customerName.trim().length < 2) {
      errors.push("Customer name must be at least 2 characters long.");
    }
  }
  if ("email" in data && !validateEmail(data.email)) {
    errors.push("A valid email address is required.");
  }
  if ("phone" in data) {
    if (typeof data.phone !== "string" || data.phone.trim().length < 8) {
      errors.push("A valid contact number is required.");
    }
  }
  if ("insuranceType" in data && typeof data.insuranceType !== "string") {
    errors.push("Insurance type must be text.");
  }
  if ("budget" in data && typeof data.budget !== "string") {
    errors.push("Monthly budget scope must be text.");
  }
  if ("status" in data) {
    if (typeof data.status !== "string" || !LEAD_STATUSES.includes(data.status)) {
      errors.push(`Status must be one of: ${LEAD_STATUSES.join(", ")}.`);
    }
  }

  return errors.length > 0 ? errors : null;
};

export const policySchema = (data: RequestData): ValidationErrors => {
  const errors: string[] = [];
  if (!data.policyName || typeof data.policyName !== "string") {
    errors.push("Policy name is required.");
  }
  if (data.premium === undefined || typeof data.premium !== "number" || data.premium <= 0) {
    errors.push("Premium must be a positive numeric value.");
  }
  if (!data.coverage || typeof data.coverage !== "string") {
    errors.push("Coverage limit parameter is required.");
  }
  if (!data.companyId || typeof data.companyId !== "string") {
    errors.push("Associated Company identifier is required.");
  }
  return errors.length > 0 ? errors : null;
};

// ── Route params & query ─────────────────────────────────────────────────────

// All model ids are UUIDs (Prisma @default(uuid())). Validating the shape stops
// a malformed :id before the service/Prisma — and avoids a Postgres uuid-parse
// 500 on the production DB path.
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const idParamSchema = (data: RequestData): ValidationErrors => {
  const id = data.id;
  if (typeof id !== "string" || !UUID_RE.test(id)) {
    return ["Route parameter 'id' is not a valid identifier."];
  }
  return null;
};

// Pagination query: page/limit are optional, but when present must be positive
// integers. (parsePageParams still bounds them; this returns a clear 400 for
// garbage instead of silently defaulting.)
export const paginationQuerySchema = (data: RequestData): ValidationErrors => {
  const errors: string[] = [];
  for (const key of ["page", "limit"] as const) {
    const raw = data[key];
    if (raw === undefined) continue;
    const value = Array.isArray(raw) ? raw[0] : raw;
    if (!/^\d+$/.test(String(value)) || parseInt(String(value), 10) < 1) {
      errors.push(`Query parameter '${key}' must be a positive integer.`);
    }
  }
  return errors.length > 0 ? errors : null;
};

/**
 * The enterprise console's list query.
 *
 * The console reads with `?take=` rather than `?page=`/`?limit=`, so it needs
 * its own schema — but the same contract: garbage gets a 400 that names the
 * parameter, not a silent default that leaves a caller believing their filter
 * was applied.
 *
 * The service still clamps `take`; this is about the answer a caller gets, not
 * about protecting the database. Above the cap is not an error — asking for
 * more rows than exist is a reasonable thing to do, and the server replies with
 * its maximum.
 */
const FILTER_MAX = 200;

export const enterpriseListQuerySchema = (data: RequestData): ValidationErrors => {
  const errors: string[] = [];

  const take = data.take;
  if (take !== undefined) {
    const value = Array.isArray(take) ? take[0] : take;
    if (!/^\d+$/.test(String(value)) || parseInt(String(value), 10) < 1) {
      errors.push("Query parameter 'take' must be a positive integer.");
    }
  }

  // Bounded because they reach a LIKE scan. A filter nobody could type is a
  // filter nobody meant.
  for (const key of ["search", "department", "status", "action"] as const) {
    const raw = data[key];
    if (raw === undefined) continue;
    if (typeof raw !== "string") {
      errors.push(`Query parameter '${key}' must be given once.`);
    } else if (raw.length > FILTER_MAX) {
      errors.push(`Query parameter '${key}' must be ${FILTER_MAX} characters or fewer.`);
    }
  }

  if (data.actorId !== undefined && (typeof data.actorId !== "string" || !UUID_RE.test(data.actorId))) {
    errors.push("Query parameter 'actorId' is not a valid identifier.");
  }

  // The only alternative representation the reports route serves. Anything else
  // silently returned JSON, so a client asking for `format=pdf` got JSON and no
  // indication that PDF does not exist.
  if (data.format !== undefined && data.format !== "csv") {
    errors.push("Query parameter 'format' must be 'csv' when given.");
  }

  return errors.length > 0 ? errors : null;
};
