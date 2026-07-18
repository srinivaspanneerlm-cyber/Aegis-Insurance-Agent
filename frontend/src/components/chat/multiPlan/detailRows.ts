import type { MultiPlan } from "../types";

/** One label/value tile in a plan's expanded detail grid. */
export interface DetailRow {
  label: string;
  value: string | undefined;
}

/**
 * Category-specific detail rows for the expanded plan view. Each function
 * builds the same label/value list and applies the same visibility filter as
 * the original inline markup, so the rendered tiles are unchanged.
 */

export function healthRows(plan: MultiPlan): DetailRow[] {
  return [
    { label: "Cashless Hospitals", value: plan.cashless_hospitals },
    { label: "Room Rent",           value: plan.room_rent },
    { label: "ICU",                 value: plan.icu },
    { label: "Day Care",            value: plan.day_care },
    { label: "PED Waiting",         value: plan.ped_waiting },
    { label: "NCB",                 value: plan.ncb },
    { label: "Health Checkup",      value: plan.health_checkup },
    { label: "Maternity",           value: plan.maternity },
    { label: "Critical Illness",    value: plan.critical_illness },
    { label: "Ambulance",           value: plan.ambulance },
    { label: "Restoration",         value: plan.restoration },
    { label: "OPD",                 value: plan.opd },
    { label: "Co-payment",          value: plan.co_payment },
    { label: "Eligibility",         value: plan.eligibility },
  ].filter(r => r.value);
}

export function motorRows(plan: MultiPlan): DetailRow[] {
  return [
    { label: "Policy Type",      value: plan.policy_type },
    { label: "IDV",              value: plan.idv },
    { label: "Zero Dep",         value: plan.zero_dep ? `Yes — ${plan.zero_dep_claims || ""}` : "No" },
    { label: "Engine Protect",   value: plan.engine_protect ? "Yes" : "No" },
    { label: "RSA",              value: plan.rsa ? "Yes" : "No" },
    { label: "Consumables",      value: plan.consumables ? "Included" : "Not included" },
    { label: "Return Invoice",   value: plan.return_invoice ? "Included" : "No" },
    { label: "Battery Cover",    value: plan.battery_cover ? (plan.battery_cover_detail || "Yes") : "N/A" },
    { label: "PA Owner-Driver",  value: plan.pa_owner_driver },
    { label: "Cashless Garages", value: plan.cashless_garages },
    { label: "NCB",              value: plan.ncb },
    { label: "Claim Process",    value: plan.claim_process },
  ].filter(r => r.value && r.value !== "No" && r.value !== "Not included" && r.value !== "N/A" || ["Policy Type","IDV","Cashless Garages","NCB","Claim Process"].includes(r.label)).filter(r => r.value);
}

export function propertyRows(plan: MultiPlan): DetailRow[] {
  return [
    { label: "Structure Cover",      value: plan.structure_coverage },
    { label: "Contents Cover",       value: plan.contents_coverage },
    { label: "Fire",                 value: plan.fire_cover ? (plan.fire_detail || "Included") : "Not included" },
    { label: "Flood",                value: plan.flood_cover ? (plan.flood_detail || "Included") : "Not included" },
    { label: "Earthquake",           value: plan.earthquake_cover ? (plan.earthquake_detail || "Included") : "Not included" },
    { label: "Storm / Cyclone",      value: plan.storm_cover ? (plan.storm_detail || "Included") : "Not included" },
    { label: "Theft",                value: plan.theft_cover ? (plan.theft_sublimit || "Included") : "Not included" },
    { label: "Temp Accommodation",   value: plan.temp_accommodation ? (plan.temp_accommodation_detail || "Included") : "Not included" },
    { label: "Electrical Damage",    value: plan.electrical_cover ? (plan.electrical_detail || "Included") : "Not included" },
    { label: "Glass Cover",          value: plan.glass_cover ? "Included" : "Not included" },
    { label: "Public Liability",     value: plan.public_liability ? (plan.public_liability_detail || "Included") : "Not included" },
    { label: "Rental Income",        value: plan.rental_income ? (plan.rental_income_detail || "Included") : "Not included" },
    { label: "Jewelry / Valuables",  value: plan.jewelry_cover ? (plan.jewelry_detail || "Included") : "Not included" },
    { label: "All-Risk Contents",    value: plan.all_risk_contents ? "Included" : "Not included" },
    { label: "Claim Process",        value: plan.claim_process },
    { label: "Eligibility",          value: plan.eligibility },
  ].filter(r => r.value && r.value !== "Not included");
}

export function travelRows(plan: MultiPlan): DetailRow[] {
  return [
    { label: "Scope",             value: plan.travel_scope },
    { label: "Medical Cover",      value: plan.medical_cover_amount },
    { label: "Medical (USD)",      value: plan.medical_cover_usd },
    { label: "Emergency Evac",     value: plan.emergency_evacuation ? (plan.emergency_evac_amount || "Included") : "Not included" },
    { label: "Trip Cancellation",  value: plan.trip_cancellation ? (plan.trip_cancellation_amount || "Included") : "Not included" },
    { label: "Trip Delay",         value: plan.trip_delay ? (plan.trip_delay_threshold || "Included") : "Not included" },
    { label: "Lost Baggage",       value: plan.lost_baggage ? "Included" : "Not included" },
    { label: "Baggage Delay",      value: plan.baggage_delay ? "Included" : "Not included" },
    { label: "Passport Loss",      value: plan.passport_loss ? "Included" : "Not included" },
    { label: "Personal Liability", value: plan.personal_liability ? "Included" : "Not included" },
    { label: "Adventure Cover",    value: plan.adventure_cover ? (plan.adventure_types?.join(", ") || "Included") : "Not included" },
    { label: "Pre-Existing (PED)", value: plan.pre_existing_cover ? "Declared PED Covered" : "Not covered" },
    { label: "Schengen",           value: plan.schengen_compliant ? "Compliant" : "Not Schengen" },
    { label: "Annual Multi-Trip",  value: plan.annual_multi_trip ? "Available" : "Per-trip only" },
    { label: "Flight Hijack",      value: plan.flight_hijack ? "Included" : "Not included" },
    { label: "Concierge",          value: plan.concierge ? "Included" : "Not included" },
    { label: "Claim Process",      value: plan.claim_process },
    { label: "Eligibility",        value: plan.eligibility },
  ].filter(r => r.value && r.value !== "Not included" && r.value !== "Not covered" && r.value !== "Not Schengen" && r.value !== "Per-trip only" && r.value !== "Not covered"
    || ["Scope","Medical Cover","Claim Process","Eligibility"].includes(r.label)
  ).filter(r => r.value);
}

/** The detail rows for a plan given its insurance category. */
export function detailRowsFor(category: string, plan: MultiPlan): DetailRow[] {
  switch (category) {
    case "health":   return healthRows(plan);
    case "motor":    return motorRows(plan);
    case "property": return propertyRows(plan);
    case "travel":   return travelRows(plan);
    default:         return [];
  }
}
