"""
Aegis AI — Travel Insurance Recommendation Engine
Trip profiling, 8-dimension risk analysis, plan scoring, and Top-3 selection for Ethan AI.
"""

from __future__ import annotations
from typing import Any, Dict, List, Optional
import re

from .travel_plans import TRAVEL_PLANS, PLANS_BY_SEGMENT, SEGMENT_THRESHOLDS, TRAVEL_TYPE_KEYWORDS


# ── Parsers ───────────────────────────────────────────────────────────────────

def _parse_budget(raw: Any) -> Optional[int]:
    """Parse per-trip insurance budget per person in INR."""
    if raw is None:
        return None
    text = str(raw).lower().replace(",", "").replace(" ", "")
    lakh = re.search(r"(\d+\.?\d*)\s*l(?:akh)?", text)
    if lakh:
        return int(float(lakh.group(1)) * 100_000)
    digits = re.findall(r"\d+", text)
    if not digits:
        return None
    return int(digits[0])


def _parse_trip_cost(raw: Any) -> Optional[int]:
    """Parse total trip cost in INR."""
    if raw is None:
        return None
    text = str(raw).lower().replace(",", "").replace("₹", "").replace(" ", "")
    crore = re.search(r"(\d+\.?\d*)\s*cr(?:ore)?", text)
    if crore:
        return int(float(crore.group(1)) * 10_000_000)
    lakh = re.search(r"(\d+\.?\d*)\s*l(?:akh)?", text)
    if lakh:
        return int(float(lakh.group(1)) * 100_000)
    digits = re.findall(r"\d+", text)
    if not digits:
        return None
    val = int(digits[0])
    # If small number and contains 'k', multiply
    if "k" in text:
        val *= 1_000
    return val


def _parse_travellers(raw: Any) -> int:
    """Extract number of travellers from text."""
    if raw is None:
        return 1
    digits = re.findall(r"\d+", str(raw))
    if digits:
        return max(1, int(digits[0]))
    text = str(raw).lower()
    if "couple" in text or "two" in text:
        return 2
    if "solo" in text or "alone" in text or "myself" in text or "just me" in text:
        return 1
    return 1


def _max_age_from_text(raw: Any) -> int:
    """Find the maximum age among all travellers from free text."""
    if raw is None:
        return 30
    digits = re.findall(r"\b(\d{1,3})\b", str(raw))
    ages = [int(d) for d in digits if 1 <= int(d) <= 110]
    return max(ages) if ages else 30


def _has_senior(raw: Any) -> bool:
    """Return True if any traveller is 60 or older."""
    return _max_age_from_text(raw) >= 60


def _has_child(raw: Any) -> bool:
    """Return True if any traveller appears to be a child."""
    text = str(raw).lower()
    if any(w in text for w in ["child", "kid", "son", "daughter", "infant", "baby", "toddler"]):
        return True
    digits = re.findall(r"\b(\d{1,2})\b", str(raw))
    ages = [int(d) for d in digits if 1 <= int(d) <= 17]
    return bool(ages)


def _has_medical_conditions(raw: Any) -> bool:
    """Return True if traveller has pre-existing conditions."""
    if raw is None:
        return False
    text = str(raw).lower()
    if any(w in text for w in ["no", "none", "nil", "healthy", "fit", "good health"]):
        return False
    if any(w in text for w in ["yes", "diabetes", "hypertension", "heart", "bp", "pressure",
                                 "asthma", "thyroid", "cancer", "surgery", "condition",
                                 "medication", "medicines", "chronic", "blood pressure"]):
        return True
    return False


def _has_adventure(raw: Any, profile: Dict[str, Any] = None) -> bool:
    """Return True if trip involves adventure activities."""
    texts = [str(raw or "")]
    if profile:
        texts.append(str(profile.get("purpose", "")))
        texts.append(str(profile.get("destination", "")))
    combined = " ".join(texts).lower()
    adventure_words = ["trek", "trekking", "hike", "hiking", "ski", "skiing", "dive", "diving",
                       "scuba", "bungee", "paragliding", "climb", "climbing", "mountaineer",
                       "surfing", "rafting", "safari", "zipline", "adventure"]
    return any(w in combined for w in adventure_words)


# ── Destination risk classification ───────────────────────────────────────────

_HIGH_RISK_DEST = [
    "afghanistan", "iraq", "syria", "libya", "yemen", "sudan", "somalia",
    "south sudan", "venezuela", "haiti", "myanmar", "mali", "niger",
    "burkina faso", "central african republic", "congo", "drc",
    "north korea", "eritrea",
]
_MODERATE_HIGH_DEST = [
    "egypt", "turkey", "morocco", "jordan", "brazil", "mexico", "colombia",
    "peru", "kenya", "tanzania", "zimbabwe", "ghana", "nigeria", "south africa",
    "indonesia", "philippines", "vietnam", "cambodia", "thailand", "bangladesh",
    "pakistan", "sri lanka", "nepal", "china", "russia", "ukraine", "belarus",
    "ethiopia", "senegal", "mozambique",
]
_LOW_RISK_DEST = [
    "usa", "uk", "europe", "schengen", "france", "germany", "italy", "spain",
    "japan", "australia", "new zealand", "singapore", "uae", "dubai", "canada",
    "switzerland", "austria", "netherlands", "sweden", "norway", "denmark",
    "finland", "ireland", "portugal", "greece", "czech", "hungary", "poland",
    "south korea", "taiwan", "hong kong", "israel", "bahrain", "qatar",
]
_ADVENTURE_DEST = [
    "nepal", "ladakh", "leh", "himalayas", "uttarakhand", "manali",
    "swiss alps", "alps", "iceland", "new zealand", "patagonia",
    "kilimanjaro", "tibet", "peru", "bolivia", "alaska", "greenland",
]


def _destination_risk(destination: str) -> float:
    dest = destination.lower()
    if any(d in dest for d in _HIGH_RISK_DEST):
        return 9.0
    if any(d in dest for d in _MODERATE_HIGH_DEST):
        return 6.0
    if any(d in dest for d in _LOW_RISK_DEST):
        return 2.5
    if any(d in dest for d in _ADVENTURE_DEST):
        return 5.5
    # Unknown destination — moderate default
    return 4.5


def _is_international(destination: str, purpose: str) -> bool:
    combined = (destination + " " + purpose).lower()
    if any(w in combined for w in ["domestic", "within india", "india trip", "indian"]):
        # check if any foreign country mentioned
        for d in _LOW_RISK_DEST + _MODERATE_HIGH_DEST + _HIGH_RISK_DEST:
            if d in combined and d not in ["usa", "uk"]:  # avoid false positives
                return True
        return False
    for d in _LOW_RISK_DEST + _MODERATE_HIGH_DEST + _HIGH_RISK_DEST:
        if d in combined:
            return True
    if any(w in combined for w in ["international", "abroad", "overseas", "foreign", "europe",
                                    "schengen", "visa", "passport"]):
        return True
    return False  # default to domestic if unclear


def _needs_schengen(destination: str, visa_req: str) -> bool:
    combined = (destination + " " + (visa_req or "")).lower()
    return any(w in combined for w in ["schengen", "europe", "france", "germany", "italy",
                                        "spain", "netherlands", "austria", "switzerland",
                                        "belgium", "denmark", "finland", "greece", "sweden",
                                        "norway", "portugal", "czech"])


# ── Travel type classification ─────────────────────────────────────────────────

def classify_travel_type(profile: Dict[str, Any]) -> str:
    purpose    = str(profile.get("purpose", "")).lower()
    dest       = str(profile.get("destination", "")).lower()
    ages_raw   = str(profile.get("traveller_ages", ""))
    num_raw    = str(profile.get("num_travellers", "1")).lower()

    if any(w in purpose for w in TRAVEL_TYPE_KEYWORDS["adventure"]) or \
       any(w in dest for w in TRAVEL_TYPE_KEYWORDS["adventure"]):
        return "adventure"
    if any(w in purpose for w in TRAVEL_TYPE_KEYWORDS["student"]):
        return "student"
    if any(w in purpose for w in TRAVEL_TYPE_KEYWORDS["business"]):
        return "business"
    if any(w in purpose for w in TRAVEL_TYPE_KEYWORDS["pilgrimage"]) or \
       any(w in dest for w in TRAVEL_TYPE_KEYWORDS["pilgrimage"]):
        return "pilgrimage"
    if any(w in purpose for w in TRAVEL_TYPE_KEYWORDS["frequent"]):
        return "frequent"
    if _has_senior(ages_raw):
        return "senior"
    if any(w in num_raw for w in ["family", "spouse", "wife", "husband", "kids", "children"]) or \
       any(w in purpose for w in TRAVEL_TYPE_KEYWORDS["family"]) or \
       _has_child(ages_raw):
        return "family"
    if any(w in num_raw for w in ["group", "team", "friends"]) or \
       any(w in purpose for w in TRAVEL_TYPE_KEYWORDS["group"]):
        return "group"
    if any(w in dest for w in TRAVEL_TYPE_KEYWORDS["domestic"]) and \
       not _is_international(dest, purpose):
        return "domestic"
    return "international"


# ── Segment classification ─────────────────────────────────────────────────────

def classify_segment(profile: Dict[str, Any]) -> str:
    budget = _parse_budget(profile.get("budget"))
    if budget is None:
        # Infer from travel type and destination
        travel_type = classify_travel_type(profile)
        dest = str(profile.get("destination", "")).lower()
        is_intl = _is_international(dest, str(profile.get("purpose", "")))
        has_senior = _has_senior(str(profile.get("traveller_ages", "")))
        has_adv = _has_adventure(str(profile.get("purpose", "")), profile)
        if travel_type in ["adventure", "senior", "frequent"] or has_senior or has_adv:
            budget = 6_500  # infer premium
        elif is_intl:
            budget = 2_500  # infer standard
        else:
            budget = 800    # infer budget (domestic)

    for segment, (lo, hi) in SEGMENT_THRESHOLDS.items():
        if lo <= budget < hi:
            return segment
    return "standard"


# ── Risk analysis ──────────────────────────────────────────────────────────────

def analyse_risk(profile: Dict[str, Any]) -> Dict[str, Any]:
    """8-dimension travel risk analysis."""
    destination     = str(profile.get("destination", "")).lower()
    purpose         = str(profile.get("purpose", "leisure")).lower()
    traveller_ages  = str(profile.get("traveller_ages", "30"))
    medical_cond    = str(profile.get("medical_conditions", "none")).lower()
    trip_cost_raw   = profile.get("trip_cost")
    trip_duration   = str(profile.get("travel_dates", "")).lower()
    num_travellers  = _parse_travellers(profile.get("num_travellers", 1))
    visa_req        = str(profile.get("visa_requirement", "")).lower()

    max_age     = _max_age_from_text(traveller_ages)
    is_senior   = max_age >= 60
    is_child    = _has_child(traveller_ages)
    has_ped     = _has_medical_conditions(medical_cond)
    is_intl     = _is_international(destination, purpose)
    trip_cost   = _parse_trip_cost(trip_cost_raw) or 50_000

    # Detect long-haul (USA, UK, Australia, Europe tend to be longer)
    is_longhaul = any(d in destination for d in ["usa", "uk", "australia", "canada",
                                                   "new zealand", "europe", "schengen"])

    # 1. Medical Risk
    medical_risk = 3.0
    if is_senior:
        medical_risk = min(10, medical_risk + (max_age - 60) * 0.18)
    if has_ped:
        medical_risk = min(10, medical_risk + 3.0)
    if _has_adventure(purpose, profile):
        medical_risk = min(10, medical_risk + 1.5)
    if is_intl:
        medical_risk = min(10, medical_risk + 1.0)

    # 2. Destination Risk
    dest_risk = _destination_risk(destination)

    # 3. Flight Delay Risk
    delay_risk = 3.0
    if is_intl and is_longhaul:
        delay_risk = min(10, delay_risk + 3.5)
    elif is_intl:
        delay_risk = min(10, delay_risk + 2.0)
    if any(w in destination for w in ["india", "domestic"]):
        delay_risk = 2.5
    # Adverse weather destinations
    if any(w in destination for w in ["nepal", "himalayas", "ladakh", "alaska", "iceland"]):
        delay_risk = min(10, delay_risk + 2.0)

    # 4. Trip Cancellation Risk
    cancel_risk = 2.5
    if trip_cost >= 500_000:    # > ₹5L trip
        cancel_risk = min(10, cancel_risk + 4.0)
    elif trip_cost >= 200_000:  # > ₹2L trip
        cancel_risk = min(10, cancel_risk + 2.5)
    elif trip_cost >= 100_000:
        cancel_risk = min(10, cancel_risk + 1.5)
    if has_ped:
        cancel_risk = min(10, cancel_risk + 1.5)
    if is_senior:
        cancel_risk = min(10, cancel_risk + 1.5)
    if "business" in purpose:
        cancel_risk = min(10, cancel_risk + 1.0)

    # 5. Lost Baggage Risk
    baggage_risk = 3.0
    if is_intl:
        baggage_risk = min(10, baggage_risk + 2.0)
    if is_longhaul:
        baggage_risk = min(10, baggage_risk + 1.5)
    if num_travellers >= 4:
        baggage_risk = min(10, baggage_risk + 1.0)
    if any(w in purpose for w in ["business", "laptop", "equipment"]):
        baggage_risk = min(10, baggage_risk + 1.5)

    # 6. Passport / Document Risk
    passport_risk = 2.5
    if dest_risk >= 7.0:
        passport_risk = min(10, passport_risk + 3.5)
    elif dest_risk >= 5.0:
        passport_risk = min(10, passport_risk + 2.0)
    if num_travellers >= 4:
        passport_risk = min(10, passport_risk + 1.0)

    # 7. Emergency Evacuation Risk
    evac_risk = 2.5
    if any(d in destination for d in _ADVENTURE_DEST):
        evac_risk = min(10, evac_risk + 4.0)
    if dest_risk >= 7.0:
        evac_risk = min(10, evac_risk + 3.5)
    elif dest_risk >= 5.0:
        evac_risk = min(10, evac_risk + 2.0)
    if is_senior:
        evac_risk = min(10, evac_risk + 1.5)
    if has_ped:
        evac_risk = min(10, evac_risk + 1.0)

    # 8. Adventure Risk
    adventure_risk = 1.5
    if _has_adventure(purpose, profile):
        adventure_risk = min(10, adventure_risk + 5.0)
    if any(d in destination for d in _ADVENTURE_DEST):
        adventure_risk = min(10, adventure_risk + 3.0)
    if any(w in purpose for w in ["mountaineering", "climbing", "extreme", "skydiving"]):
        adventure_risk = min(10, adventure_risk + 2.0)

    overall = int(
        medical_risk  * 0.22
        + dest_risk   * 0.15
        + delay_risk  * 0.10
        + cancel_risk * 0.15
        + baggage_risk* 0.10
        + passport_risk * 0.08
        + evac_risk   * 0.12
        + adventure_risk * 0.08
    ) * 10

    return {
        "medical_risk":           round(medical_risk, 1),
        "destination_risk":       round(dest_risk, 1),
        "flight_delay_risk":      round(delay_risk, 1),
        "trip_cancellation_risk": round(cancel_risk, 1),
        "lost_baggage_risk":      round(baggage_risk, 1),
        "passport_risk":          round(passport_risk, 1),
        "evacuation_risk":        round(evac_risk, 1),
        "adventure_risk":         round(adventure_risk, 1),
        "overall_risk_score":     min(100, max(0, overall)),
        # Derived flags for scoring
        "_is_international":  is_intl,
        "_has_senior":        is_senior,
        "_has_ped":           has_ped,
        "_has_adventure":     _has_adventure(purpose, profile),
        "_needs_schengen":    _needs_schengen(destination, str(profile.get("visa_requirement", ""))),
        "_trip_cost":         trip_cost,
        "_max_age":           max_age,
    }


# ── Plan scoring ──────────────────────────────────────────────────────────────

def _score_plan(
    plan: Dict[str, Any],
    profile: Dict[str, Any],
    risk: Dict[str, Any],
) -> Dict[str, int]:
    budget_per_person = _parse_budget(profile.get("budget")) or 2_000
    overall_risk      = risk.get("overall_risk_score", 50)
    medical_risk      = risk.get("medical_risk", 3)
    cancel_risk       = risk.get("trip_cancellation_risk", 3)
    evac_risk         = risk.get("evacuation_risk", 3)
    adv_risk          = risk.get("adventure_risk", 1.5)
    trip_cost         = risk.get("_trip_cost", 50_000)
    has_senior        = risk.get("_has_senior", False)
    has_ped           = risk.get("_has_ped", False)
    has_adventure     = risk.get("_has_adventure", False)
    needs_schengen    = risk.get("_needs_schengen", False)
    is_international  = risk.get("_is_international", True)

    # ── Budget Match ─────────────────────────────────────────────────────────
    plan_avg = (plan["premium_min"] + plan["premium_max"]) / 2
    diff_ratio = abs(plan_avg - budget_per_person) / max(budget_per_person, 1)
    if diff_ratio <= 0.12:
        budget_score = 97
    elif diff_ratio <= 0.28:
        budget_score = 87
    elif diff_ratio <= 0.55:
        budget_score = 73
    elif plan_avg < budget_per_person:
        budget_score = 82
    else:
        budget_score = max(18, int(68 - diff_ratio * 28))

    # ── Coverage Match ───────────────────────────────────────────────────────
    medical_amount = plan.get("medical_cover_amount", 0)
    cancel_amount  = plan.get("trip_cancellation_amount", 0)
    evac_amount    = plan.get("emergency_evac_amount", 0)

    # Medical adequacy
    if medical_amount >= 50_000_000:    # ₹5Cr+
        med_score = 100
    elif medical_amount >= 15_000_000:  # ₹1.5Cr+
        med_score = 92
    elif medical_amount >= 7_500_000:   # ₹75L+
        med_score = 84
    elif medical_amount >= 3_000_000:   # ₹30L+
        med_score = 74
    elif medical_amount >= 1_500_000:   # ₹15L+
        med_score = 62
    else:
        med_score = 45

    # Cancellation adequacy vs trip cost
    if cancel_amount >= trip_cost:
        cancel_score = 98
    elif cancel_amount >= trip_cost * 0.70:
        cancel_score = 87
    elif cancel_amount >= trip_cost * 0.40:
        cancel_score = 73
    else:
        cancel_score = 55

    coverage_score = int(med_score * 0.55 + cancel_score * 0.30 + 15)  # 15 base for evacuation

    # Specific coverage bonuses
    if needs_schengen and plan.get("schengen_compliant"):
        coverage_score = min(100, coverage_score + 10)
    elif needs_schengen and not plan.get("schengen_compliant"):
        coverage_score = max(0, coverage_score - 20)

    if has_adventure and plan.get("adventure_cover"):
        coverage_score = min(100, coverage_score + 8)
    elif has_adventure and not plan.get("adventure_cover"):
        coverage_score = max(0, coverage_score - 18)

    if has_ped and plan.get("pre_existing_cover"):
        coverage_score = min(100, coverage_score + 8)
    elif has_ped and not plan.get("pre_existing_cover"):
        coverage_score = max(0, coverage_score - 15)

    if plan.get("annual_multi_trip") and "frequent" in str(profile.get("purpose", "")):
        coverage_score = min(100, coverage_score + 6)

    # ── Risk Match ───────────────────────────────────────────────────────────
    plan_segment = plan.get("segment", "budget")
    ideal_risk = {"premium": 72, "standard": 48, "budget": 26}.get(plan_segment, 48)
    risk_diff  = abs(overall_risk - ideal_risk)
    if risk_diff <= 10:
        risk_score = 94
    elif risk_diff <= 22:
        risk_score = 82
    elif risk_diff <= 38:
        risk_score = 66
    else:
        risk_score = 48

    # High medical risk (senior/PED) + low medical cover → penalty
    if (has_senior or has_ped) and medical_amount < 7_500_000:
        risk_score = max(0, risk_score - 18)
    # High adventure risk + no adventure cover → penalty
    if adv_risk >= 6 and not plan.get("adventure_cover"):
        risk_score = max(0, risk_score - 20)
    # High evac risk + low evac cover
    if evac_risk >= 7 and evac_amount < 20_000_000:
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
    dest         = str(profile.get("destination", "your destination"))
    has_senior   = risk.get("_has_senior", False)
    has_ped      = risk.get("_has_ped", False)
    has_adv      = risk.get("_has_adventure", False)
    needs_sch    = risk.get("_needs_schengen", False)
    trip_cost    = risk.get("_trip_cost", 50_000)
    prefix       = {1: "Top pick", 2: "Strong alternative", 3: "Best value option"}.get(rank, "Option")

    # Why THIS plan
    reasons: List[str] = []
    if scores["budget_match"] >= 85:
        reasons.append("fits your insurance budget comfortably")
    if plan.get("medical_cover_amount", 0) >= 7_500_000:
        reasons.append(f"₹{plan['medical_cover']} medical cover is strong for {dest}")
    if needs_sch and plan.get("schengen_compliant"):
        reasons.append("Schengen-compliant for your European visa")
    if has_adv and plan.get("adventure_cover"):
        adv_list = plan.get("adventure_types", [])
        reasons.append(f"adventure cover includes {', '.join(adv_list[:2]) if adv_list else 'your planned activities'}")
    if has_ped and plan.get("pre_existing_cover"):
        reasons.append("pre-existing condition coverage protects against related emergencies abroad")
    if has_senior and plan.get("medical_cover_amount", 0) >= 7_500_000:
        reasons.append("high medical cover is especially important for senior travellers")
    cancel_ok = plan.get("trip_cancellation_amount", 0) >= trip_cost * 0.5
    if cancel_ok:
        reasons.append(f"trip cancellation cover ({plan['trip_cancellation']}) matches your trip investment")
    if not reasons:
        reasons.append("well-matched to your trip profile and risk level")
    why_this = f"{prefix}: {', '.join(reasons[:3])}."

    # Why NOT others
    others   = [p for p in all_plans if p["plan_name"] != plan["plan_name"]]
    why_not: List[str] = []
    for other in others[:2]:
        if plan["premium_max"] < other["premium_min"]:
            why_not.append(f"{other['plan_name']} is significantly more expensive per trip")
        elif plan.get("medical_cover_amount", 0) > other.get("medical_cover_amount", 0) * 1.5:
            why_not.append(f"{other['plan_name']} offers lower medical cover")
        elif not other.get("schengen_compliant") and needs_sch:
            why_not.append(f"{other['plan_name']} is not Schengen-compliant for your visa")
        elif not other.get("adventure_cover") and has_adv:
            why_not.append(f"{other['plan_name']} doesn't cover your adventure activities")
        else:
            why_not.append(f"{other['plan_name']} targets a different traveller profile")
    why_not_text = "; ".join(why_not) if why_not else "Other plans serve different trip types or risk levels."

    # Future benefits
    future: List[str] = []
    if plan.get("annual_multi_trip"):
        future.append("the annual multi-trip option saves significantly if you travel more than 3 times a year")
    if plan.get("pre_existing_cover") and has_ped:
        future.append("pre-existing condition cover means you can travel without worrying about past health issues")
    if plan.get("concierge"):
        future.append("concierge access is most valuable in an emergency — they handle rebooking, hotels, and hospitals")
    if not future:
        future.append("a clean claims record may qualify you for repeat traveller loyalty rates at renewal")
    future_text = ". ".join(future[:2])

    # Claim experience
    claim_ratio   = plan.get("claim_ratio", "98%+")
    claim_process = plan.get("claim_process", "Digital submission")
    global_asst   = plan.get("global_assistance", "24/7 helpline")
    claim_text = (
        f"{claim_ratio} claim settlement ratio. "
        f"{claim_process}. "
        f"Emergency support: {global_asst}."
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

def get_top3_recommendations(
    profile: Dict[str, Any],
    risk: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    segment = classify_segment(profile)
    if risk is None:
        risk = analyse_risk(profile)

    plan_keys = PLANS_BY_SEGMENT.get(segment, PLANS_BY_SEGMENT["standard"])
    scored: List[tuple] = []

    for key in plan_keys:
        plan   = TRAVEL_PLANS[key]
        scores = _score_plan(plan, profile, risk)
        scored.append((key, plan, scores))

    scored.sort(key=lambda x: x[2]["overall"], reverse=True)
    all_plan_dicts = [p for _, p, _ in scored]

    plans_out: List[Dict[str, Any]] = []
    for rank, (key, plan, scores) in enumerate(scored, start=1):
        quality = _build_plan_quality(plan, all_plan_dicts, profile, scores, rank, risk)

        plans_out.append({
            "rank":                rank,
            "plan_id":             plan["plan_id"],
            "plan_name":           plan["plan_name"],
            "segment":             plan["segment"].capitalize(),
            "travel_scope":        plan.get("travel_scope", ""),
            "coverage":            plan["medical_cover"],
            "premium":             f"₹{plan['premium_min']:,}–₹{plan['premium_max']:,}/person/trip",
            "premium_annual":      (plan["premium_min"] + plan["premium_max"]) // 2,
            # Medical
            "medical_cover":       plan["medical_cover"],
            "medical_cover_usd":   plan.get("medical_cover_usd", ""),
            # Evacuation
            "emergency_evacuation": plan.get("emergency_evacuation", ""),
            # Cancellation
            "trip_cancellation":   plan.get("trip_cancellation", ""),
            # Delay
            "trip_delay":          plan.get("trip_delay", ""),
            "trip_delay_threshold": plan.get("trip_delay_threshold", ""),
            # Baggage
            "lost_baggage":        plan.get("lost_baggage", ""),
            "baggage_delay":       plan.get("baggage_delay", ""),
            # Passport
            "passport_loss":       plan.get("passport_loss", ""),
            # Liability
            "personal_liability":  plan.get("personal_liability", ""),
            # Adventure
            "adventure_cover":     plan.get("adventure_cover", False),
            "adventure_detail":    plan.get("adventure_detail", ""),
            "adventure_types":     plan.get("adventure_types", []),
            # Pre-existing
            "pre_existing_cover":  plan.get("pre_existing_cover", False),
            "pre_existing_detail": plan.get("pre_existing_detail", ""),
            # Extras
            "flight_hijack":       plan.get("flight_hijack", False),
            "flight_hijack_detail": plan.get("flight_hijack_detail", ""),
            "kidnap_cover":        plan.get("kidnap_cover", False),
            "kidnap_detail":       plan.get("kidnap_detail", ""),
            "annual_multi_trip":   plan.get("annual_multi_trip", False),
            "annual_detail":       plan.get("annual_detail", ""),
            "schengen_compliant":  plan.get("schengen_compliant", False),
            "schengen_note":       plan.get("schengen_note", ""),
            "home_care":           plan.get("home_care", False),
            "home_care_detail":    plan.get("home_care_detail", ""),
            "business_equipment":  plan.get("business_equipment", False),
            "business_equipment_detail": plan.get("business_equipment_detail", ""),
            "concierge":           plan.get("concierge", False),
            "concierge_detail":    plan.get("concierge_detail", ""),
            "global_assistance":   plan.get("global_assistance", ""),
            # Quality
            "claim_process":       plan.get("claim_process", ""),
            "claim_ratio":         plan.get("claim_ratio", ""),
            "eligibility":         plan.get("eligibility", ""),
            "benefits":            plan.get("benefits", []),
            "exclusions":          plan.get("exclusions", []),
            "suitable_for":        plan.get("suitable_for", []),
            "scores":              scores,
            # Recommendation quality fields
            "why_this_plan":      quality["why_this_plan"],
            "why_not_others":     quality["why_not_others"],
            "future_benefits":    quality["future_benefits"],
            "claim_experience":   quality["claim_experience"],
            "advantages":         quality["advantages"],
            "limitations":        quality["limitations"],
        })

    return {
        "type":          "multi_plan",
        "category":      "travel",
        "segment":       segment.capitalize(),
        "travel_type":   classify_travel_type(profile),
        "destination":   profile.get("destination", ""),
        "risk_summary":  {k: v for k, v in risk.items() if not k.startswith("_")},
        "plans":         plans_out,
        "total_plans":   len(plans_out),
        "recommended":   plans_out[0]["plan_name"] if plans_out else "",
    }
