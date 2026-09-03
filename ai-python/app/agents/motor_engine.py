"""
Aegis AI — Motor Insurance Recommendation Engine
Vehicle classification, risk analysis, plan scoring, and Top-3 selection for Alex AI.
"""

from __future__ import annotations
from typing import Any, Dict, List, Optional
import re

from .motor_plans import MOTOR_PLANS, PLANS_BY_SEGMENT, SEGMENT_THRESHOLDS, VEHICLE_CATEGORIES

# Catalogue keyed the way a scored result refers to a plan. Ranked entries carry
# `plan_id`, not the catalogue key, so anything reading raw plan fields back off
# a result needs this.
_PLAN_BY_ID: Dict[str, Dict[str, Any]] = {
    plan["plan_id"]: plan for plan in MOTOR_PLANS.values()
}


def _reason_codes(
    plan: Dict[str, Any],
    profile: Dict[str, Any],
    scores: Dict[str, int],
) -> List[str]:
    """Why this plan won, traced back to what the customer actually said.

    Everything here is derived from the profile and the plan catalogue — nothing
    is asserted that is not in one of them.
    """
    codes: List[str] = []
    vehicle  = str(profile.get("vehicle_detail") or profile.get("vehicle_type") or "").strip()
    usage    = str(profile.get("usage_type") or "").strip()
    claims   = str(profile.get("claim_history") or "").strip()
    want     = str(profile.get("insurance_type") or "").strip()
    budget   = _parse_budget(profile.get("budget"))
    premium  = (plan["premium_min"] + plan["premium_max"]) // 2

    if budget:
        if premium <= budget:
            codes.append(
                f"Premium averages about ₹{premium:,}/year, inside the "
                f"₹{budget:,} they named."
            )
        else:
            codes.append(
                f"Premium averages about ₹{premium:,}/year against the "
                f"₹{budget:,} they named — above it, and they need to hear that."
            )
    if vehicle:
        codes.append(f"Matched to the vehicle they described: \"{vehicle}\".")
    if want:
        codes.append(f"They asked for {want}, and this plan\'s cover type fits that.")
    if usage:
        codes.append(f"Rated for {usage} use, as they described it.")
    if claims:
        codes.append(f"Claim history taken into account: \"{claims}\".")
    if not codes:
        codes.append("Highest overall score against the requirements they confirmed.")
    return codes



# ── Helpers ───────────────────────────────────────────────────────────────────

def _parse_budget(raw: Any) -> Optional[int]:
    if raw is None:
        return None
    text = str(raw).lower().replace(",", "").replace(" ", "")
    text = re.sub(r"(per|/)?(month|mo)", "", text)
    # If "annual" or "year" present, keep as-is; if monthly, multiply by 12
    is_monthly = any(w in str(raw).lower() for w in ["month", "/mo", "per mo"])
    digits = re.findall(r"\d+", text)
    if not digits:
        return None
    val = int(digits[0])
    if is_monthly:
        val = val * 12  # convert to annual
    return val


def _parse_year(raw: Any) -> Optional[int]:
    if raw is None:
        return None
    digits = re.findall(r"\d{4}", str(raw))
    return int(digits[0]) if digits else None


def _vehicle_age(registration_year: Optional[int]) -> int:
    if not registration_year:
        return 3  # default mid
    import datetime
    return max(0, datetime.datetime.now().year - registration_year)


def _parse_idv(raw: Any) -> Optional[int]:
    if not raw:
        return None
    text = str(raw).replace(",", "").lower()
    # Convert lakhs (e.g. "8.5 lakh" → 850000)
    lakh_match = re.search(r"(\d+\.?\d*)\s*l(akh)?", text)
    if lakh_match:
        return int(float(lakh_match.group(1)) * 100_000)
    digits = re.findall(r"\d+", text)
    return int(digits[0]) if digits else None


# ── Vehicle classification ─────────────────────────────────────────────────────

def classify_vehicle(profile: Dict[str, Any]) -> str:
    """Return vehicle category key from VEHICLE_CATEGORIES."""
    raw = str(profile.get("vehicle_type", "") or profile.get("vehicle_detail", "") or "").lower()
    for category, keywords in VEHICLE_CATEGORIES.items():
        for kw in keywords:
            if kw in raw:
                return category
    return "private_car"  # safe default


# ── Segment classification ─────────────────────────────────────────────────────

def classify_segment(profile: Dict[str, Any]) -> str:
    budget = _parse_budget(profile.get("budget"))
    if budget is None:
        # Estimate from vehicle value if known
        idv = _parse_idv(profile.get("idv") or profile.get("vehicle_detail"))
        if idv:
            budget = int(idv * 0.04)  # 4% of IDV as rough annual premium
        else:
            budget = 10000  # default mid

    for segment, (lo, hi) in SEGMENT_THRESHOLDS.items():
        if lo <= budget < hi:
            return segment
    return "standard"


# ── Risk analysis ─────────────────────────────────────────────────────────────

def analyse_risk(profile: Dict[str, Any]) -> Dict[str, Any]:
    """7-dimension motor risk analysis. Returns per-dimension scores and overall."""
    reg_year     = _parse_year(profile.get("registration_year"))
    vehicle_age  = _vehicle_age(reg_year)
    vehicle_cat  = classify_vehicle(profile)
    usage_type   = str(profile.get("usage_type", "personal")).lower()
    location     = str(profile.get("location", "")).lower()
    claim_hist   = str(profile.get("claim_history", "no")).lower()
    fuel_type    = str(profile.get("fuel_type", "petrol")).lower()
    insurance_t  = str(profile.get("insurance_type", "comprehensive")).lower()

    # 1. Vehicle Risk (age, category)
    vehicle_risk = min(10, vehicle_age * 0.8)
    if vehicle_cat in ["luxury", "electric"]:
        vehicle_risk = min(10, vehicle_risk + 2)

    # 2. Accident / Claim Risk
    has_prior_claim = any(w in claim_hist for w in ["yes", "claimed", "accident", "hit"])
    claim_risk = 7 if has_prior_claim else 3

    # 3. Location / Urban Risk (metro = more accident risk)
    urban_cities = ["mumbai", "delhi", "bangalore", "bengaluru", "chennai", "kolkata", "hyderabad", "pune"]
    is_metro = any(c in location for c in urban_cities)
    location_risk = 7 if is_metro else 4

    # 4. Theft Risk (metro + luxury = higher)
    theft_risk = (6 if is_metro else 3) + (3 if vehicle_cat == "luxury" else 0)
    theft_risk = min(10, theft_risk)

    # 5. Commercial Use Risk
    is_commercial = "commercial" in usage_type
    commercial_risk = 8 if is_commercial else 2

    # 6. Premium Affordability Risk
    budget = _parse_budget(profile.get("budget"))
    idv = _parse_idv(profile.get("idv") or profile.get("vehicle_detail"))
    if budget and idv:
        premium_pct = budget / idv
        premium_risk = max(0, 10 - int(premium_pct * 200))
    else:
        premium_risk = 5

    # 7. EV/Fuel Risk
    fuel_risk = 4 if "electric" in fuel_type else 2

    overall = int(
        vehicle_risk   * 0.20
        + claim_risk   * 0.20
        + location_risk* 0.15
        + theft_risk   * 0.15
        + commercial_risk* 0.10
        + premium_risk * 0.12
        + fuel_risk    * 0.08
    ) * 10

    return {
        "vehicle_risk":    round(vehicle_risk, 1),
        "claim_risk":      round(claim_risk, 1),
        "location_risk":   round(location_risk, 1),
        "theft_risk":      round(theft_risk, 1),
        "commercial_risk": round(commercial_risk, 1),
        "premium_risk":    round(premium_risk, 1),
        "fuel_risk":       round(fuel_risk, 1),
        "overall_risk_score": min(100, max(0, overall)),
    }


# ── Plan scoring ──────────────────────────────────────────────────────────────

def _score_plan(plan: Dict[str, Any], profile: Dict[str, Any], risk: Dict[str, Any]) -> Dict[str, int]:
    budget_annual = _parse_budget(profile.get("budget")) or 10000
    vehicle_age   = _vehicle_age(_parse_year(profile.get("registration_year")))
    vehicle_cat   = classify_vehicle(profile)
    fuel_type     = str(profile.get("fuel_type", "petrol")).lower()
    is_ev         = "electric" in fuel_type
    is_commercial = "commercial" in str(profile.get("usage_type", "")).lower()
    stated_cover  = str(profile.get("insurance_type", "")).lower()
    wants_tp_only = "third" in stated_cover
    # Only when they actually said it. An unanswered question is not a request
    # for comprehensive, and must not quietly penalise the cheaper plans.
    wants_comprehensive = "comprehensive" in stated_cover or "full" in stated_cover
    overall_risk  = risk.get("overall_risk_score", 50)

    # ── Budget Match ────────────────────────────────────────────────────────
    plan_avg = (plan["premium_min"] + plan["premium_max"]) / 2
    diff_ratio = abs(plan_avg - budget_annual) / max(budget_annual, 1)
    if diff_ratio <= 0.10:
        budget_score = 98
    elif diff_ratio <= 0.25:
        budget_score = 87
    elif diff_ratio <= 0.50:
        budget_score = 70
    elif plan_avg < budget_annual:
        budget_score = 85  # cheaper than budget — fine
    else:
        budget_score = max(20, int(75 - diff_ratio * 35))

    # ── Coverage Match ──────────────────────────────────────────────────────
    has_zero_dep    = plan.get("zero_dep", False)
    has_engine      = plan.get("engine_protect", False)
    has_ev_battery  = plan.get("battery_cover", False)
    has_rsa         = plan.get("rsa", False)
    has_consumables = plan.get("consumables", False)

    coverage_score = 70  # base
    if vehicle_age <= 3:
        if has_zero_dep:
            coverage_score += 15
        if has_engine:
            coverage_score += 8
    elif vehicle_age <= 7:
        if has_zero_dep:
            coverage_score += 8
        if has_engine:
            coverage_score += 5
    else:
        # Older vehicles — zero dep less useful (parts cheaper)
        coverage_score += 0

    if is_ev and has_ev_battery:
        coverage_score += 12
    if has_rsa:
        coverage_score += 5
    if has_consumables:
        coverage_score += 5
    if is_commercial and plan.get("policy_type", "").lower().count("commercial") > 0:
        coverage_score += 5
    plan_is_tp_only = plan.get("policy_type", "").lower().startswith("third")
    if wants_tp_only and plan_is_tp_only:
        coverage_score = 98  # perfect match
    elif wants_comprehensive and plan_is_tp_only:
        # The preference only ever worked in one direction: asking for third
        # party lifted those plans to a perfect score, but asking for
        # comprehensive did nothing to lower them. A third-party policy is also
        # the cheapest thing on the shelf, and the budget score rewards coming
        # in under budget — so a customer who said "comprehensive cover please"
        # was shown Third Party Only ranked first, described as comprehensive
        # protection. It is not: it pays for damage to other people and nothing
        # for your own vehicle. A plan that cannot do the thing that was asked
        # for should not win on price.
        coverage_score = min(coverage_score, 25)

    coverage_score = min(100, coverage_score)

    # ── Risk Match ──────────────────────────────────────────────────────────
    plan_tier = plan.get("segment", "budget")
    ideal_risk = {"premium": 80, "standard": 55, "budget": 30}.get(plan_tier, 50)
    risk_diff = abs(overall_risk - ideal_risk)
    if risk_diff <= 10:
        risk_score = 95
    elif risk_diff <= 25:
        risk_score = 80
    elif risk_diff <= 40:
        risk_score = 65
    else:
        risk_score = 48

    # EV + no battery cover → risk mismatch penalty
    if is_ev and not has_ev_battery:
        risk_score = max(0, risk_score - 20)

    # Commercial + no commercial cover → mismatch
    if is_commercial and plan["segment"] == "budget":
        risk_score = max(0, risk_score - 15)

    # ── Suitability ─────────────────────────────────────────────────────────
    suitability = int(budget_score * 0.30 + coverage_score * 0.40 + risk_score * 0.30)

    overall_score = int(budget_score * 0.25 + coverage_score * 0.40 + risk_score * 0.20 + suitability * 0.15)

    return {
        "overall":       min(100, max(0, overall_score)),
        "suitability":   min(100, max(0, suitability)),
        "budget_match":  min(100, max(0, int(budget_score))),
        "coverage_match":min(100, max(0, int(coverage_score))),
        "risk_match":    min(100, max(0, int(risk_score))),
    }


def _build_plan_quality(
    plan: Dict[str, Any],
    all_plans: List[Dict[str, Any]],
    profile: Dict[str, Any],
    scores: Dict[str, int],
    rank: int,
) -> Dict[str, str]:
    vehicle_age = _vehicle_age(_parse_year(profile.get("registration_year")))
    is_ev = "electric" in str(profile.get("fuel_type", "")).lower()
    prefix = {1: "Top pick", 2: "Strong alternative", 3: "Value option"}.get(rank, "Option")

    # Why THIS plan
    reasons = []
    if scores["budget_match"] >= 85:
        reasons.append("aligns with your annual premium budget")
    if plan.get("zero_dep") and vehicle_age <= 5:
        reasons.append("zero depreciation ensures full claim value on your newer vehicle")
    if plan.get("engine_protect"):
        reasons.append("engine protection covers monsoon/flood risks")
    if is_ev and plan.get("battery_cover"):
        reasons.append("EV battery cover protects your biggest asset")
    if plan.get("rsa"):
        reasons.append("24×7 roadside assistance included")
    if not reasons:
        # This branch is reached when a plan has none of the extras above —
        # which is precisely what a bare third-party policy is. Calling that
        # "comprehensive cover" told the customer the opposite of what they
        # were buying.
        if plan.get("policy_type", "").lower().startswith("third"):
            reasons.append(
                "covers damage you cause to other people, as the law requires — "
                "not damage to your own vehicle"
            )
        else:
            reasons.append("solid comprehensive cover for your vehicle type")
    why_this = f"{prefix}: {', '.join(reasons[:3])}."

    # Why NOT the others
    others = [p for p in all_plans if p["plan_name"] != plan["plan_name"]]
    why_not = []
    for other in others[:2]:
        if plan["premium_max"] < other["premium_min"]:
            why_not.append(f"{other['plan_name']} costs more annually")
        elif not plan.get("zero_dep") and other.get("zero_dep"):
            why_not.append(f"{other['plan_name']} includes zero dep — suitable for newer vehicles")
        else:
            why_not.append(f"{other['plan_name']} suits a different usage or risk profile")
    why_not_others = "; ".join(why_not) if why_not else "Other options offer different add-on combinations."

    # Future benefits
    ncb = str(plan.get("ncb", ""))
    future = []
    if "50%" in ncb or "60%" in ncb or "70%" in ncb:
        future.append("NCB builds up to reduce your renewal premium significantly")
    if plan.get("zero_dep") and vehicle_age <= 3:
        future.append("zero dep is most valuable in the first 5 years — saves thousands at claim time")
    if plan.get("return_invoice"):
        future.append("return-to-invoice protects your investment in case of total loss")
    future_benefits = ". ".join(future) if future else "NCB reduces your premium each claim-free year."

    # Claim experience
    claim_ratio = plan.get("claim_ratio", "98%+")
    cashless = plan.get("cashless_garages", "2,000+")
    claim_exp = f"{claim_ratio} claim settlement. Cashless repair at {cashless} authorised garages — no upfront payment needed at the workshop."

    return {
        "why_this_plan":  why_this,
        "why_not_others": why_not_others,
        "future_benefits": future_benefits,
        "claim_experience": claim_exp,
        "advantages": reasons,
        "limitations": plan.get("exclusions", [])[:3],
    }


# ── Top-3 recommendation ──────────────────────────────────────────────────────

def _rank_segment_plans(
    profile: Dict[str, Any],
    risk: Dict[str, Any],
    segment: str,
) -> List[Dict[str, Any]]:
    """Every plan in the customer's segment, scored and ranked best-first.

    The single shared scoring pass behind both entry points below, so a
    best-fit plan is by construction the plan that would have ranked #1 in the
    shortlist — one engine, one ordering, two presentations of it.
    """
    plan_keys = PLANS_BY_SEGMENT.get(segment, PLANS_BY_SEGMENT["standard"])
    scored = []

    for key in plan_keys:
        plan   = MOTOR_PLANS[key]
        scores = _score_plan(plan, profile, risk)
        scored.append((key, plan, scores))

    scored.sort(key=lambda x: x[2]["overall"], reverse=True)

    all_plan_dicts = [p for _, p, _ in scored]

    plans_out = []
    for rank, (key, plan, scores) in enumerate(scored, start=1):
        avg_premium = (plan["premium_min"] + plan["premium_max"]) // 2
        premium_display = f"₹{plan['premium_min']:,}–₹{plan['premium_max']:,}/year"

        quality = _build_plan_quality(plan, all_plan_dicts, profile, scores, rank)

        plan_entry = {
            "rank":               rank,
            "plan_id":            plan["plan_id"],
            "plan_name":          plan["plan_name"],
            "segment":            plan["segment"].capitalize(),
            "policy_type":        plan["policy_type"],
            "coverage":           plan["coverage_display"],
            "premium":            premium_display,
            "premium_annual":     avg_premium,
            "own_damage":         plan["own_damage"],
            "third_party":        plan["third_party"],
            "pa_owner_driver":    plan["pa_owner_driver"],
            "zero_dep":           plan.get("zero_dep", False),
            "zero_dep_claims":    plan.get("zero_dep_claims", "N/A"),
            "engine_protect":     plan.get("engine_protect", False),
            "engine_protect_detail": plan.get("engine_protect_detail", ""),
            "rsa":                plan.get("rsa", False),
            "rsa_services":       plan.get("rsa_services", ""),
            "ncb":                plan.get("ncb", ""),
            "consumables":        plan.get("consumables", False),
            "return_invoice":     plan.get("return_invoice", False),
            "key_protect":        plan.get("key_protect", False),
            "tyre_protect":       plan.get("tyre_protect", False),
            "battery_cover":      plan.get("battery_cover", False),
            "battery_cover_detail": plan.get("battery_cover_detail", ""),
            "idv":                plan.get("idv", "Market value"),
            "cashless_garages":   plan.get("cashless_garages", ""),
            "claim_process":      plan.get("claim_process", ""),
            "claim_ratio":        plan.get("claim_ratio", ""),
            "benefits":           plan.get("benefits", []),
            "exclusions":         plan.get("exclusions", []),
            "suitable_for":       plan.get("suitable_for", []),
            "scores":             scores,
            # Recommendation quality
            "why_this_plan":     quality["why_this_plan"],
            "why_not_others":    quality["why_not_others"],
            "future_benefits":   quality["future_benefits"],
            "claim_experience":  quality["claim_experience"],
            "advantages":        quality["advantages"],
            "limitations":       quality["limitations"],
        }
        plans_out.append(plan_entry)

    return plans_out


def get_top3_recommendations(
    profile: Dict[str, Any],
    risk: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    """The full ranked shortlist for this profile."""
    segment = classify_segment(profile)
    if risk is None:
        risk = analyse_risk(profile)

    plans_out = _rank_segment_plans(profile, risk, segment)

    return {
        "type":        "multi_plan",
        "category":    "motor",
        "segment":     segment.capitalize(),
        "vehicle_cat": classify_vehicle(profile),
        "risk_summary": risk,
        "plans":       plans_out,
        "total_plans": len(plans_out),
        "recommended": plans_out[0]["plan_name"] if plans_out else "",
    }


def get_best_fit_recommendation(
    profile: Dict[str, Any],
    risk: Optional[Dict[str, Any]] = None,
    exclude_plan_ids: Optional[List[str]] = None,
) -> Optional[Dict[str, Any]]:
    """The single plan that best fits this profile.

    The customer asked one question — what should I buy? — and a shortlist is
    not an answer to it, it is the choosing handed back to them. The engine
    already knows which plan scores highest; this returns that one with the
    reasons it won, and keeps the rest available for a customer who explicitly
    asks what else there is.

    `exclude_plan_ids` skips plans already shown, which is how "can I see
    another option?" is served without dumping the catalogue.
    """
    segment = classify_segment(profile)
    if risk is None:
        risk = analyse_risk(profile)

    ranked = _rank_segment_plans(profile, risk, segment)
    if not ranked:
        return None

    excluded  = set(exclude_plan_ids or [])
    remaining = [p for p in ranked if p["plan_id"] not in excluded]
    if not remaining:
        return None

    # Presented on its own, so it is not "rank 2 of 3" to the customer.
    best = {**remaining[0], "rank": 1}

    return {
        "type":        "single_plan",
        "category":    "motor",
        "segment":     segment.capitalize(),
        "vehicle_cat": classify_vehicle(profile),
        "risk_summary": risk,
        "plans":       [best],
        "total_plans": 1,
        "recommended": best["plan_name"],
        "reason_codes": _reason_codes(
            _PLAN_BY_ID[best["plan_id"]], profile, best["scores"]
        ),
        # There are others, and the customer is told so — but they are
        # not sent until asked for.
        "alternatives_available": len(remaining) > 1,
        "considered_count":       len(ranked),
    }
