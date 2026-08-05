/**
 * What counts as an acceptable password.
 *
 * The rule this replaces was "at least 6 characters", which is the same bar for
 * a customer reading about cover and for an operator who can reconfigure the
 * platform. Length is the only property that reliably resists guessing, so it
 * carries most of the weight here — but the realm decides how much.
 *
 * Deliberately NOT a complexity maze. Forcing an uppercase, a digit and a
 * symbol into eight characters reliably produces `Password1!`, and it is
 * hostile to exactly the people this platform is for: senior citizens, people
 * typing on a phone keypad, people whose first script is not Latin. A long
 * passphrase is both stronger and easier, so the rules reward it.
 */

/**
 * bcrypt silently truncates beyond 72 *bytes*, so anything longer is both a
 * correctness hazard (two different passwords hashing the same) and a
 * hashing-cost vector. Measured in bytes, not characters — a Tamil passphrase
 * reaches 72 bytes in about 24 characters.
 */
export const MAX_PASSWORD_BYTES = 72;

/**
 * A short list of the passwords that appear in every breach corpus, plus the
 * ones this product invites by name. Not a substitute for a real breached-
 * password check — that belongs behind an API and is noted as owed work — but
 * it costs nothing and stops the worst of it.
 */
const OBVIOUS = new Set([
  "password",
  "password1",
  "password123",
  "12345678",
  "123456789",
  "1234567890",
  "qwertyuiop",
  "iloveyou",
  "welcome1",
  "letmein1",
  "admin123",
  "administrator",
  "aegis123",
  "aegisai",
  "insurance",
  "changeme",
  "trustno1",
]);

export interface PasswordPolicy {
  readonly minLength: number;
  /** Distinct characters required, which is what stops `aaaaaaaaaaaa`. */
  readonly minDistinct: number;
  /** Whether a mix of character classes is demanded on top of length. */
  readonly requiresMixedClasses: boolean;
}

/**
 * Customers get a length floor and nothing else to fight with. Staff realms add
 * more length, and the platform realm adds mixed classes on top — not because
 * classes are strong, but because that realm's credential is also the one a
 * targeted attacker would go after by hand.
 */
export const PASSWORD_POLICIES = {
  CUSTOMER: { minLength: 10, minDistinct: 5, requiresMixedClasses: false },
  EMPLOYEE: { minLength: 12, minDistinct: 6, requiresMixedClasses: false },
  ENTERPRISE: { minLength: 12, minDistinct: 6, requiresMixedClasses: false },
  PLATFORM: { minLength: 14, minDistinct: 8, requiresMixedClasses: true },
} as const satisfies Record<string, PasswordPolicy>;

export type PasswordRealm = keyof typeof PASSWORD_POLICIES;

export interface PasswordCheck {
  readonly ok: boolean;
  /** Every failure at once. Revealing them one at a time is a guessing game. */
  readonly problems: readonly string[];
}

/**
 * Check a password against a realm's policy.
 *
 * Returns *all* the problems rather than the first. A form that reports one
 * rule per submission teaches the rules by attrition, and people respond by
 * appending `1!` until it stops complaining.
 *
 * `identity` — the person's email and name — is compared against because a
 * password containing your own address is guessable by anyone holding the
 * address, which is everyone we just sent mail to.
 */
export function checkPassword(
  password: string,
  realm: PasswordRealm = "CUSTOMER",
  identity: { email?: string | undefined; name?: string | undefined } = {}
): PasswordCheck {
  const policy = PASSWORD_POLICIES[realm];
  const problems: string[] = [];

  if (password.length < policy.minLength) {
    problems.push(`Use at least ${policy.minLength} characters. A short phrase works well.`);
  }

  if (Buffer.byteLength(password, "utf8") > MAX_PASSWORD_BYTES) {
    problems.push("That is longer than we can store safely. Please shorten it a little.");
  }

  if (new Set(password).size < policy.minDistinct) {
    problems.push("Use a few more different characters.");
  }

  if (policy.requiresMixedClasses) {
    const classes = [/[a-z]/, /[A-Z]/, /\d/, /[^\w\s]/].filter((re) => re.test(password)).length;
    if (classes < 3) {
      problems.push("Include a mix of upper and lower case, numbers and symbols.");
    }
  }

  const lowered = password.toLowerCase();
  if (OBVIOUS.has(lowered)) {
    problems.push("That password appears in every list attackers try first.");
  }

  // A long run of one repeated character, or a straight keyboard/alphabet run.
  if (/(.)\1{3,}/.test(password)) {
    problems.push("Avoid repeating the same character several times.");
  }
  if (hasLongRun(lowered)) {
    problems.push("Avoid sequences like 1234 or abcd.");
  }

  const email = identity.email?.toLowerCase().trim();
  if (email) {
    const local = email.split("@")[0];
    if (lowered.includes(email) || (local && local.length >= 4 && lowered.includes(local))) {
      problems.push("Do not use your email address in your password.");
    }
  }

  const name = identity.name?.toLowerCase().trim();
  if (name && name.length >= 4 && lowered.includes(name)) {
    problems.push("Do not use your name in your password.");
  }

  return { ok: problems.length === 0, problems };
}

/** Four or more consecutive code points ascending or descending by one. */
function hasLongRun(value: string): boolean {
  let ascending = 1;
  let descending = 1;
  for (let i = 1; i < value.length; i += 1) {
    const step = value.charCodeAt(i) - value.charCodeAt(i - 1);
    ascending = step === 1 ? ascending + 1 : 1;
    descending = step === -1 ? descending + 1 : 1;
    if (ascending >= 4 || descending >= 4) return true;
  }
  return false;
}
