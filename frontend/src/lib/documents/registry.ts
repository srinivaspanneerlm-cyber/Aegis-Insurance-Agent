import { resolveAdvisorKey, type AdvisorKey } from "@/lib/advisors";
import type {
  DocumentRequirement,
  LocalisedText,
  VerificationStageId,
} from "@/types/documents";

/**
 * The document catalogue.
 *
 * This is *data*, not logic: no component ever names a document, and adding a
 * new one is a single entry here. An agent can always override the catalogue at
 * runtime by naming its own documents (see `parseDocumentRequest`) — the
 * catalogue is the default the platform falls back to, never a hard gate.
 */

// ── Accepted media ───────────────────────────────────────────────────────────

export const MIME = {
  pdf: "application/pdf",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  png: "image/png",
  jpeg: "image/jpeg",
  heic: "image/heic",
  webp: "image/webp",
  mp4: "video/mp4",
  mov: "video/quicktime",
} as const;

/** Extensions accepted per MIME type. Browsers report HEIC and DOCX
 *  inconsistently (often as an empty type or `application/octet-stream`), so
 *  validation falls back to the extension whenever the reported type is
 *  unusable. */
export const EXTENSIONS: Record<string, string[]> = {
  [MIME.pdf]: [".pdf"],
  [MIME.docx]: [".docx"],
  [MIME.png]: [".png"],
  [MIME.jpeg]: [".jpg", ".jpeg"],
  [MIME.heic]: [".heic", ".heif"],
  [MIME.webp]: [".webp"],
  [MIME.mp4]: [".mp4"],
  [MIME.mov]: [".mov"],
};

/** Scanned paperwork — a PDF, a Word file, or a photo of the page. */
export const ACCEPT_PAPERWORK = [MIME.pdf, MIME.docx, MIME.png, MIME.jpeg, MIME.heic, MIME.webp];
/** Photographic evidence — vehicle damage, property condition. */
export const ACCEPT_IMAGERY = [MIME.png, MIME.jpeg, MIME.heic, MIME.webp];
/** Imagery plus walkaround video. */
export const ACCEPT_MEDIA = [...ACCEPT_IMAGERY, MIME.mp4, MIME.mov];
/** Everything the platform accepts — used by the composer's attachment menu. */
export const ACCEPT_ANY = [...ACCEPT_PAPERWORK, MIME.mp4, MIME.mov];

/** Platform-wide ceiling. Individual documents may set a lower `maxBytes`. */
export const MAX_UPLOAD_BYTES = 50 * 1024 * 1024;

// ── Catalogue ────────────────────────────────────────────────────────────────

export interface DocumentKindSpec {
  kind: string;
  label: LocalisedText;
  hint?: LocalisedText;
  icon: string;
  accept: string[];
  maxBytes: number;
  multiple: boolean;
  /** Lowercase phrases an agent uses when it names this document in prose.
   *  Order matters only for readability; matching scans them all. */
  aliases: string[];
  /** Verification stages this document must clear, in order. */
  stages: VerificationStageId[];
}

const PAPERWORK_STAGES: VerificationStageId[] = ["upload", "ocr", "metadata", "fraud"];
const IMAGERY_STAGES: VerificationStageId[] = ["upload", "metadata", "gps", "fraud"];

export const DOCUMENT_KINDS: Record<string, DocumentKindSpec> = {
  // ── Identity (shared across every domain) ──────────────────────────────────
  aadhaar: {
    kind: "aadhaar",
    label: { en: "Aadhaar", ta: "ஆதார்", taEn: "Aadhaar card" },
    hint: { en: "Front and back, or the e-Aadhaar PDF", taEn: "Front & back, illa e-Aadhaar PDF" },
    icon: "🪪",
    accept: ACCEPT_PAPERWORK,
    maxBytes: 10 * 1024 * 1024,
    multiple: true,
    aliases: ["aadhaar", "aadhar", "adhaar", "ஆதார்", "uidai"],
    stages: PAPERWORK_STAGES,
  },
  pan_card: {
    kind: "pan_card",
    label: { en: "PAN Card", ta: "பான் கார்டு", taEn: "PAN card" },
    icon: "💳",
    accept: ACCEPT_PAPERWORK,
    maxBytes: 10 * 1024 * 1024,
    multiple: false,
    aliases: ["pan card", "pan number", "பான்"],
    stages: PAPERWORK_STAGES,
  },
  address_proof: {
    kind: "address_proof",
    label: { en: "Address Proof", ta: "முகவரி சான்று", taEn: "Address proof" },
    hint: {
      en: "Electricity or gas bill in your own name",
      taEn: "Ungal peyaril electricity illa gas bill",
    },
    icon: "🏠",
    accept: ACCEPT_PAPERWORK,
    maxBytes: 10 * 1024 * 1024,
    multiple: false,
    aliases: ["address proof", "proof of address", "முகவரி சான்று"],
    stages: ["upload", "ocr", "metadata"],
  },

  // ── Motor ─────────────────────────────────────────────────────────────────
  rc_book: {
    kind: "rc_book",
    label: { en: "RC Book", ta: "ஆர்.சி. புத்தகம்", taEn: "RC book" },
    hint: {
      en: "RC in your own name. If it is in someone else's name, we also need their signed permission",
      taEn: "Ungal peyaril RC. Vera peyaril irundhaa, avanga sign panna permission-um venum",
    },
    icon: "📄",
    accept: ACCEPT_PAPERWORK,
    maxBytes: 10 * 1024 * 1024,
    multiple: false,
    aliases: ["rc book", "rc-book", "registration certificate", "rc copy", "ஆர்.சி"],
    stages: PAPERWORK_STAGES,
  },
  driving_license: {
    kind: "driving_license",
    label: { en: "Driving Licence", ta: "ஓட்டுநர் உரிமம்", taEn: "Driving licence" },
    icon: "🚘",
    accept: ACCEPT_PAPERWORK,
    maxBytes: 10 * 1024 * 1024,
    multiple: false,
    aliases: ["driving licence", "driving license", "driver's licence", "dl copy", "ஓட்டுநர் உரிமம்"],
    stages: PAPERWORK_STAGES,
  },
  vehicle_authorisation: {
    kind: "vehicle_authorisation",
    label: {
      en: "Owner's Signed Permission",
      ta: "உரிமையாளர் கையொப்ப அனுமதி",
      taEn: "Owner oda signed permission",
    },
    hint: {
      en: "Only if the RC is in someone else's name — a signed letter from them",
      taEn: "RC vera peyaril irundhaa mattum — avanga sign panna letter",
    },
    icon: "✍️",
    accept: ACCEPT_PAPERWORK,
    maxBytes: 10 * 1024 * 1024,
    multiple: false,
    aliases: [
      "authorisation", "authorization", "owner permission", "noc",
      "no objection certificate", "அனுமதி கடிதம்",
    ],
    stages: PAPERWORK_STAGES,
  },
  vehicle_photos: {
    kind: "vehicle_photos",
    label: { en: "Vehicle Photos", ta: "வாகன புகைப்படங்கள்", taEn: "Vehicle photos" },
    hint: { en: "Front, rear and both sides in daylight", taEn: "Front, rear, both sides — daylight-la" },
    icon: "📷",
    accept: ACCEPT_MEDIA,
    maxBytes: MAX_UPLOAD_BYTES,
    multiple: true,
    aliases: ["vehicle photo", "vehicle photos", "vehicle image", "vehicle images", "car photo", "bike photo", "வாகன புகைப்பட"],
    stages: IMAGERY_STAGES,
  },
  previous_policy: {
    kind: "previous_policy",
    label: { en: "Previous Policy", ta: "முந்தைய பாலிசி", taEn: "Previous policy" },
    hint: { en: "Needed to carry your No-Claim Bonus across" },
    icon: "📑",
    accept: ACCEPT_PAPERWORK,
    maxBytes: 10 * 1024 * 1024,
    multiple: false,
    aliases: ["previous policy", "existing policy", "old policy", "policy copy"],
    stages: ["upload", "ocr", "metadata"],
  },

  // ── Health ────────────────────────────────────────────────────────────────
  medical_report: {
    kind: "medical_report",
    label: { en: "Medical Reports", ta: "மருத்துவ அறிக்கை", taEn: "Medical reports" },
    hint: { en: "Recent test results or a health check-up summary" },
    icon: "🩺",
    accept: ACCEPT_PAPERWORK,
    maxBytes: 20 * 1024 * 1024,
    multiple: true,
    aliases: ["medical report", "medical reports", "health report", "test result", "lab report", "மருத்துவ அறிக்கை"],
    stages: PAPERWORK_STAGES,
  },
  prescription: {
    kind: "prescription",
    label: { en: "Prescription", ta: "மருந்து சீட்டு", taEn: "Prescription" },
    icon: "💊",
    accept: ACCEPT_PAPERWORK,
    maxBytes: 10 * 1024 * 1024,
    multiple: true,
    aliases: ["prescription", "doctor's note", "மருந்து சீட்டு"],
    stages: ["upload", "ocr", "fraud"],
  },
  hospital_bill: {
    kind: "hospital_bill",
    label: { en: "Hospital Bills", ta: "மருத்துவமனை பில்", taEn: "Hospital bills" },
    icon: "🧾",
    accept: ACCEPT_PAPERWORK,
    maxBytes: 20 * 1024 * 1024,
    multiple: true,
    aliases: ["hospital bill", "hospital bills", "discharge summary", "medical bill", "மருத்துவமனை பில்"],
    stages: PAPERWORK_STAGES,
  },

  // ── Travel ────────────────────────────────────────────────────────────────
  passport: {
    kind: "passport",
    label: { en: "Passport", ta: "கடவுச்சீட்டு", taEn: "Passport" },
    hint: { en: "The photo page is enough" },
    icon: "🛂",
    accept: ACCEPT_PAPERWORK,
    maxBytes: 10 * 1024 * 1024,
    multiple: false,
    aliases: ["passport", "கடவுச்சீட்டு"],
    stages: PAPERWORK_STAGES,
  },
  visa: {
    kind: "visa",
    label: { en: "Visa", ta: "விசா", taEn: "Visa" },
    icon: "🛃",
    accept: ACCEPT_PAPERWORK,
    maxBytes: 10 * 1024 * 1024,
    multiple: false,
    aliases: ["visa", "visa copy", "விசா"],
    stages: PAPERWORK_STAGES,
  },
  boarding_pass: {
    kind: "boarding_pass",
    label: { en: "Boarding Pass", ta: "போர்டிங் பாஸ்", taEn: "Boarding pass" },
    hint: { en: "Or the ticket / itinerary from your airline" },
    icon: "🎫",
    accept: ACCEPT_PAPERWORK,
    maxBytes: 10 * 1024 * 1024,
    multiple: true,
    aliases: ["boarding pass", "ticket", "itinerary", "flight ticket", "போர்டிங்"],
    stages: ["upload", "ocr", "metadata"],
  },

  // ── Property ──────────────────────────────────────────────────────────────
  sale_deed: {
    kind: "sale_deed",
    label: { en: "Sale Deed", ta: "கிரய பத்திரம்", taEn: "Sale deed" },
    hint: { en: "The registered ownership document" },
    icon: "📜",
    accept: ACCEPT_PAPERWORK,
    maxBytes: 20 * 1024 * 1024,
    multiple: false,
    aliases: ["sale deed", "title deed", "ownership document", "கிரய பத்திரம்"],
    stages: ["upload", "ocr", "metadata", "fraud", "blockchain"],
  },
  property_photos: {
    kind: "property_photos",
    label: { en: "Property Photos", ta: "சொத்து புகைப்படங்கள்", taEn: "Property photos" },
    hint: { en: "Exterior, interior and the main entrance" },
    icon: "🏡",
    accept: ACCEPT_MEDIA,
    maxBytes: MAX_UPLOAD_BYTES,
    multiple: true,
    aliases: ["property photo", "property photos", "property image", "house photo", "home photo", "சொத்து புகைப்பட"],
    stages: IMAGERY_STAGES,
  },
  tax_receipt: {
    kind: "tax_receipt",
    label: { en: "Tax Receipt", ta: "வரி ரசீது", taEn: "Tax receipt" },
    hint: { en: "The latest property-tax payment receipt" },
    icon: "🧾",
    accept: ACCEPT_PAPERWORK,
    maxBytes: 10 * 1024 * 1024,
    multiple: false,
    aliases: ["tax receipt", "property tax", "tax paid receipt", "வரி ரசீது"],
    stages: ["upload", "ocr", "metadata"],
  },
};

/**
 * Default document set per advisor domain. Keyed by advisor category; lookups
 * go through `resolveAdvisorKey`, so a Python domain (`home-property`) resolves
 * just as well as a UI category (`property`).
 */
export const DOMAIN_DOCUMENTS: Record<AdvisorKey, string[]> = {
  motor: ["rc_book", "driving_license", "vehicle_photos", "aadhaar"],
  health: ["medical_report", "prescription", "hospital_bill", "aadhaar"],
  travel: ["passport", "visa", "boarding_pass"],
  property: ["sale_deed", "property_photos", "tax_receipt"],
  miscellaneous: ["aadhaar", "pan_card", "address_proof"],
};

// ── Lookups ──────────────────────────────────────────────────────────────────

/** Catalogue entry for a kind, or null when the agent named something new. */
export function getKind(kind: string): DocumentKindSpec | null {
  return DOCUMENT_KINDS[kind.trim().toLowerCase()] ?? null;
}

/**
 * A requirement for a document the catalogue does not know. An agent is free to
 * ask for anything, so an unknown kind still renders as a usable upload card
 * rather than being dropped.
 */
export function fallbackKind(kind: string): DocumentKindSpec {
  const readable = kind
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .trim();
  return {
    kind,
    label: { en: readable || "Document" },
    icon: "📎",
    accept: ACCEPT_ANY,
    maxBytes: MAX_UPLOAD_BYTES,
    multiple: false,
    aliases: [],
    stages: ["upload", "metadata", "fraud"],
  };
}

/** Turn a catalogue entry into a concrete requirement inside a request. */
export function requirementFromKind(
  kind: string,
  overrides: Partial<DocumentRequirement> = {},
): DocumentRequirement {
  const spec = getKind(kind) ?? fallbackKind(kind);
  return {
    id: overrides.id ?? spec.kind,
    kind: spec.kind,
    label: spec.label,
    hint: spec.hint,
    icon: spec.icon,
    accept: spec.accept,
    maxBytes: spec.maxBytes,
    multiple: spec.multiple,
    required: true,
    stages: spec.stages,
    ...overrides,
  };
}

/** The default requirement set for a domain, empty for an unknown domain. */
export function requirementsForDomain(domain: string): DocumentRequirement[] {
  const key = resolveAdvisorKey(domain);
  if (!key) return [];
  return DOMAIN_DOCUMENTS[key].map((kind) => requirementFromKind(kind));
}

/**
 * Which catalogue documents an agent named in its prose, in the order they
 * appear. Used to turn "please upload your RC book and Aadhaar" into cards
 * without the agent having to emit a structured tag.
 */
export function matchKinds(text: string): string[] {
  const haystack = text.toLowerCase();
  const hits: { kind: string; at: number }[] = [];

  for (const spec of Object.values(DOCUMENT_KINDS)) {
    let earliest = -1;
    for (const alias of spec.aliases) {
      const at = haystack.indexOf(alias);
      if (at !== -1 && (earliest === -1 || at < earliest)) earliest = at;
    }
    if (earliest !== -1) hits.push({ kind: spec.kind, at: earliest });
  }

  return hits.sort((a, b) => a.at - b.at).map((h) => h.kind);
}
