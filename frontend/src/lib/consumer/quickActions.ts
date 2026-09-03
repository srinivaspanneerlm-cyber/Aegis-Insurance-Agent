import {
  FileSearch,
  HelpCircle,
  LifeBuoy,
  RefreshCw,
  ShieldCheck,
  type LucideIcon,
} from "lucide-react";

/**
 * The five things Aegis Consumer offers, as data.
 *
 * Written as a catalogue rather than as markup because two different things
 * need to read it: the grid that renders the cards, and the tests that check no
 * card can send somebody nowhere. A hardcoded row of JSX cannot be checked for
 * that second property at all.
 *
 * The audience decides the shape of this file. These cards are the whole
 * navigation for someone who may be using an insurance product for the first
 * time, on a phone, possibly in Tamil. So each one gets a plain-language label,
 * one sentence saying what actually happens if you press it, and — this is the
 * part that matters — an honest state.
 */

/**
 * Whether pressing this card does something.
 *
 * `ready` navigates to a surface that exists and works today. `next` is built
 * but not yet reachable, and renders as a labelled, non-navigating card.
 *
 * There is deliberately no third option that navigates hopefully. A quick
 * action that leads to a 404 is worse than one that says "not yet": the first
 * teaches a nervous customer that the product is broken, and the second is
 * simply a fact they can plan around.
 */
export type QuickActionState = "ready" | "next";

export interface QuickAction {
  readonly id: string;
  /** What the card says. Plain language, no product jargon. */
  readonly label: string;
  /** One sentence on what happens next. Sets the expectation before the tap. */
  readonly description: string;
  readonly icon: LucideIcon;
  readonly state: QuickActionState;
  /** Where it goes. Present if and only if `state` is `ready`. */
  readonly href?: string;
  /**
   * Shown on a `next` card instead of a destination. Says when, not "soon" —
   * "soon" is what people stop believing.
   */
  readonly pending?: string;
}

/**
 * Two of these route into the existing dashboard rather than to a page of their
 * own, because the policies list and the claims timeline genuinely live there
 * already and rebuilding them here would be the duplication this project is
 * meant to avoid.
 *
 * The dashboard cannot yet be deep-linked to one of its panels — `activeNav` is
 * component state with no URL behind it — so both cards land on its overview and
 * their descriptions say which panel to open. Adding a query parameter to
 * `useConsumerDashboard` is a small change, but it belongs to the milestone that
 * has reason to touch that hook rather than to this one.
 */
export const QUICK_ACTIONS: readonly QuickAction[] = [
  {
    id: "check-policy",
    label: "Check My Policy",
    description:
      "Tell us your policy details and we will explain what you have and when it runs out.",
    icon: FileSearch,
    state: "ready",
    href: "/consumer/policy/new",
  },
  {
    id: "renew",
    label: "Renew My Insurance",
    description: "Ask a person to help you renew, by phone, WhatsApp or email.",
    icon: RefreshCw,
    state: "ready",
    // The request is raised against one policy, so the way in is the policy
    // list rather than a form with nothing to attach itself to.
    href: "/consumer/policy",
  },
  {
    id: "understand-coverage",
    label: "Understand My Coverage",
    description:
      "Ask our advisor what your cover actually includes, in plain words. No cost, no pressure.",
    icon: ShieldCheck,
    state: "ready",
    href: "/advisor",
  },
  {
    id: "claim-help",
    label: "Claim Help",
    description: "See how your claims are progressing under Claims in your dashboard.",
    icon: LifeBuoy,
    state: "ready",
    href: "/consumer-dashboard",
  },
  {
    id: "my-policies",
    label: "My Policies",
    description: "Everything you have added, and how long each one has left.",
    icon: HelpCircle,
    state: "ready",
    href: "/consumer/policy",
  },
];

/**
 * The trust line on the home screen.
 *
 * Phase 1 takes no money and issues no policy, and saying so unprompted is the
 * point: the people this is built for have usually been sold to by somebody
 * whose incentive they could not see. It is short enough to actually be read.
 */
export const CONSUMER_TRUST_NOTE =
  "Aegis Consumer is free guidance. We never ask for payment here, and we never share your details without asking you first.";

/**
 * Shown wherever Aegis says anything about cover.
 *
 * Mirrors `GUIDANCE_DISCLAIMER` in `backend/src/consumer/messages.ts` — the
 * wording is fixed by the product specification, and the two are checked
 * against each other by a test rather than trusted to stay in step.
 */
export const GUIDANCE_DISCLAIMER =
  "Guidance only. Exact coverage, eligibility and renewal terms depend on official policy wording and insurer/partner confirmation.";
