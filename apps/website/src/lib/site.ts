/**
 * Everything the public site says about itself, in one place.
 *
 * Navigation, portal destinations and company contact details are each read by
 * several components — the header, the mobile menu, the footer, the sitemap,
 * the structured data. Written down once here, they cannot disagree with each
 * other, and a launch-day change to a phone number is one edit rather than a
 * search.
 *
 * ⚠️ CONTACT DETAILS BELOW ARE PLACEHOLDERS. They are structured correctly and
 * rendered honestly, but they are not real routes to a real desk. Replace them
 * before this site is pointed at a public domain.
 */

export const SITE = {
  name: "Aegis AI",
  /** Used in <title> templates and structured data. */
  legalName: "Aegis AI Technologies",
  tagline: "Insurance that explains itself",
  description:
    "Aegis AI is an enterprise insurance platform that helps people understand cover before they buy it — in plain language, in their own language.",
  /** Set NEXT_PUBLIC_SITE_URL in production; the fallback keeps local builds valid. */
  url: process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3100",
  locale: "en_IN",
} as const;

/** ⚠️ Placeholder — replace before launch. */
export const CONTACT = {
  email: "hello@aegis.ai",
  salesEmail: "sales@aegis.ai",
  phone: "+91 44 4000 0000",
  /** Rendered as-is; keep the lines in postal order. */
  address: ["Aegis AI Technologies", "Guindy, Chennai", "Tamil Nadu 600032", "India"],
  hours: "Monday to Friday, 9:30am – 6:30pm IST",
} as const;

export interface SocialLink {
  label: string;
  href: string;
}

/** ⚠️ Placeholder handles — replace before launch. */
export const SOCIALS: readonly SocialLink[] = [
  { label: "LinkedIn", href: "https://www.linkedin.com/company/aegis-ai" },
  { label: "X", href: "https://x.com/aegisai" },
  { label: "GitHub", href: "https://github.com/aegis-ai" },
  { label: "YouTube", href: "https://www.youtube.com/@aegisai" },
];

export interface NavLink {
  label: string;
  href: string;
  description?: string;
  /** Rendered with a "Coming soon" marker and excluded from the sitemap. */
  comingSoon?: boolean;
}

/**
 * The primary navigation.
 *
 * Eight items, which is past the six a person scans comfortably — the cost of
 * a single front door. Industries and Resources moved to the footer rather than
 * being dropped: they still answer questions, they just answer narrower ones
 * than the sections a first-time visitor is looking for.
 *
 * Sign in is deliberately *not* in this array. It is an action, not a
 * destination, and it renders as the header's primary control — the same shape
 * every enterprise console uses, and the reason a person never has to hunt for
 * it among the reading material.
 */
export const PRIMARY_NAV: readonly NavLink[] = [
  { label: "Home", href: "/", description: "The platform, in one page" },
  { label: "Products", href: "/products", description: "Cover we help people understand" },
  { label: "Solutions", href: "/solutions", description: "For individuals and for insurers" },
  { label: "AI", href: "/ai", description: "How the advisors actually work" },
  { label: "About", href: "/about", description: "Why we built Aegis" },
  { label: "Careers", href: "/careers", description: "Working here" },
  { label: "Support", href: "/support", description: "Get help" },
  { label: "Contact", href: "/contact", description: "Talk to a person" },
];

/**
 * The identity platform — where every sign-in happens.
 *
 * The gateway below no longer links straight at a portal. It links here with
 * the chosen realm, because authentication is one system for all four portals
 * and a portal cannot be entered without passing through it. The identity
 * platform decides where somebody actually lands, from their realm.
 */
export const IDENTITY_URL = process.env.NEXT_PUBLIC_IDENTITY_URL ?? "http://localhost:3105";

/**
 * A union rather than `string`, so the icon and tone lookups keyed on it are
 * exhaustive. Adding a portal without giving it an icon then fails to compile
 * rather than rendering a blank square.
 */
export type PortalId = "customer" | "employee" | "enterprise" | "platform-admin";

export interface Portal {
  id: PortalId;
  name: string;
  audience: string;
  description: string;
  /** What signing in here actually gets you. Kept concrete and honest. */
  points: readonly string[];
  href: string;
  /** Portals that are not yet accepting sign-ins say so instead of 404ing. */
  available: boolean;
  tone: "brand" | "accent" | "info" | "muted";
}

/**
 * Where "Get Started" leads.
 *
 * Each entry names a separate application, not a role inside one. That
 * separation is the platform's identity model showing through: a customer and a
 * member of staff are different kinds of principal with different session
 * policies, and they do not share a front door.
 *
 * `href` points at the identity platform's sign-in for that realm rather than
 * at the portal itself. Linking a visitor straight to a portal would only
 * bounce them back here unauthenticated, one redirect later.
 */
export const PORTALS: readonly Portal[] = [
  {
    id: "customer",
    name: "Customer Portal",
    audience: "For individuals and families",
    description:
      "Review the cover you hold, continue an application, and get a plain-language explanation of anything you do not recognise.",
    points: ["Your policies and documents", "Renewals and reminders", "Guidance in your language"],
    href: `${IDENTITY_URL}/login?portal=CUSTOMER`,
    available: true,
    tone: "brand",
  },
  {
    id: "employee",
    name: "Employee Portal",
    audience: "For branch and support staff",
    description:
      "The daily working surface for the people who serve customers directly — enquiries, applications and the records behind them.",
    points: ["Customer enquiries", "Application progress", "Day-to-day servicing"],
    href: `${IDENTITY_URL}/login?portal=EMPLOYEE`,
    available: false,
    tone: "info",
  },
  {
    id: "enterprise",
    name: "Enterprise Portal",
    audience: "For underwriting and oversight",
    description:
      "Portfolio-level work: underwriting decisions, approvals, and the reporting that governance and compliance depend on.",
    points: ["Underwriting and approvals", "Portfolio reporting", "Audit and oversight"],
    href: `${IDENTITY_URL}/login?portal=ENTERPRISE`,
    available: false,
    tone: "accent",
  },
  {
    id: "platform-admin",
    name: "Platform Administration",
    audience: "For Aegis operators",
    description:
      "Configuration, organisations and platform health. Access is granted by capability, never by job title.",
    points: ["Organisations and staff", "Platform configuration", "Audit trail"],
    href: `${IDENTITY_URL}/login?portal=PLATFORM`,
    available: false,
    tone: "muted",
  },
];

export const FOOTER_SECTIONS: readonly { title: string; links: readonly NavLink[] }[] = [
  {
    title: "Platform",
    links: [
      { label: "Products", href: "/products" },
      { label: "Solutions", href: "/solutions" },
      { label: "Industries", href: "/industries" },
      { label: "Request a demo", href: "/request-demo" },
    ],
  },
  {
    title: "Company",
    links: [
      { label: "About us", href: "/about" },
      { label: "Contact", href: "/contact" },
      { label: "Careers", href: "/careers", comingSoon: true },
      { label: "Blog", href: "/blog", comingSoon: true },
    ],
  },
  {
    title: "Resources",
    links: [
      { label: "Insurance guides", href: "/resources#guides" },
      { label: "Frequently asked questions", href: "/resources#faq" },
      { label: "Knowledge centre", href: "/resources#knowledge" },
      { label: "Get started", href: "/get-started" },
    ],
  },
];

/**
 * Pages that belong in the sitemap, with the priority a crawler should give
 * them. Kept beside the navigation so a new page cannot be added to one and
 * forgotten in the other.
 */
export const SITEMAP_ROUTES: readonly { path: string; priority: number }[] = [
  { path: "/", priority: 1 },
  { path: "/products", priority: 0.9 },
  { path: "/ai", priority: 0.9 },
  { path: "/support", priority: 0.7 },
  { path: "/solutions", priority: 0.9 },
  { path: "/get-started", priority: 0.9 },
  { path: "/request-demo", priority: 0.8 },
  { path: "/industries", priority: 0.7 },
  { path: "/resources", priority: 0.7 },
  { path: "/about", priority: 0.7 },
  { path: "/contact", priority: 0.6 },
  { path: "/careers", priority: 0.3 },
  { path: "/blog", priority: 0.3 },
];

// ── Site content ─────────────────────────────────────────────────────────────
//
// Products and capabilities live here rather than inside the page that first
// needed them, because the home page and the detail pages must not drift apart.
// A visitor who reads "six products" on the front page and finds five on the
// products page has caught the site contradicting itself.

import type { Feature } from "@/components/sections/FeatureGrid";

/** The insurance products, as the catalogue and the home page both render them. */
export const PRODUCTS: readonly Feature[] = [
  {
    icon: "car",
    title: "Motor insurance",
    description:
      "Two-wheeler and car cover, from the legal minimum to comprehensive protection — with the difference explained rather than assumed.",
    points: [
      "Third-party vs comprehensive, in plain terms",
      "What own-damage actually pays for",
      "Add-ons worth having, and the ones that are not",
      "No-claim bonus explained before you lose it",
    ],
  },
  {
    icon: "heart",
    title: "Health insurance",
    description:
      "Individual and family floater cover, weighed against the things that decide a hospital claim rather than the headline sum insured.",
    points: [
      "Waiting periods and pre-existing conditions",
      "Room-rent limits and sub-limits",
      "Cashless network reality, not just its size",
      "What a family floater shares, and when that hurts",
    ],
  },
  {
    icon: "home",
    title: "Property insurance",
    description:
      "Home and contents cover for owners and tenants, including the parts people usually discover are missing.",
    points: [
      "Structure and contents, told apart",
      "Tenant cover vs owner cover",
      "Natural-disaster inclusions by region",
      "How the sum insured is arrived at",
    ],
  },
  {
    icon: "plane",
    title: "Travel insurance",
    description:
      "Domestic and international trips, including student and senior-citizen travel — where the exclusions do the most work.",
    points: [
      "Medical cover abroad, and its ceiling",
      "Trip cancellation: what counts as a reason",
      "Baggage and document loss",
      "Pre-existing conditions while travelling",
    ],
  },
  {
    icon: "briefcase",
    title: "Business insurance",
    description:
      "Cover for small and medium businesses — liability, property, and the people who work there.",
    points: ["Commercial property", "Public and product liability", "Group employee cover"],
    comingSoon: true,
  },
  {
    icon: "building",
    title: "Corporate insurance",
    description:
      "Group cover for organisations — employee health, group term life, and the liability an employer carries whether or not it is insured.",
    points: [
      "Group health and group term life",
      "Employer liability and workmen's compensation",
      "Directors' and officers' cover",
      "Onboarding and exits handled without a spreadsheet",
    ],
    comingSoon: true,
  },
];

/** What the platform does, for the home page and the solutions page alike. */
export const CAPABILITIES: readonly Feature[] = [
  {
    icon: "bolt",
    title: "Claims automation",
    description:
      "Intake, document handling and assessment support, so a straightforward claim moves without a person having to chase it — and a complex one reaches an assessor with the context already gathered.",
    points: [
      "Guided intake that asks for the right documents once",
      "Automatic completeness checks before submission",
      "Straightforward cases routed away from manual queues",
      "Every decision traceable end to end",
    ],
  },
  {
    icon: "refresh",
    title: "Renewal intelligence",
    description:
      "Most lapses are not decisions — they are a missed message. Renewals are surfaced early, with what has changed since last year, in time for the customer to act.",
    points: [
      "Expiry and grace periods tracked per policy",
      "What changed since the last term, in plain terms",
      "Reminders timed to be useful rather than annoying",
      "Re-assessment when circumstances have moved",
    ],
  },
  {
    icon: "search",
    title: "Fraud detection",
    description:
      "Pattern and consistency signals across an application and its documents, so investigators spend their time on the cases that warrant it.",
    points: [
      "Document and declaration consistency checks",
      "Anomaly signals surfaced with their reasoning",
      "Flags a human decides on — never an automatic refusal",
      "Full audit trail behind every signal",
    ],
  },
  {
    icon: "layers",
    title: "Enterprise AI platform",
    description:
      "The layer the rest of this runs on: typed contracts, provider-agnostic language models, per-account isolation and a complete audit trail.",
    points: [
      "Provider-agnostic — no single vendor lock-in",
      "Strict isolation between accounts and domains",
      "Capability-based access, granted rather than assumed",
      "Audit trail across every automated decision",
    ],
  },
  {
    icon: "spark",
    title: "AI advisor",
    description:
      "Specialist advisors for motor, health, travel and property that ask what somebody needs before recommending anything — and say why, in the language the person is writing in.",
    points: [
      "Plain-language explanation before any recommendation",
      "Handover between specialists without repeating yourself",
      "English, Tamil and Thanglish in the same conversation",
      "Every recommendation carries its reasoning",
    ],
  },
  {
    icon: "eye",
    title: "Document intelligence",
    description:
      "Reading what a customer uploads — registration certificates, policy schedules, identity proofs — and saying plainly what is missing rather than failing silently.",
    points: [
      "Documents requested for a stated reason, not from a list",
      "Completeness checked before a case moves",
      "A person decides; the pipeline only prepares",
      "A rejection always says what to do next",
    ],
  },
  {
    icon: "users",
    title: "Customer intelligence",
    description:
      "One view of a customer that an advisor can act on — what they hold, what is missing, what changed, and where every fact came from.",
    points: [
      "Cover, gaps and renewals in one place",
      "Every fact traceable to who said it",
      "Advice history, so a past decision can be explained",
      "Shared by the assistant and the human",
    ],
  },
  {
    icon: "chart",
    title: "Analytics",
    description:
      "Operational and portfolio reporting drawn from what the platform actually recorded — including, deliberately, what it cannot yet measure.",
    points: [
      "Queue, workload and turnaround",
      "Coverage-gap and renewal trends",
      "Risk distribution across the book",
      "Metrics with no data source say so rather than showing zero",
    ],
  },
];
