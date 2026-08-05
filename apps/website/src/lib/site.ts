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
 * Seven items is at the outer edge of what a person scans comfortably, so the
 * two future sections (Careers, Blog) live in the footer instead of competing
 * with the ones that can actually answer a question today.
 */
export const PRIMARY_NAV: readonly NavLink[] = [
  { label: "Products", href: "/products", description: "Cover we help people understand" },
  { label: "Solutions", href: "/solutions", description: "For individuals and for insurers" },
  { label: "Industries", href: "/industries", description: "Where the platform applies" },
  { label: "Resources", href: "/resources", description: "Guides, FAQs and explanations" },
  { label: "About", href: "/about", description: "Why we built Aegis" },
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
