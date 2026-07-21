import type { AdvisorKey } from "@/lib/advisors";

/**
 * Starter questions shown before a user has said anything, so a first-time buyer
 * has an easy way in instead of a blank prompt. Written in plain language per
 * the mission (educate, don't assume jargon); phrased as questions the advisor
 * can answer conversationally. Clicking one sends it through the normal chat
 * flow — this is presentational only and adds no new conversation behaviour.
 */
export const SUGGESTED_QUESTIONS: Record<AdvisorKey, string[]> = {
  health: [
    "What does health insurance actually cover?",
    "How much cover does my family need?",
    "What's a family floater vs an individual plan?",
    "Can you explain waiting periods simply?",
  ],
  motor: [
    "Third-party or comprehensive — what's the difference?",
    "How is my premium worked out?",
    "What is IDV and why does it matter?",
    "What isn't covered by a motor policy?",
  ],
  travel: [
    "What does travel insurance cover?",
    "Do I need cover for a domestic trip?",
    "What happens if my trip gets cancelled?",
    "How does a medical emergency abroad work?",
  ],
  property: [
    "What does home insurance protect?",
    "I'm renting — do I still need cover?",
    "Are my belongings covered against theft?",
    "How much should I insure my home for?",
  ],
  miscellaneous: [
    "How do you decide which plan is right for me?",
    "How is Aegis different from an agent?",
    "Can you compare my options side by side?",
    "How is my data used and kept safe?",
  ],
};
