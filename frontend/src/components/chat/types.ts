export interface RecommendationData {
  planName: string;
  coverage: string;
  premium: string;
  benefits: string[];
  reason?: string;
  score?: number;
  claimSettlementRatio?: string;
  riskLevel?: string;
  confidenceScore?: number;
  executiveApproval?: string;
  exclusions?: string[];
  waitingPeriod?: string;
  claimProcess?: string;
  hospitalNetwork?: string;
  premiumBreakdown?: string;
  executiveNotes?: string;
  alternativePlan?: unknown;
  category?: string;
  // Motor fields
  idvValue?: string;
  ownDamageCover?: string;
  thirdPartyCover?: string;
  zeroDep?: string;
  roadsideAssistance?: string;
  engineProtection?: string;
  // Travel fields
  destination?: string;
  medicalCoverage?: string;
  tripCancellation?: string;
  baggageLoss?: string;
  emergencyEvacuation?: string;
  // Property fields
  propertyCoverage?: string;
  fireProtection?: string;
  naturalDisasterCover?: string;
  theftCover?: string;
  structureCover?: string;
  contentsCover?: string;
  // Multi-plan
  type?: string;
  segment?: string;
  plans?: MultiPlan[];
  total_plans?: number;
  recommended?: string;
  risk_summary?: Record<string, number>;
  vehicle_cat?: string;
}

export interface PlanScores {
  overall: number;
  suitability: number;
  budget_match: number;
  coverage_match: number;
  risk_match: number;
}

export interface MultiPlan {
  rank: number;
  plan_id: string;
  plan_name: string;
  segment: string;
  coverage: string;
  coverage_amount?: number;
  premium: string;
  premium_monthly?: number;
  premium_annual?: number;
  cashless_hospitals?: string;
  cashless_garages?: string;
  room_rent?: string;
  icu?: string;
  day_care?: string;
  ped_waiting?: string;
  ncb?: string;
  health_checkup?: string;
  maternity?: string;
  critical_illness?: string;
  ambulance?: string;
  restoration?: string;
  opd?: string;
  claim_process?: string;
  claim_ratio?: string;
  eligibility?: string;
  co_payment?: string;
  // Motor fields
  policy_type?: string;
  zero_dep?: boolean;
  zero_dep_claims?: string;
  engine_protect?: boolean;
  engine_protect_detail?: string;
  rsa?: boolean;
  rsa_services?: string;
  consumables?: boolean;
  return_invoice?: boolean;
  key_protect?: boolean;
  tyre_protect?: boolean;
  battery_cover?: boolean;
  battery_cover_detail?: string;
  idv?: string;
  pa_owner_driver?: string;
  // Property fields
  structure_coverage?: string;
  contents_coverage?: string;
  fire_cover?: boolean;
  fire_detail?: string;
  flood_cover?: boolean;
  flood_detail?: string;
  earthquake_cover?: boolean;
  earthquake_detail?: string;
  storm_cover?: boolean;
  storm_detail?: string;
  theft_cover?: boolean;
  theft_sublimit?: string;
  temp_accommodation?: boolean;
  temp_accommodation_detail?: string;
  electrical_cover?: boolean;
  electrical_detail?: string;
  glass_cover?: boolean;
  public_liability?: boolean;
  public_liability_detail?: string;
  rental_income?: boolean;
  rental_income_detail?: string;
  jewelry_cover?: boolean;
  jewelry_detail?: string;
  all_risk_contents?: boolean;
  accidental_damage?: boolean;
  worldwide_contents?: boolean;
  smart_home_cover?: boolean;
  legal_expenses?: boolean;
  cyber_cover?: boolean;
  outbuildings?: boolean;
  // Travel fields
  travel_scope?: string;
  medical_cover?: boolean;
  medical_cover_amount?: string;
  medical_cover_usd?: string;
  emergency_evacuation?: boolean;
  emergency_evac_amount?: string;
  trip_cancellation?: boolean;
  trip_cancellation_amount?: string;
  trip_delay?: boolean;
  trip_delay_threshold?: string;
  lost_baggage?: boolean;
  baggage_delay?: boolean;
  passport_loss?: boolean;
  personal_liability?: boolean;
  adventure_cover?: boolean;
  adventure_types?: string[];
  pre_existing_cover?: boolean;
  flight_hijack?: boolean;
  kidnap_cover?: boolean;
  annual_multi_trip?: boolean;
  schengen_compliant?: boolean;
  home_care?: boolean;
  business_equipment?: boolean;
  concierge?: boolean;
  // Common
  benefits: string[];
  exclusions?: string[];
  suitable_for?: string[];
  risk_level?: string;
  scores: PlanScores;
  // Recommendation quality
  why_this_plan?: string;
  why_not_others?: string;
  future_benefits?: string;
  claim_experience?: string;
  advantages?: string[];
  limitations?: string[];
}

export interface ChatMsg {
  id: string;
  sender: "user" | "advisor";
  text: string;
  timestamp: string;
  agentName?: string;
  agentDomain?: string;
  transferred?: boolean;
  transferFromName?: string;
  transferToName?: string;
  isStreaming?: boolean;
}

export interface ChatMessageProps {
  message: ChatMsg;
  advisorAvatar?: string;
  advisorTheme?: string;
  /** Name shown for an advisor message that carries no agentName of its own. */
  advisorName?: string;
  onUIAction?: (action: string, planData: RecommendationData) => void;
  onOptionClick?: (text: string) => void;
  onRegenerate?: (msgId: string) => void;
  onVoicePlay?: (text: string) => void;
}
