/**
 * Aegis Consumer — the mobile-first guidance surface.
 *
 * Separate from `consumer-dashboard`, which is the fuller console. This one is
 * built for a first-time buyer on a phone: five choices, large type, no jargon.
 */
export { ConsumerGreeting } from "./ConsumerGreeting";
export { QuickActionCard } from "./QuickActionCard";
export { QuickActionGrid } from "./QuickActionGrid";

// The manual policy flow.
export { PolicyDnaCard } from "./policy/PolicyDnaCard";
export { PolicyListItem } from "./policy/PolicyListItem";
export { PolicyWizard } from "./policy/PolicyWizard";
export { RenewalStatusPill, daysRemainingLabel } from "./policy/RenewalStatusPill";
export { TrustBadge, TrustPill } from "./policy/TrustBadge";
export { PolicyDocumentCard } from "./policy/PolicyDocumentCard";

// Help me renew.
export { HelpMeRenew, shouldOfferRenewal } from "./renewal/HelpMeRenew";
export { ConsentForm } from "./renewal/ConsentForm";
export { RequestStatusCard } from "./renewal/RequestStatusCard";

// Aegis Kural Lite.
export { AskPanel } from "./kural/AskPanel";
