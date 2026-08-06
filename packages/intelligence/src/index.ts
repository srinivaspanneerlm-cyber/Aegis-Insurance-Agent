/**
 * The shared insurance-intelligence module.
 *
 * Every portal renders the same explanation with the same wording. That is the
 * point: when a customer rings an advisor about a recommendation, both of them
 * are looking at identical reasoning, so the conversation is about the decision
 * rather than about whose screen is right.
 *
 * Nothing here fetches anything. Each component renders what it is handed, so
 * one set of components serves four portals with four different data layers and
 * four different permission models.
 */
export * from "./lib/types";

export { ExplanationPanel, type ExplanationPanelProps } from "./components/ExplanationPanel";
export { RecommendationCard, type RecommendationCardProps } from "./components/RecommendationCard";
export { RiskMatrix, type RiskMatrixProps } from "./components/RiskMatrix";
export { CoverageGapList, type CoverageGapListProps } from "./components/CoverageGapList";
export { RenewalTimeline, type RenewalTimelineProps } from "./components/RenewalTimeline";
export { NextBestAction, type NextBestActionProps } from "./components/NextBestAction";
export { ProfileForm, type ProfileFormProps, type ProfileValues } from "./components/ProfileForm";
