/**
 * Illustrative pre-launch content.
 *
 * Aegis has not operated in production, so there are no real customers and no
 * real testimonials. The sections below exist so the layout can be designed and
 * reviewed — every one of them MUST be rendered together with a visible
 * placeholder marker (`<PlaceholderNotice />`) so no visitor can mistake them
 * for real customer experience.
 *
 * Quotes deliberately describe the *advisory* experience the product actually
 * provides today. They must never imply claim-settlement performance, payout
 * speed or savings amounts — Aegis does not settle claims, and an invented
 * figure in a quote is still an invented figure.
 *
 * Delete this module once production testimonials exist. See
 * [platformFacts.ts] for the values that are safe to publish unqualified.
 */

export const PLACEHOLDER_NOTICE =
  "Illustrative examples — not real customer testimonials. Shown while Aegis is pre-launch.";

export interface PlaceholderTestimonial {
  name: string;
  role: string;
  avatar: string;
  quote: string;
  rating: number;
}

/** Long-form cards used by the trust section. */
export const PLACEHOLDER_TESTIMONIALS: PlaceholderTestimonial[] = [
  {
    name: "Aravind Sharma",
    role: "Father of two, Software Director",
    avatar: "AS",
    quote:
      "The advisor walked through what each policy actually covers before it ever mentioned a price. It was the first time buying insurance did not feel like being sold to.",
    rating: 5,
  },
  {
    name: "Dr. Meera Nair",
    role: "Consultant Pediatrician",
    avatar: "MN",
    quote:
      "I asked it to filter for plans without room-rent sublimits and it explained why that matters instead of just applying the filter. The reasoning was sound.",
    rating: 5,
  },
  {
    name: "Rohan & Riya Sen",
    role: "Business Owners",
    avatar: "RS",
    quote:
      "We compared four plans side by side and the advisor was upfront about where the cheaper option was genuinely weaker. That honesty made the decision easy.",
    rating: 5,
  },
];

export interface PlaceholderReview {
  name: string;
  category: string;
  advisor: string;
  rating: number;
  feedback: string;
}

/** Short marquee reviews used on the landing page. */
export const PLACEHOLDER_REVIEWS: PlaceholderReview[] = [
  {
    name: "Arun Kumar",
    category: "Health Insurance",
    advisor: "Sarah AI",
    rating: 5,
    feedback: "The advisor explained family cover more clearly than anyone had before.",
  },
  {
    name: "Vignesh R",
    category: "Motor Insurance",
    advisor: "Alex AI",
    rating: 5,
    feedback: "Alex walked me through what add-on cover actually changes, in plain terms.",
  },
  {
    name: "Priya S",
    category: "Travel Insurance",
    advisor: "Ethan AI",
    rating: 5,
    feedback: "It asked about my trip before recommending anything, which I appreciated.",
  },
  {
    name: "Kavya M",
    category: "Home Insurance",
    advisor: "Emma AI",
    rating: 5,
    feedback: "I finally understood what my home policy does and does not cover.",
  },
  {
    name: "Sivamaran J",
    category: "Health Insurance",
    advisor: "Sarah AI",
    rating: 5,
    feedback: "Being able to ask follow-up questions without feeling rushed made the difference.",
  },
];
