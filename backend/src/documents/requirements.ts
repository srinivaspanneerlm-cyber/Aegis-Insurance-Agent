/**
 * What documents an application needs, decided rather than hardcoded.
 *
 * The brief for this platform was explicit that upload cards must not be a
 * fixed list per product in the interface, and that is right for a reason worth
 * stating: the required set genuinely varies. A motor claim for a company car
 * needs the company's registration; a health claim under a family floater needs
 * proof of relationship; a travel claim from a student needs their enrolment.
 * A hardcoded list in the front end cannot express any of that.
 *
 * So this module is the *catalogue* — every document the platform knows how to
 * ask for, with what it is for — and a resolver that turns a situation into a
 * list of requests. The interface renders whatever requests exist. Adding a
 * product means adding entries here; changing what a customer is asked means
 * writing different rows, and no front-end change at all.
 */

export const DOMAINS = ["health", "motor", "travel", "home-property", "general"] as const;
export type Domain = (typeof DOMAINS)[number];

export const isDomain = (value: unknown): value is Domain =>
  typeof value === "string" && (DOMAINS as readonly string[]).includes(value);

export interface DocumentSpec {
  readonly key: string;
  readonly label: string;
  /** What it is for, in the customer's terms. Shown next to the upload card. */
  readonly reason: string;
  readonly category: string;
  /** Formats that make sense for this document, narrower than the global list. */
  readonly accepts: readonly string[];
  /** Whether more than one file answers it — vehicle photographs, for example. */
  readonly multiple?: boolean;
}

const IMAGE = ["image/png", "image/jpeg", "image/webp", "image/heic"];
const DOCUMENT = ["application/pdf", "image/png", "image/jpeg", "image/webp", "image/heic"];
const MEDIA = [...IMAGE, "video/mp4", "video/quicktime"];

/**
 * The catalogue.
 *
 * Keyed rather than listed per product, so the same document asked for by two
 * domains is one entry — a customer who has already supplied their ID proof for
 * a health application should not be asked for it again by a motor one, and
 * that can only be recognised if both call it the same thing.
 */
export const DOCUMENT_CATALOGUE: Record<string, DocumentSpec> = {
  // Identity — shared across every domain.
  id_proof: {
    key: "id_proof",
    label: "Photo identity",
    reason: "To confirm you are the person named on the policy.",
    category: "identity",
    accepts: DOCUMENT,
  },
  address_proof: {
    key: "address_proof",
    label: "Address proof",
    reason: "To confirm where you live, which affects what cover is available.",
    category: "identity",
    accepts: DOCUMENT,
  },

  // Motor.
  rc_book: {
    key: "rc_book",
    label: "Vehicle registration certificate",
    reason: "To confirm the vehicle is registered to you.",
    category: "vehicle",
    accepts: DOCUMENT,
  },
  driving_licence: {
    key: "driving_licence",
    label: "Driving licence",
    reason: "To confirm the driver is licensed for this class of vehicle.",
    category: "vehicle",
    accepts: DOCUMENT,
  },
  vehicle_photos: {
    key: "vehicle_photos",
    label: "Photographs of the vehicle",
    reason: "To record its condition. Take all four sides, plus any damage.",
    category: "vehicle",
    accepts: MEDIA,
    multiple: true,
  },
  existing_policy: {
    key: "existing_policy",
    label: "Current insurance certificate",
    reason: "To carry over your no-claim bonus, which is often worth more than the paperwork.",
    category: "policy",
    accepts: DOCUMENT,
  },

  // Health.
  medical_report: {
    key: "medical_report",
    label: "Medical report",
    reason: "To understand the treatment being claimed for.",
    category: "medical",
    accepts: DOCUMENT,
  },
  prescription: {
    key: "prescription",
    label: "Prescription",
    reason: "To match the medication to the treatment.",
    category: "medical",
    accepts: DOCUMENT,
  },
  hospital_bill: {
    key: "hospital_bill",
    label: "Hospital bill",
    reason: "The itemised bill is what the settlement is calculated from.",
    category: "medical",
    accepts: DOCUMENT,
  },
  discharge_summary: {
    key: "discharge_summary",
    label: "Discharge summary",
    reason: "It records the diagnosis and the dates of admission.",
    category: "medical",
    accepts: DOCUMENT,
  },

  // Travel.
  passport: {
    key: "passport",
    label: "Passport",
    reason: "To confirm identity and that the passport is valid for the trip.",
    category: "travel",
    accepts: DOCUMENT,
  },
  visa: {
    key: "visa",
    label: "Visa",
    reason: "Cover depends on where you are travelling and on what basis.",
    category: "travel",
    accepts: DOCUMENT,
  },
  travel_tickets: {
    key: "travel_tickets",
    label: "Tickets or itinerary",
    reason: "To establish the travel dates the cover has to span.",
    category: "travel",
    accepts: DOCUMENT,
  },
  boarding_pass: {
    key: "boarding_pass",
    label: "Boarding pass",
    reason: "Evidence the journey was actually taken.",
    category: "travel",
    accepts: DOCUMENT,
  },

  // Property.
  property_deed: {
    key: "property_deed",
    label: "Property deed",
    reason: "To confirm ownership of the property being insured.",
    category: "property",
    accepts: DOCUMENT,
  },
  tax_receipt: {
    key: "tax_receipt",
    label: "Property tax receipt",
    reason: "To confirm the property's assessed value and that rates are current.",
    category: "property",
    accepts: DOCUMENT,
  },
  property_photos: {
    key: "property_photos",
    label: "Photographs of the property",
    reason: "To record its condition and construction.",
    category: "property",
    accepts: MEDIA,
    multiple: true,
  },
};

export interface RequirementContext {
  readonly domain: Domain;
  /** APPLICATION | CLAIM | RENEWAL | KYC — what the customer is doing. */
  readonly purpose: "APPLICATION" | "CLAIM" | "RENEWAL" | "KYC";
  /** Keys the customer has already supplied and had verified. */
  readonly alreadyHeld?: readonly string[];
  /** Circumstances an agent has established. Drives the conditional rules. */
  readonly facts?: {
    readonly commercialVehicle?: boolean;
    readonly hospitalised?: boolean;
    readonly international?: boolean;
    readonly tenant?: boolean;
  };
}

export interface ResolvedRequirement {
  readonly spec: DocumentSpec;
  readonly required: boolean;
  /** Why this one, for this customer. More specific than the catalogue reason. */
  readonly reason: string;
}

/**
 * Turn a situation into a list of documents to ask for.
 *
 * Deterministic, and that is deliberate even in a platform full of agents: a
 * customer asking "why do you need this" deserves an answer that is the same
 * every time, and an agent that decided differently on two identical
 * applications would be indefensible at complaint time. The agent's job is to
 * establish the *facts*; this decides what those facts require.
 *
 * `alreadyHeld` is filtered out at the end rather than considered per rule, so
 * a document verified for one application is never asked for twice.
 */
export function resolveRequirements(context: RequirementContext): ResolvedRequirement[] {
  const facts = context.facts ?? {};
  const out: ResolvedRequirement[] = [];

  const add = (key: string, required: boolean, reason?: string) => {
    const spec = DOCUMENT_CATALOGUE[key];
    if (!spec) return;
    out.push({ spec, required, reason: reason ?? spec.reason });
  };

  // Identity is asked for once, by whichever domain gets there first.
  add("id_proof", true);

  switch (context.domain) {
    case "motor":
      add("rc_book", true);
      add("driving_licence", true);
      if (context.purpose === "CLAIM") {
        add("vehicle_photos", true, "To record the damage being claimed for.");
      } else {
        add("vehicle_photos", false, "Optional, but it speeds up the first claim if one happens.");
      }
      add("existing_policy", false);
      if (facts.commercialVehicle) {
        add(
          "address_proof",
          true,
          "Commercial vehicles are rated on where they are garaged, so we need the address."
        );
      }
      break;

    case "health":
      if (context.purpose === "CLAIM") {
        add("hospital_bill", true);
        add("medical_report", true);
        add("prescription", false);
        if (facts.hospitalised) {
          add("discharge_summary", true, "An inpatient claim is settled from the discharge summary.");
        }
      } else {
        add("medical_report", false, "Recent reports help us price the cover accurately.");
      }
      break;

    case "travel":
      add("passport", true);
      add("travel_tickets", true);
      if (facts.international) {
        add("visa", true, "Cover abroad depends on your right to enter the country.");
      }
      if (context.purpose === "CLAIM") {
        add("boarding_pass", true, "Evidence the journey was taken as planned.");
      }
      break;

    case "home-property":
      if (facts.tenant) {
        add(
          "address_proof",
          true,
          "As a tenant you are insuring contents, so we need proof you live there rather than a deed."
        );
      } else {
        add("property_deed", true);
        add("tax_receipt", false);
      }
      add("property_photos", context.purpose === "CLAIM", "To record the property's condition.");
      break;

    case "general":
      add("address_proof", false);
      break;
  }

  const held = new Set(context.alreadyHeld ?? []);
  const seen = new Set<string>();

  return out.filter((requirement) => {
    if (held.has(requirement.spec.key)) return false;
    // A rule may add the same key twice with different reasons; the first wins,
    // because the more specific rule is always the one added later and would
    // otherwise overwrite a required flag with an optional one.
    if (seen.has(requirement.spec.key)) return false;
    seen.add(requirement.spec.key);
    return true;
  });
}

/** How complete a set of requests is, for the progress a customer sees. */
export function completeness(
  requests: readonly { required: boolean; status: string }[]
): { total: number; supplied: number; requiredOutstanding: number; percent: number } {
  const total = requests.length;
  const supplied = requests.filter((r) => r.status === "SUPPLIED" || r.status === "WAIVED").length;
  const requiredOutstanding = requests.filter(
    (r) => r.required && r.status === "PENDING"
  ).length;

  return {
    total,
    supplied,
    requiredOutstanding,
    // Measured against required items only. Counting optional ones would show a
    // customer 60% when they are actually ready to proceed.
    percent: total === 0 ? 100 : Math.round((supplied / total) * 100),
  };
}
