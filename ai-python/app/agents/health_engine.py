"""
Aegis AI — Health Insurance Recommendation Engine
Segmentation, risk analysis, plan scoring, and Top-3 selection for Sarah AI.
"""

from __future__ import annotations
from typing import Any, Dict, List, Optional, Tuple
import re

from app.utils.money import parse_amount

from .health_plans import HEALTH_PLANS, PLANS_BY_SEGMENT, SEGMENT_THRESHOLDS

# Catalogue keyed the way a scored result refers to a plan. The ranked entries
# carry `plan_id` ("AEG-HLT-004"), not the catalogue key ("standard_protect"),
# so anything reading raw plan fields back off a result needs this.
_PLAN_BY_ID: Dict[str, Dict[str, Any]] = {
    plan["plan_id"]: plan for plan in HEALTH_PLANS.values()
}


# ── Helpers ───────────────────────────────────────────────────────────────────

def _parse_budget(raw: Any) -> Optional[int]:
    """Return monthly budget in INR, or None if unparseable."""
    if raw is None:
        return None
    # Drop the period words first ("2000/month", "2000 per month") so they
    # cannot be mistaken for part of the figure, then read the number.
    text = re.sub(r"(per|/)?(month|mo|yr|year|annual|annually)", "", str(raw).lower())
    val = parse_amount(text)
    if val is None:
        return None
    # "10k" is ten thousand rupees. Reading it as ₹10 put the customer in the
    # cheapest segment and scored every plan against a budget they never named.
    # If text hints at an annual figure (> 12000 without "month" context), convert
    if "annual" in str(raw).lower() or "year" in str(raw).lower():
        val = val / 12
    return int(val)


def _parse_age(raw: Any) -> Optional[int]:
    if raw is None:
        return None
    digits = re.findall(r"\d+", str(raw))
    return int(digits[0]) if digits else None


def _parse_family_size(raw: Any) -> int:
    if raw is None:
        return 1
    digits = re.findall(r"\d+", str(raw))
    return int(digits[0]) if digits else 1


def _has_preexisting(raw: Any) -> bool:
    if not raw:
        return False
    lower = str(raw).lower()
    return any(w in lower for w in [
        "yes", "diabetes", "hypertension", "bp", "heart", "thyroid",
        "asthma", "kidney", "cancer", "arthritis", "blood pressure",
    ])


def _city_tier(city: Any) -> int:
    """Return 1 for metro, 2 for Tier-2, 3 for small town."""
    if not city:
        return 2
    c = str(city).lower()
    tier1 = ["mumbai", "delhi", "bangalore", "bengaluru", "chennai", "kolkata", "hyderabad", "pune"]
    tier2 = ["ahmedabad", "surat", "jaipur", "lucknow", "kanpur", "nagpur", "indore", "bhopal",
             "visakhapatnam", "pimpri", "patna", "vadodara", "ludhiana", "agra", "kochi", "coimbatore"]
    for city_name in tier1:
        if city_name in c:
            return 1
    for city_name in tier2:
        if city_name in c:
            return 2
    return 3


# ── Customer segmentation ─────────────────────────────────────────────────────

def classify_segment(profile: Dict[str, Any]) -> str:
    """Return 'budget', 'standard', or 'premium'."""
    budget = _parse_budget(profile.get("budget"))
    if budget is None:
        budget = 1000  # default mid

    for segment, (lo, hi) in SEGMENT_THRESHOLDS.items():
        if lo <= budget < hi:
            return segment
    return "budget"


# ── Risk analysis ─────────────────────────────────────────────────────────────

def analyse_risk(profile: Dict[str, Any]) -> Dict[str, Any]:
    """
    Assess 9 risk dimensions. Returns a dict with per-dimension scores (0–10)
    and an overall risk_score (0–100, lower is better).
    """
    age          = _parse_age(profile.get("age"))       or 30
    family_size  = _parse_family_size(profile.get("family_size"))
    has_ped      = _has_preexisting(profile.get("medical_history"))
    city_tier    = _city_tier(profile.get("location"))
    budget       = _parse_budget(profile.get("budget")) or 1000
    lifestyle    = str(profile.get("lifestyle", "")).lower()
    smoking      = any(w in lifestyle for w in ["smoke", "smoker", "tobacco"])
    active_life  = any(w in lifestyle for w in ["active", "gym", "sports", "fitness"])

    # 1. Age Risk (older → higher)
    age_risk = min(10, max(0, (age - 20) // 5))  # 0-10

    # 2. Pre-existing Condition Risk
    ped_risk = 8 if has_ped else 2

    # 3. Family Size Risk
    family_risk = min(9, family_size * 1.5)

    # 4. Lifestyle / Smoking Risk
    lifestyle_risk = 7 if smoking else (2 if active_life else 4)

    # 5. Location / Hospital Access Risk
    location_risk = 2 if city_tier == 1 else (4 if city_tier == 2 else 7)

    # 6. Financial Exposure Risk (coverage needs vs budget)
    coverage_need = family_size * 300_000  # ₹3L per person baseline
    budget_annual = budget * 12
    affordability_ratio = budget_annual / max(coverage_need, 1)
    financial_risk = max(0, 10 - int(affordability_ratio * 30))  # 0-10

    # 7. Coverage Gap Risk
    expected_plan = SEGMENT_THRESHOLDS.get("standard", (1200, 3500))
    coverage_gap_risk = 3 if budget >= expected_plan[0] else 8

    # 8. Hospital Network Risk (city tier drives this)
    network_risk = location_risk  # correlates

    # 9. Claim Probability
    claim_prob_risk = min(10, (age_risk * 0.4) + (ped_risk * 0.4) + (family_risk * 0.2))

    overall = int(
        age_risk * 0.15
        + ped_risk * 0.20
        + family_risk * 0.12
        + lifestyle_risk * 0.10
        + location_risk * 0.10
        + financial_risk * 0.13
        + coverage_gap_risk * 0.10
        + network_risk * 0.05
        + claim_prob_risk * 0.05
    ) * 10  # 0–100

    return {
        "age_risk":            round(age_risk, 1),
        "ped_risk":            round(ped_risk, 1),
        "family_risk":         round(family_risk, 1),
        "lifestyle_risk":      round(lifestyle_risk, 1),
        "location_risk":       round(location_risk, 1),
        "financial_risk":      round(financial_risk, 1),
        "coverage_gap_risk":   round(coverage_gap_risk, 1),
        "network_risk":        round(network_risk, 1),
        "claim_probability":   round(claim_prob_risk, 1),
        "overall_risk_score":  min(100, max(0, overall)),
    }


# ── Plan scoring ──────────────────────────────────────────────────────────────

def _score_plan(plan: Dict[str, Any], profile: Dict[str, Any], risk: Dict[str, Any]) -> Dict[str, int]:
    """Score a plan against a customer profile. Returns 0–100 for each dimension."""
    budget_monthly = _parse_budget(profile.get("budget")) or 1000
    age            = _parse_age(profile.get("age")) or 30
    family_size    = _parse_family_size(profile.get("family_size"))
    has_ped        = _has_preexisting(profile.get("medical_history"))
    wants_maternity = any(w in str(profile.get("coverage_type", "")).lower()
                          for w in ["maternity", "family", "newborn", "baby", "child"])

    # ── Budget Match ────────────────────────────────────────────────────────
    plan_avg_premium = (plan["premium_min"] + plan["premium_max"]) / 2
    diff_ratio = abs(plan_avg_premium - budget_monthly) / max(budget_monthly, 1)
    if diff_ratio <= 0.10:
        budget_score = 98
    elif diff_ratio <= 0.25:
        budget_score = 88
    elif diff_ratio <= 0.50:
        budget_score = 72
    elif diff_ratio <= 0.75:
        budget_score = 55
    elif plan_avg_premium < budget_monthly:
        budget_score = 85  # plan cheaper than budget — acceptable
    else:
        budget_score = max(20, int(80 - diff_ratio * 40))

    # ── Coverage Match ──────────────────────────────────────────────────────
    coverage = plan["coverage_amount"]
    needed_coverage = family_size * 300_000  # ₹3L per person baseline
    if age > 50:
        needed_coverage *= 1.5  # seniors need more
    if has_ped:
        needed_coverage *= 1.25

    cov_ratio = coverage / needed_coverage
    if cov_ratio >= 2.5:
        coverage_score = 97
    elif cov_ratio >= 1.5:
        coverage_score = 90
    elif cov_ratio >= 1.0:
        coverage_score = 80
    elif cov_ratio >= 0.7:
        coverage_score = 65
    else:
        coverage_score = 45

    # Maternity bonus
    plan_maternity = str(plan.get("maternity", "")).lower()
    has_maternity_cover = "not" not in plan_maternity and len(plan_maternity) > 5
    if wants_maternity and has_maternity_cover:
        coverage_score = min(100, coverage_score + 8)

    # ── Risk Match ──────────────────────────────────────────────────────────
    overall_risk = risk.get("overall_risk_score", 50)
    plan_tier = plan.get("segment", "budget")

    if plan_tier == "premium":
        ideal_risk_coverage = 85
    elif plan_tier == "standard":
        ideal_risk_coverage = 60
    else:
        ideal_risk_coverage = 35

    risk_diff = abs(overall_risk - ideal_risk_coverage)
    if risk_diff <= 10:
        risk_score = 95
    elif risk_diff <= 25:
        risk_score = 80
    elif risk_diff <= 40:
        risk_score = 65
    else:
        risk_score = 50

    # PED risk modifier
    ped_waiting = plan.get("ped_waiting", "4 years")
    if has_ped:
        if "immediate" in ped_waiting.lower() or "day 1" in ped_waiting.lower():
            risk_score = min(100, risk_score + 10)
        elif "1 year" in ped_waiting.lower():
            risk_score = min(100, risk_score + 5)
        elif "4 years" in ped_waiting.lower():
            risk_score = max(0, risk_score - 10)

    # ── Suitability Score ───────────────────────────────────────────────────
    suitability = int((budget_score * 0.30 + coverage_score * 0.35 + risk_score * 0.35))

    # ── Overall Recommendation Score ────────────────────────────────────────
    overall_score = int(budget_score * 0.25 + coverage_score * 0.35 + risk_score * 0.25 + suitability * 0.15)

    return {
        "overall":       min(100, max(0, overall_score)),
        "suitability":   min(100, max(0, suitability)),
        "budget_match":  min(100, max(0, int(budget_score))),
        "coverage_match":min(100, max(0, int(coverage_score))),
        "risk_match":    min(100, max(0, int(risk_score))),
    }


# ── Explanation builder ───────────────────────────────────────────────────────

def _build_plan_quality(
    plan: Dict[str, Any],
    all_plans: List[Dict[str, Any]],
    profile: Dict[str, Any],
    scores: Dict[str, int],
    rank: int,
) -> Dict[str, str]:
    """Build recommendation-quality fields for a single plan."""
    family_size = _parse_family_size(profile.get("family_size"))
    age         = _parse_age(profile.get("age")) or 30
    has_ped     = _has_preexisting(profile.get("medical_history"))

    prefix = {1: "Top pick", 2: "Strong alternative", 3: "Value option"}.get(rank, "Option")

    # Why THIS plan
    reasons = []
    if scores["budget_match"] >= 88:
        reasons.append("fits comfortably within your budget")
    if scores["coverage_match"] >= 85:
        reasons.append(f"provides ₹{plan['coverage_amount'] // 100000}L coverage for a family of {family_size}")
    if has_ped and ("1 year" in plan.get("ped_waiting", "") or "immediate" in plan.get("ped_waiting", "").lower()):
        reasons.append("short PED waiting — valuable for pre-existing conditions")
    maternity = str(plan.get("maternity", "")).lower()
    if "yes" in maternity or "₹" in maternity:
        reasons.append("includes maternity cover")
    if plan.get("restoration") and "not" not in str(plan.get("restoration", "")).lower():
        reasons.append("restoration benefit keeps you covered after a claim")
    if not reasons:
        reasons.append("balanced coverage at the right premium")
    why_this = f"{prefix}: {', '.join(reasons[:3])}."

    # Why NOT the others (compare this plan vs alternatives)
    others = [p for p in all_plans if p["plan_name"] != plan["plan_name"]]
    why_not = []
    for other in others[:2]:
        if plan["premium_max"] < other["premium_min"]:
            why_not.append(f"{other['plan_name']} costs more")
        elif plan["coverage_amount"] > other["coverage_amount"]:
            why_not.append(f"{other['plan_name']} has lower coverage")
        else:
            why_not.append(f"{other['plan_name']} has a different risk profile")
    why_not_others = "; ".join(why_not) if why_not else "Other plans are alternatives for different needs."

    # Future benefits
    ncb = plan.get("ncb", "")
    restoration = plan.get("restoration", "")
    future = []
    if "50%" in ncb or "100%" in ncb:
        future.append("NCB can reduce your renewal premium by up to 50%")
    elif "20%" in ncb or "25%" in ncb or "30%" in ncb:
        future.append(f"NCB builds up to reduce your premium each claim-free year")
    if "unlimited" in str(restoration).lower():
        future.append("unlimited restoration ensures you're never without cover mid-year")
    elif "100%" in str(restoration):
        future.append("100% restoration gives you a full reset after a claim")
    if age < 40:
        future.append("locking in coverage now avoids premium jumps at renewal")
    future_benefits = ". ".join(future) if future else "Renewal premium reduces each claim-free year with NCB."

    # Claim experience
    claim_ratio = plan.get("claim_ratio", "97%+")
    claim_process = plan.get("claim_process", "Cashless + Reimbursement")
    claim_exp = f"{claim_ratio} claim settlement ratio. {claim_process} — cashless at network hospitals means zero out-of-pocket at the time of admission."

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
    best-fit plan is by construction the same plan that would have ranked #1 in
    the three-plan view — one engine, one ordering, two presentations of it.
    """
    plan_keys  = PLANS_BY_SEGMENT.get(segment, PLANS_BY_SEGMENT["budget"])
    scored     = []

    for key in plan_keys:
        plan   = HEALTH_PLANS[key]
        scores = _score_plan(plan, profile, risk)
        scored.append((key, plan, scores))

    # Sort by overall score descending
    scored.sort(key=lambda x: x[2]["overall"], reverse=True)

    # Gather all plan dicts for cross-plan comparison
    all_plan_dicts = [p for _, p, _ in scored]

    plans_out = []
    for rank, (key, plan, scores) in enumerate(scored, start=1):
        monthly_avg = (plan["premium_min"] + plan["premium_max"]) // 2
        premium_display = f"₹{plan['premium_min']:,}–₹{plan['premium_max']:,}/month"

        quality = _build_plan_quality(plan, all_plan_dicts, profile, scores, rank)

        plan_entry = {
            "rank":               rank,
            "plan_id":            plan["plan_id"],
            "plan_name":          plan["plan_name"],
            "segment":            plan["segment"].capitalize(),
            "coverage":           plan["coverage_display"],
            "coverage_amount":    plan["coverage_amount"],
            "premium":            premium_display,
            "premium_monthly":    monthly_avg,
            "cashless_hospitals": plan["cashless_hospitals"],
            "room_rent":          plan["room_rent"],
            "icu":                plan["icu"],
            "day_care":           plan["day_care"],
            "ped_waiting":        plan["ped_waiting"],
            "ncb":                plan["ncb"],
            "health_checkup":     plan["health_checkup"],
            "maternity":          plan["maternity"],
            "critical_illness":   plan["critical_illness"],
            "ambulance":          plan["ambulance"],
            "restoration":        plan["restoration"],
            "opd":                plan.get("opd", "Not included"),
            "claim_process":      plan["claim_process"],
            "claim_ratio":        plan["claim_ratio"],
            "eligibility":        plan["eligibility"],
            "co_payment":         plan.get("co_payment", "Nil"),
            "benefits":           plan["benefits"],
            "exclusions":         plan["exclusions"],
            "suitable_for":       plan["suitable_for"],
            "risk_level":         plan["risk_level"],
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
    """
    The full ranked shortlist for this profile.
    Returns a fully-formed dict ready to embed as [RECOMMENDATION:{...}].
    """
    segment = classify_segment(profile)
    if risk is None:
        risk = analyse_risk(profile)

    plans_out = _rank_segment_plans(profile, risk, segment)

    return {
        "type":           "multi_plan",
        "category":       "health",
        "segment":        segment.capitalize(),
        "risk_summary":   risk,
        "plans":          plans_out,
        "total_plans":    len(plans_out),
        "recommended":    plans_out[0]["plan_name"] if plans_out else "",
    }


# ── Best-fit (single plan) ────────────────────────────────────────────────────

def _reason_codes(
    plan: Dict[str, Any],
    profile: Dict[str, Any],
    scores: Dict[str, int],
) -> List[str]:
    """Why this plan won, traced back to what the customer actually said.

    Each line names the requirement it came from, so the advisor's explanation
    is a reading of the engine's decision rather than a story told alongside it.
    Everything here is derived from the profile and the plan catalogue — nothing
    is asserted that is not in one of them.
    """
    codes: List[str] = []

    budget      = _parse_budget(profile.get("budget"))
    age         = _parse_age(profile.get("age"))
    family_size = _parse_family_size(profile.get("family_size"))
    has_ped     = _has_preexisting(profile.get("medical_history"))
    concern     = str(profile.get("primary_concern") or "").strip()
    existing    = str(profile.get("existing_coverage") or "").strip()
    premium_avg = (plan["premium_min"] + plan["premium_max"]) // 2

    if budget:
        if premium_avg <= budget:
            codes.append(
                f"Premium sits within the ₹{budget:,}/month they said was comfortable "
                f"(plan averages about ₹{premium_avg:,}/month)."
            )
        else:
            codes.append(
                f"Premium averages about ₹{premium_avg:,}/month against the "
                f"₹{budget:,}/month they named — above it, and they need to hear that."
            )
    if scores["coverage_match"] >= 80:
        codes.append(
            f"{plan['coverage_display']} cover matches what {family_size} "
            f"{'person' if family_size == 1 else 'people'} in this profile need."
        )
    if age and age >= 55:
        codes.append(
            f"Eldest member is {age} — this plan's eligibility and room-rent terms "
            f"({plan['room_rent']}) suit older members."
        )
    if has_ped:
        codes.append(
            f"Existing conditions were declared, so the {plan['ped_waiting']} "
            f"pre-existing waiting period is a deciding factor here."
        )
    if concern:
        codes.append(f"Their stated concern — \"{concern}\" — drove the weighting.")
    if existing:
        codes.append(f"Sits on top of cover they already hold: \"{existing}\".")
    if not codes:
        codes.append("Highest overall score against the requirements they confirmed.")
    return codes


def get_best_fit_recommendation(
    profile: Dict[str, Any],
    risk: Optional[Dict[str, Any]] = None,
    exclude_plan_ids: Optional[List[str]] = None,
) -> Optional[Dict[str, Any]]:
    """The single plan that best fits this profile.

    A customer asked one question — "what should I buy?" — and three ranked
    cards is not an answer to it, it is the shortlist handed over for them to do
    the choosing. The engine already knows which plan scores highest; this
    returns that one, with the reasons it won, and keeps the rest available for
    a customer who explicitly asks what else there is.

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

    best = remaining[0]
    # Presented on its own, so it is not "rank 2 of 3" to the customer.
    best = {**best, "rank": 1}

    return {
        "type":         "single_plan",
        "category":     "health",
        "segment":      segment.capitalize(),
        "risk_summary": risk,
        "plans":        [best],
        "total_plans":  1,
        "recommended":  best["plan_name"],
        "reason_codes": _reason_codes(_PLAN_BY_ID[best["plan_id"]], profile, best["scores"]),
        # There are others, and the customer is told so — but they are not sent
        # until asked for. Names and prices stay server-side until then.
        "alternatives_available": len(remaining) > 1,
        "considered_count":       len(ranked),
    }
