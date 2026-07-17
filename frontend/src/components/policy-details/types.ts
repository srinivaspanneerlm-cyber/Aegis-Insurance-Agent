/** Shared types for the policy-details page and its tab components. */

/** A fully-described insurance plan as stored/selected for the details view. */
export interface PlanDetails {
  planName: string;
  coverage: string;
  premium: string;
  benefits: string[];
  claimSettlementRatio?: string;
  riskLevel?: string;
  score?: number;
  confidenceScore?: number;
  executiveApproval?: string;
  exclusions?: string[];
  waitingPeriod?: string;
  claimProcess?: string;
  hospitalNetwork?: string;
  premiumBreakdown?: string;
  executiveNotes?: string;
  alternativePlan?: PlanDetails;
  category?: string;
  idvValue?: string;
  ownDamageCover?: string;
  thirdPartyCover?: string;
  zeroDep?: string;
  roadsideAssistance?: string;
  engineProtection?: string;
  destination?: string;
  medicalCoverage?: string;
  tripCancellation?: string;
  baggageLoss?: string;
  emergencyEvacuation?: string;
  propertyCoverage?: string;
  fireProtection?: string;
  naturalDisasterCover?: string;
  theftCover?: string;
  structureCover?: string;
  contentsCover?: string;
}

/** The selectable detail tabs on the policy details page. */
export type DetailTab = "benefits" | "network" | "exclusions" | "compare";
