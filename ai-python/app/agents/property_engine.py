"""
Aegis AI — Property Insurance Recommendation Engine
Property classification, 9-dimension risk analysis, plan scoring, and Top-3 selection for Emma AI.
"""

from __future__ import annotations
from typing import Any, Dict, List, Optional
import re

from .property_plans import PROPERTY_PLANS, PLANS_BY_SEGMENT, SEGMENT_THRESHOLDS, PROPERTY_CATEGORIES

# Catalogue keyed the way a scored result refers to a plan.
_PLAN_BY_ID: Dict[str, Dict[str, Any]] = {
    plan["plan_id"]: plan for plan in PROPERTY_PLANS.values()
}


def _reason_codes(
    plan: Dict[str, Any],
    profile: Dict[str, Any],
    scores: Dict[str, int],
) -> List[str]:
    """Why this plan won, traced back to what the customer actually said."""
    codes: List[str] = []
    prop_type = str(profile.get("property_type") or "").strip()
    location  = str(profile.get("location") or "").strip()
    value     = str(profile.get("property_value") or "").strip()
    contents  = str(profile.get("contents_value") or "").strip()
    security  = str(profile.get("security_system") or "").strip()
    ownership = str(profile.get("ownership_type") or "").strip()

    if prop_type:
        codes.append(f"Matched to the property they described: {prop_type}.")
    if value:
        codes.append(f"Structure cover sized against the value they gave: {value}.")
    if contents:
        codes.append(f"Contents cover sized against what they said is inside: {contents}.")
    if location:
        codes.append(
            f"Location drives the flood, cyclone and earthquake weighting — "
            f"theirs is {location}."
        )
    if ownership:
        codes.append(f"Rated for how the property is used: {ownership}.")
    if security:
        codes.append(f"Security in place was taken into account: \"{security}\".")
    if not codes:
        codes.append("Highest overall score against the requirements they confirmed.")
    return codes



# ── Parsers ───────────────────────────────────────────────────────────────────

def _parse_budget(raw: Any) -> Optional[int]:
    """Parse annual budget in INR from free text."""
    if raw is None:
        return None
    text = str(raw).lower().replace(",", "").replace(" ", "")
    # Convert lakh
    lakh = re.search(r"(\d+\.?\d*)\s*l(?:akh)?", text)
    if lakh:
        val = float(lakh.group(1)) * 100_000
        # Monthly vs annual
        if any(w in str(raw).lower() for w in ["month", "/mo", "per mo"]):
            val *= 12
        return int(val)
    # Convert crore
    crore = re.search(r"(\d+\.?\d*)\s*cr(?:ore)?", text)
    if crore:
        return int(float(crore.group(1)) * 10_000_000)
    # Plain digits
    digits = re.findall(r"\d+", text)
    if not digits:
        return None
    val = int(digits[0])
    if any(w in str(raw).lower() for w in ["month", "/mo", "per mo"]):
        val *= 12
    return val


def _parse_inr(raw: Any) -> Optional[int]:
    """Parse property / contents value in INR (supports lakh, crore, L, Cr, ₹)."""
    if raw is None:
        return None
    text = str(raw).replace(",", "").replace("₹", "").lower()
    crore = re.search(r"(\d+\.?\d*)\s*cr(?:ore)?", text)
    if crore:
        return int(float(crore.group(1)) * 10_000_000)
    lakh = re.search(r"(\d+\.?\d*)\s*l(?:akh)?", text)
    if lakh:
        return int(float(lakh.group(1)) * 100_000)
    digits = re.findall(r"\d+", text)
    if not digits:
        return None
    return int(digits[0])


def _parse_age(raw: Any) -> int:
    """Parse property age in years from free text."""
    if raw is None:
        return 10  # default mid-age
    digits = re.findall(r"\d+", str(raw))
    return int(digits[0]) if digits else 10


def _parse_area(raw: Any) -> Optional[int]:
    """Parse built-up area in sq ft (converts sq m if needed)."""
    if raw is None:
        return None
    text = str(raw).lower().replace(",", "")
    sqm = re.search(r"(\d+\.?\d*)\s*(?:sq\.?\s*m|sqm|m2|metre)", text)
    if sqm:
        return int(float(sqm.group(1)) * 10.764)
    digits = re.findall(r"\d+", text)
    return int(digits[0]) if digits else None


# ── Property classification ───────────────────────────────────────────────────

def classify_property(profile: Dict[str, Any]) -> str:
    raw = str(
        profile.get("property_type", "")
        or profile.get("property", "")
        or ""
    ).lower()
    for category, keywords in PROPERTY_CATEGORIES.items():
        for kw in keywords:
            if kw in raw:
                return category
    return "apartment"


# ── Segment classification ─────────────────────────────────────────────────────

def classify_segment(profile: Dict[str, Any]) -> str:
    budget = _parse_budget(profile.get("budget"))
    if budget is None:
        # Estimate from property value
        prop_val = _parse_inr(profile.get("property_value"))
        if prop_val:
            budget = int(prop_val * 0.002)  # ~0.2% of property value
        else:
            budget = 9_000  # default mid-standard
    for segment, (lo, hi) in SEGMENT_THRESHOLDS.items():
        if lo <= budget < hi:
            return segment
    return "standard"


# ── Risk sub-calculators ──────────────────────────────────────────────────────

_FLOOD_HIGH = [
    "mumbai", "chennai", "kolkata", "patna", "guwahati", "varanasi",
    "allahabad", "prayagraj", "bhubaneswar", "hyderabad", "kochi",
    "trivandrum", "thiruvananthapuram", "srinagar", "dispur",
]
_FLOOD_MOD = ["delhi", "bengaluru", "bangalore", "pune", "lucknow", "jaipur", "nagpur"]

_QUAKE_HIGH = [
    "srinagar", "jammu", "shimla", "manali", "dehradun", "haridwar",
    "mussoorie", "uttarkashi", "chamoli", "imphal", "kohima", "shillong",
    "guwahati", "itanagar", "aizawl", "agartala", "gangtok", "sikkim",
    "port blair", "andaman",
]
_QUAKE_MOD = ["delhi", "chandigarh", "amritsar", "agra", "lucknow", "ahmedabad", "surat", "mumbai"]
_QUAKE_LOW = ["bangalore", "bengaluru", "hyderabad", "chennai", "kolkata", "pune", "bhopal", "jaipur"]

_STORM_HIGH = ["chennai", "bhubaneswar", "visakhapatnam", "vizag", "kolkata", "paradip",
               "machilipatnam", "kakinada", "mangalore", "karwar"]
_STORM_MOD  = ["mumbai", "kochi", "trivandrum", "thiruvananthapuram", "goa", "panaji"]


def _fire_risk(construction_type: str, property_age: int, prop_cat: str) -> float:
    risk = 2.0
    if "wood" in construction_type or "timber" in construction_type:
        risk = 7.5
    elif "prefab" in construction_type or "steel" in construction_type or "tin" in construction_type:
        risk = 5.5
    elif "brick" in construction_type:
        risk = 3.5
    # RCC / concrete keeps base

    if property_age > 30:
        risk = min(10, risk + 2.5)
    elif property_age > 20:
        risk = min(10, risk + 1.5)
    elif property_age > 10:
        risk = min(10, risk + 0.5)

    # Commercial / industrial fire risk higher
    if prop_cat in ["factory", "warehouse", "shop"]:
        risk = min(10, risk + 1.5)

    return risk


def _flood_risk(location: str, prop_cat: str) -> float:
    if any(c in location for c in _FLOOD_HIGH):
        base = 8.0
    elif any(c in location for c in _FLOOD_MOD):
        base = 5.0
    else:
        base = 2.5

    if any(w in location for w in ["river", "lake", "low-lying", "flood", "coast", "sea"]):
        base = min(10, base + 1.5)
    if prop_cat in ["agricultural", "warehouse", "factory"]:
        base = min(10, base + 1.0)

    return base


def _earthquake_risk(location: str) -> float:
    if any(c in location for c in _QUAKE_HIGH):
        return 8.5
    if any(c in location for c in _QUAKE_MOD):
        return 6.0
    if any(c in location for c in _QUAKE_LOW):
        return 3.5
    return 4.0  # moderate default for unlisted


def _storm_risk(location: str) -> float:
    if any(c in location for c in _STORM_HIGH):
        return 8.0
    if any(c in location for c in _STORM_MOD):
        return 5.5
    return 2.5


def _theft_risk(location: str, security: str, prop_cat: str) -> float:
    # Metro base theft risk
    metros = ["mumbai", "delhi", "bangalore", "bengaluru", "chennai", "kolkata",
              "hyderabad", "pune", "ahmedabad", "surat"]
    is_metro = any(c in location for c in metros)
    base = 6.0 if is_metro else 3.5

    # Security system modifiers
    if any(w in security for w in ["guard", "watchman", "security"]):
        base = max(1, base - 1.5)
    if any(w in security for w in ["alarm", "cctv", "camera", "sensor"]):
        base = max(1, base - 1.0)
    if "none" in security or "basic" in security or "lock" in security:
        base = min(10, base + 1.5)

    # Property type
    if prop_cat in ["shop", "warehouse", "factory"]:
        base = min(10, base + 1.5)
    elif prop_cat == "villa":
        base = min(10, base + 0.5)

    return base


def _electrical_risk(property_age: int, prop_cat: str) -> float:
    if property_age > 25:
        base = 7.5
    elif property_age > 15:
        base = 5.5
    elif property_age > 5:
        base = 3.5
    else:
        base = 2.0

    if prop_cat in ["factory", "warehouse", "office"]:
        base = min(10, base + 1.5)
    return base


def _water_risk(prop_cat: str, property_age: int) -> float:
    type_risk = {
        "apartment": 6.0, "independent_house": 4.5, "villa": 3.5,
        "office": 4.0, "shop": 3.5, "warehouse": 3.0,
        "factory": 3.5, "agricultural": 4.5, "rental_property": 5.0,
        "commercial_building": 4.5,
    }.get(prop_cat, 4.5)

    if property_age > 20:
        type_risk = min(10, type_risk + 2.0)
    elif property_age > 10:
        type_risk = min(10, type_risk + 1.0)
    return type_risk


def _location_risk(location: str, prop_cat: str) -> float:
    # Composite urban/crime risk
    tier1 = ["mumbai", "delhi", "bangalore", "bengaluru", "chennai", "kolkata",
             "hyderabad", "pune", "ahmedabad"]
    tier2 = ["jaipur", "lucknow", "nagpur", "bhopal", "indore", "patna",
             "surat", "kochi", "visakhapatnam", "chandigarh"]
    if any(c in location for c in tier1):
        base = 6.5
    elif any(c in location for c in tier2):
        base = 4.5
    else:
        base = 2.5

    if prop_cat in ["factory", "warehouse", "agricultural"]:
        base = min(10, base + 1.0)
    return base


def _construction_risk(construction_type: str, property_age: int) -> float:
    risk = {
        "wood": 8.0, "timber": 8.0,
        "prefab": 6.0, "steel": 5.0, "tin": 6.5,
        "brick": 3.0, "rcc": 1.5, "concrete": 1.5,
        "stone": 2.5, "pucca": 2.0,
    }
    base = 2.5
    for keyword, val in risk.items():
        if keyword in construction_type:
            base = val
            break

    if property_age > 40:
        base = min(10, base + 2.5)
    elif property_age > 25:
        base = min(10, base + 1.5)
    return base


# ── Full risk analysis ─────────────────────────────────────────────────────────

def analyse_risk(profile: Dict[str, Any]) -> Dict[str, Any]:
    """9-dimension property risk analysis."""
    prop_cat         = classify_property(profile)
    location         = str(profile.get("location", "")).lower()
    construction_type= str(profile.get("construction_type", "rcc")).lower()
    property_age     = _parse_age(profile.get("property_age"))
    security         = str(profile.get("security_system", "basic locks")).lower()

    fire_risk        = _fire_risk(construction_type, property_age, prop_cat)
    flood_risk       = _flood_risk(location, prop_cat)
    earthquake_risk  = _earthquake_risk(location)
    storm_risk       = _storm_risk(location)
    theft_risk       = _theft_risk(location, security, prop_cat)
    electrical_risk  = _electrical_risk(property_age, prop_cat)
    water_risk       = _water_risk(prop_cat, property_age)
    location_risk    = _location_risk(location, prop_cat)
    construction_risk= _construction_risk(construction_type, property_age)

    overall = int(
        fire_risk        * 0.18
        + flood_risk     * 0.14
        + earthquake_risk* 0.12
        + storm_risk     * 0.08
        + theft_risk     * 0.14
        + electrical_risk* 0.10
        + water_risk     * 0.10
        + location_risk  * 0.08
        + construction_risk * 0.06
    ) * 10

    return {
        "fire_risk":              round(fire_risk, 1),
        "flood_risk":             round(flood_risk, 1),
        "earthquake_risk":        round(earthquake_risk, 1),
        "storm_risk":             round(storm_risk, 1),
        "theft_risk":             round(theft_risk, 1),
        "electrical_damage_risk": round(electrical_risk, 1),
        "water_leakage_risk":     round(water_risk, 1),
        "location_risk":          round(location_risk, 1),
        "construction_risk":      round(construction_risk, 1),
        "overall_risk_score":     min(100, max(0, overall)),
    }


# ── Plan scoring ──────────────────────────────────────────────────────────────

def _score_plan(
    plan: Dict[str, Any],
    profile: Dict[str, Any],
    risk: Dict[str, Any],
) -> Dict[str, int]:
    budget_annual  = _parse_budget(profile.get("budget")) or 9_000
    prop_val       = _parse_inr(profile.get("property_value")) or 3_000_000
    contents_val   = _parse_inr(profile.get("contents_value")) or 500_000
    total_val      = prop_val + contents_val
    overall_risk   = risk.get("overall_risk_score", 50)
    flood_risk     = risk.get("flood_risk", 3)
    quake_risk     = risk.get("earthquake_risk", 3)
    theft_risk_val = risk.get("theft_risk", 3)
    fire_risk_val  = risk.get("fire_risk", 3)

    # ── Budget Match ─────────────────────────────────────────────────────────
    plan_avg = (plan["premium_min"] + plan["premium_max"]) / 2
    diff_ratio = abs(plan_avg - budget_annual) / max(budget_annual, 1)
    if diff_ratio <= 0.12:
        budget_score = 97
    elif diff_ratio <= 0.28:
        budget_score = 87
    elif diff_ratio <= 0.50:
        budget_score = 73
    elif plan_avg < budget_annual:
        budget_score = 83  # cheaper than budget — generally fine
    else:
        budget_score = max(20, int(70 - diff_ratio * 30))

    # ── Coverage Match ───────────────────────────────────────────────────────
    structure_cov  = plan["structure_coverage"]
    contents_cov   = plan["contents_coverage"]
    total_plan_cov = structure_cov + contents_cov

    # Coverage ratio vs property value
    cov_ratio = total_plan_cov / max(total_val, 1)
    if cov_ratio >= 1.0:
        coverage_score = 95
    elif cov_ratio >= 0.80:
        coverage_score = 85
    elif cov_ratio >= 0.60:
        coverage_score = 72
    elif cov_ratio >= 0.40:
        coverage_score = 58
    else:
        coverage_score = 40

    # Bonus for key risk-matched covers
    if flood_risk >= 6 and plan.get("flood_cover"):
        coverage_score = min(100, coverage_score + 8)
    if quake_risk >= 6 and plan.get("earthquake_cover"):
        coverage_score = min(100, coverage_score + 6)
    if theft_risk_val >= 6 and plan.get("theft_cover"):
        coverage_score = min(100, coverage_score + 5)
    if fire_risk_val >= 7 and plan.get("fire_cover"):
        coverage_score = min(100, coverage_score + 5)
    if plan.get("temp_accommodation"):
        coverage_score = min(100, coverage_score + 3)
    if plan.get("electrical_cover"):
        coverage_score = min(100, coverage_score + 3)
    if plan.get("all_risk_contents"):
        coverage_score = min(100, coverage_score + 4)

    # ── Risk Match ───────────────────────────────────────────────────────────
    plan_segment = plan.get("segment", "budget")
    ideal_risk = {"premium": 75, "standard": 50, "budget": 28}.get(plan_segment, 50)
    risk_diff = abs(overall_risk - ideal_risk)
    if risk_diff <= 10:
        risk_score = 94
    elif risk_diff <= 22:
        risk_score = 82
    elif risk_diff <= 38:
        risk_score = 66
    else:
        risk_score = 48

    # High flood + no flood cover → penalty
    if flood_risk >= 7 and not plan.get("flood_cover"):
        risk_score = max(0, risk_score - 20)
    # High quake + no quake cover → penalty
    if quake_risk >= 7 and not plan.get("earthquake_cover"):
        risk_score = max(0, risk_score - 15)
    # High theft + no theft cover → penalty
    if theft_risk_val >= 7 and not plan.get("theft_cover"):
        risk_score = max(0, risk_score - 12)

    # ── Suitability ──────────────────────────────────────────────────────────
    suitability = int(budget_score * 0.30 + coverage_score * 0.40 + risk_score * 0.30)

    overall_score = int(
        budget_score   * 0.25
        + coverage_score * 0.40
        + risk_score   * 0.20
        + suitability  * 0.15
    )

    return {
        "overall":        min(100, max(0, overall_score)),
        "suitability":    min(100, max(0, suitability)),
        "budget_match":   min(100, max(0, int(budget_score))),
        "coverage_match": min(100, max(0, int(coverage_score))),
        "risk_match":     min(100, max(0, int(risk_score))),
    }


# ── Plan quality text ─────────────────────────────────────────────────────────

def _build_plan_quality(
    plan: Dict[str, Any],
    all_plans: List[Dict[str, Any]],
    profile: Dict[str, Any],
    scores: Dict[str, int],
    rank: int,
    risk: Dict[str, Any],
) -> Dict[str, Any]:
    prop_cat    = classify_property(profile)
    property_age = _parse_age(profile.get("property_age"))
    location    = str(profile.get("location", "")).lower()
    flood_risk  = risk.get("flood_risk", 3)
    quake_risk  = risk.get("earthquake_risk", 3)
    theft_risk  = risk.get("theft_risk", 3)
    prefix      = {1: "Top pick", 2: "Strong alternative", 3: "Best value option"}.get(rank, "Option")

    # Why THIS plan
    reasons: List[str] = []
    if scores["budget_match"] >= 85:
        reasons.append("fits comfortably within your annual budget")
    plan_cov = plan["structure_coverage"] + plan["contents_coverage"]
    prop_val  = (_parse_inr(profile.get("property_value")) or 0) + (_parse_inr(profile.get("contents_value")) or 0)
    if plan_cov >= prop_val * 0.9:
        reasons.append("covers the full value of your property and contents")
    if flood_risk >= 6 and plan.get("flood_cover"):
        reasons.append(f"flood cover is critical given your location in {location or 'a flood-risk zone'}")
    if quake_risk >= 6 and plan.get("earthquake_cover"):
        reasons.append("earthquake cover matches the seismic risk in your area")
    if theft_risk >= 6 and plan.get("theft_cover"):
        reasons.append("strong theft protection for your location")
    if plan.get("temp_accommodation") and property_age > 15:
        reasons.append("temporary accommodation benefit is valuable given the property's age")
    if plan.get("all_risk_contents"):
        reasons.append("all-risk contents cover protects against accidental damage")
    if not reasons:
        reasons.append("well-balanced cover for your property type and risk profile")
    why_this = f"{prefix}: {', '.join(reasons[:3])}."

    # Why NOT others
    others = [p for p in all_plans if p["plan_name"] != plan["plan_name"]]
    why_not: List[str] = []
    for other in others[:2]:
        if plan["premium_max"] < other["premium_min"]:
            why_not.append(f"{other['plan_name']} costs more annually")
        elif plan["structure_coverage"] > other["structure_coverage"] * 1.2:
            why_not.append(f"{other['plan_name']} provides lower structure coverage")
        elif not other.get("flood_cover") and flood_risk >= 5:
            why_not.append(f"{other['plan_name']} lacks flood cover for your location")
        else:
            why_not.append(f"{other['plan_name']} is better suited to a different property profile")
    why_not_text = "; ".join(why_not) if why_not else "Other plans target different property values or risk levels."

    # Future benefits
    future: List[str] = []
    if plan.get("all_risk_contents"):
        future.append("all-risk cover becomes increasingly valuable as you add electronics and appliances")
    if plan.get("rental_income"):
        future.append("rental income protection gives you financial continuity if the property is uninhabitable")
    if plan.get("jewelry_cover"):
        future.append("jewelry and valuables cover can be extended as you schedule new items")
    if plan.get("electrical_cover"):
        future.append("electrical damage cover grows in importance as smart home devices increase")
    if not future:
        future.append("consistent protection helps you build a claim-free discount over time")
    future_text = ". ".join(future[:2])

    # Claim experience
    claim_ratio = plan.get("claim_ratio", "98%+")
    claim_process = plan.get("claim_process", "Standard process")
    claim_text = (
        f"{claim_ratio} claim settlement ratio. "
        f"{claim_process}. Our panel of 600+ empanelled engineers and surveyors "
        "ensure fast, fair assessment of any structural or contents damage."
    )

    return {
        "why_this_plan":  why_this,
        "why_not_others": why_not_text,
        "future_benefits": future_text,
        "claim_experience": claim_text,
        "advantages":     reasons[:3],
        "limitations":    plan.get("exclusions", [])[:3],
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
    scored: List[tuple] = []

    for key in plan_keys:
        plan   = PROPERTY_PLANS[key]
        scores = _score_plan(plan, profile, risk)
        scored.append((key, plan, scores))

    scored.sort(key=lambda x: x[2]["overall"], reverse=True)
    all_plan_dicts = [p for _, p, _ in scored]

    plans_out: List[Dict[str, Any]] = []
    for rank, (key, plan, scores) in enumerate(scored, start=1):
        premium_display = f"₹{plan['premium_min']:,}–₹{plan['premium_max']:,}/year"
        quality = _build_plan_quality(plan, all_plan_dicts, profile, scores, rank, risk)

        plans_out.append({
            "rank":               rank,
            "plan_id":            plan["plan_id"],
            "plan_name":          plan["plan_name"],
            "segment":            plan["segment"].capitalize(),
            "coverage":           plan["coverage_display"],
            "premium":            premium_display,
            "premium_annual":     (plan["premium_min"] + plan["premium_max"]) // 2,
            "structure_coverage": plan["structure_display"],
            "contents_coverage":  plan["contents_display"],
            "fire_cover":         plan.get("fire_cover", False),
            "fire_detail":        plan.get("fire_detail", ""),
            "flood_cover":        plan.get("flood_cover", False),
            "flood_detail":       plan.get("flood_detail", ""),
            "earthquake_cover":   plan.get("earthquake_cover", False),
            "earthquake_detail":  plan.get("earthquake_detail", ""),
            "storm_cover":        plan.get("storm_cover", False),
            "storm_detail":       plan.get("storm_detail", ""),
            "theft_cover":        plan.get("theft_cover", False),
            "theft_sublimit":     plan.get("theft_sublimit", ""),
            "temp_accommodation": plan.get("temp_accommodation", False),
            "temp_accommodation_detail": plan.get("temp_accommodation_detail", ""),
            "electrical_cover":   plan.get("electrical_cover", False),
            "electrical_detail":  plan.get("electrical_detail", ""),
            "glass_cover":        plan.get("glass_cover", False),
            "public_liability":   plan.get("public_liability", False),
            "public_liability_detail": plan.get("public_liability_detail", ""),
            "rental_income":      plan.get("rental_income", False),
            "rental_income_detail": plan.get("rental_income_detail", ""),
            "jewelry_cover":      plan.get("jewelry_cover", False),
            "jewelry_detail":     plan.get("jewelry_detail", ""),
            "all_risk_contents":  plan.get("all_risk_contents", False),
            "accidental_damage":  plan.get("accidental_damage", False),
            "worldwide_contents": plan.get("worldwide_contents", False),
            "smart_home_cover":   plan.get("smart_home_cover", False),
            "legal_expenses":     plan.get("legal_expenses", False),
            "cyber_cover":        plan.get("cyber_cover", False),
            "outbuildings":       plan.get("outbuildings", False),
            "claim_process":      plan.get("claim_process", ""),
            "claim_ratio":        plan.get("claim_ratio", ""),
            "eligibility":        plan.get("eligibility", ""),
            "benefits":           plan.get("benefits", []),
            "exclusions":         plan.get("exclusions", []),
            "suitable_for":       plan.get("suitable_for", []),
            "scores":             scores,
            # Quality fields
            "why_this_plan":     quality["why_this_plan"],
            "why_not_others":    quality["why_not_others"],
            "future_benefits":   quality["future_benefits"],
            "claim_experience":  quality["claim_experience"],
            "advantages":        quality["advantages"],
            "limitations":       quality["limitations"],
        })

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
        "type":         "multi_plan",
        "category":     "property",
        "segment":      segment.capitalize(),
        "property_cat": classify_property(profile),
        "risk_summary": risk,
        "plans":        plans_out,
        "total_plans":  len(plans_out),
        "recommended":  plans_out[0]["plan_name"] if plans_out else "",
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
        "type":         "single_plan",
        "category":     "property",
        "segment":      segment.capitalize(),
        "property_cat": classify_property(profile),
        "risk_summary": risk,
        "plans":        [best],
        "total_plans":  1,
        "recommended":  best["plan_name"],
        "reason_codes": _reason_codes(
            _PLAN_BY_ID[best["plan_id"]], profile, best["scores"]
        ),
        # There are others, and the customer is told so — but they are
        # not sent until asked for.
        "alternatives_available": len(remaining) > 1,
        "considered_count":       len(ranked),
    }
