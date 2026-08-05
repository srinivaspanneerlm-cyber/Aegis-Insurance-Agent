import type { Metadata } from "next";
import { SITE } from "./site";

/**
 * One page's worth of metadata, built the same way every time.
 *
 * Left to each page, canonical URLs and social cards get filled in on the
 * pages someone remembered and omitted on the rest — and the omissions are
 * invisible until a link is shared and comes out blank. This makes the
 * complete set the default and the page supply only what is genuinely its own.
 */
export function pageMetadata(input: {
  title: string;
  description: string;
  /** Path with a leading slash. Used for the canonical URL. */
  path: string;
  /** Pages with nothing to index yet (Coming soon) opt out. */
  noIndex?: boolean;
}): Metadata {
  const url = `${SITE.url}${input.path === "/" ? "" : input.path}`;

  return {
    title: input.title,
    description: input.description,
    alternates: { canonical: url },
    openGraph: {
      type: "website",
      siteName: SITE.name,
      locale: SITE.locale,
      title: input.title,
      description: input.description,
      url,
    },
    twitter: {
      card: "summary_large_image",
      title: input.title,
      description: input.description,
    },
    robots: input.noIndex ? { index: false, follow: true } : undefined,
  };
}

/**
 * Organisation structured data.
 *
 * Emitted once, from the root layout, so search engines have a single
 * authoritative description of the company rather than one per page. Deliberately
 * modest: it claims a name, a description and ways to make contact, and nothing
 * about ratings, awards or customer counts that we cannot substantiate.
 */
export function organizationJsonLd(contact: {
  email: string;
  phone: string;
  socials: readonly { href: string }[];
}) {
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: SITE.legalName,
    alternateName: SITE.name,
    url: SITE.url,
    description: SITE.description,
    contactPoint: [
      {
        "@type": "ContactPoint",
        contactType: "customer support",
        email: contact.email,
        telephone: contact.phone,
        availableLanguage: ["English", "Tamil"],
      },
    ],
    sameAs: contact.socials.map((s) => s.href),
  };
}
