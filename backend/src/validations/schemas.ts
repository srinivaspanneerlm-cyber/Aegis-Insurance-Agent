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
  if (!data.password || typeof data.password !== "string" || data.password.length < 6) {
    errors.push("Password must be at least 6 characters long.");
  } else if (Buffer.byteLength(data.password, "utf8") > 72) {
    // bcrypt silently truncates input beyond 72 bytes, so anything longer is
    // both a correctness hazard and a hashing-DoS vector. Reject it explicitly.
    errors.push("Password must not exceed 72 bytes.");
  }
  if (data.role && !["customer", "admin", "superadmin"].includes(data.role as string)) {
    errors.push("Role must be one of: customer, admin, superadmin.");
  }
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
  return errors.length > 0 ? errors : null;
};

export const googleLoginSchema = (data: RequestData): ValidationErrors => {
  const errors: string[] = [];
  // The Google ID token is a compact JWT — a few hundred to ~2 KB. Bound it so
  // an oversized body can't be pushed into the verifier.
  if (!data.credential || typeof data.credential !== "string") {
    errors.push("A Google credential is required.");
  } else if (data.credential.length > 4096) {
    errors.push("Invalid Google credential.");
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
