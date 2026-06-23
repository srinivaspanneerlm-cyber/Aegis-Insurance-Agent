import os
import json
from pathlib import Path
from typing import Dict, Any, List, Optional

class AegisDecisionEngine:
    """
    🛡️ Aegis AI Layer 4 — Recommendation & Decision Intelligence Engine
    Consumes customer profile facts (Layer 3), active plan assets (Layer 1),
    and routing indicators (Layer 2) to perform:
    - Pre-qualification matching (Eligible, Conditionally Eligible, Not Eligible)
    - Underwriting risk profiling (Low, Medium, High, Critical)
    - Dynamic multi-factor scoring (Budget, Coverage, Risk, Claim, Preference)
    - Slot-based allocations (Best, Alternative, Budget, Premium)
    - Explainable AI (XAI) justifications for selections and rejections
    """
    def __init__(self, base_dir: Optional[str] = None):
        if base_dir:
            self.base_dir = Path(base_dir).resolve()
        else:
            self.base_dir = Path(__file__).resolve().parent

        # Folders Configuration
        self.scoring_dir = self.base_dir / "scoring_engine"
        self.matcher_dir = self.base_dir / "policy_matcher"
        self.risk_dir = self.base_dir / "risk_engine"
        self.comparison_dir = self.base_dir / "comparison_engine"
        self.rec_dir = self.base_dir / "recommendation_engine"
        self.output_dir = self.base_dir / "recommendation_output"

        # Load configurations
        self.scoring_rules = self._load_json(self.scoring_dir / "scoring_rules.json")
        self.weights = self._load_json(self.scoring_dir / "weight_configuration.json").get("weights", {})
        self.thresholds = self._load_json(self.scoring_dir / "scoring_thresholds.json").get("thresholds", {})
        self.eligibility_rules = self._load_json(self.matcher_dir / "eligibility_matcher.json").get("eligibility_rules", {})
        self.budget_rules = self._load_json(self.matcher_dir / "budget_matcher.json").get("budget_matching_rules", {})
        self.coverage_rules = self._load_json(self.matcher_dir / "coverage_matcher.json").get("coverage_rules", {})
        self.profile_rules = self._load_json(self.matcher_dir / "profile_matcher.json").get("profile_matching_rules", {})
        self.risk_scoring_rules = self._load_json(self.risk_dir / "risk_scoring_rules.json").get("scoring_rules", {})
        self.risk_categories = self._load_json(self.risk_dir / "risk_categories.json").get("risk_categories", {})
        self.risk_thresholds = self._load_json(self.risk_dir / "risk_thresholds.json").get("thresholds", {})
        self.ranking_rules = self._load_json(self.comparison_dir / "ranking_rules.json").get("ranking_rules", {})
        self.justifications = self._load_json(self.output_dir / "justification_templates.json").get("templates", {})

        # Standard Aegis Insurance Products catalog
        self.products_catalog = [
            # Health Subcategory
            {
                "id": "health_supreme",
                "plan_name": "Aegis Supreme Health Shield",
                "category": "health",
                "premium_monthly": 3000,
                "coverage_limit": 1500000,
                "waiting_period_months": 12,
                "style": "elite",
                "claim_support_ratio": 99.1,
                "benefits": ["Global Coverage", "Private Suite Option", "Zero Co-pay"]
            },
            {
                "id": "health_silver",
                "plan_name": "Aegis Care Silver Floater",
                "category": "health",
                "premium_monthly": 1800,
                "coverage_limit": 800000,
                "waiting_period_months": 24,
                "style": "comprehensive",
                "claim_support_ratio": 98.4,
                "benefits": ["Day Care Procedures", "Cashless Hospitalization", "Restore Benefit"]
            },
            {
                "id": "health_essential",
                "plan_name": "Aegis Essential Health Cover",
                "category": "health",
                "premium_monthly": 900,
                "coverage_limit": 300000,
                "waiting_period_months": 36,
                "style": "essential",
                "claim_support_ratio": 97.2,
                "benefits": ["Basic Room Rent Cap", "15% Co-pay", "Alternative Treatments"]
            },
            # Motor Subcategory
            {
                "id": "motor_supreme",
                "plan_name": "Aegis Bumper-to-Bumper Shield",
                "category": "motor",
                "premium_monthly": 2500,
                "coverage_limit": 1000000,
                "waiting_period_months": 0,
                "style": "elite",
                "claim_support_ratio": 98.9,
                "benefits": ["Zero Depreciation", "Engine Protection", "Roadside Assistance"]
            },
            {
                "id": "motor_standard",
                "plan_name": "Aegis Value Drive Cover",
                "category": "motor",
                "premium_monthly": 1200,
                "coverage_limit": 500000,
                "waiting_period_months": 0,
                "style": "comprehensive",
                "claim_support_ratio": 98.4,
                "benefits": ["Standard OD Cover", "Third Party Shield", "Cashless Garages"]
            },
            {
                "id": "motor_basic",
                "plan_name": "Aegis Third Party Basic",
                "category": "motor",
                "premium_monthly": 400,
                "coverage_limit": 150000,
                "waiting_period_months": 0,
                "style": "essential",
                "claim_support_ratio": 96.5,
                "benefits": ["Mandatory TP Cover", "Legal Liability Protections"]
            },
            # Travel Subcategory
            {
                "id": "travel_elite",
                "plan_name": "Aegis GlobeTrotter Elite",
                "category": "travel",
                "premium_monthly": 1500,
                "coverage_limit": 3500000,
                "waiting_period_months": 0,
                "style": "elite",
                "claim_support_ratio": 98.8,
                "benefits": ["Global Med-Evac", "Baggage Loss Shield", "Flight Delay Waiver"]
            },
            {
                "id": "travel_standard",
                "plan_name": "Aegis Standard Voyage Guard",
                "category": "travel",
                "premium_monthly": 700,
                "coverage_limit": 1000000,
                "waiting_period_months": 0,
                "style": "comprehensive",
                "claim_support_ratio": 98.4,
                "benefits": ["Emergency Medical Cap", "Trip Interruption Safeguard"]
            },
            # Home Subcategory
            {
                "id": "home_platinum",
                "plan_name": "Aegis SafeHaven Platinum",
                "category": "home-property",
                "premium_monthly": 4000,
                "coverage_limit": 5000000,
                "waiting_period_months": 0,
                "style": "elite",
                "claim_support_ratio": 99.2,
                "benefits": ["Earthquake Protection", "Alternate Lodging", "Valuables Shield"]
            },
            {
                "id": "home_standard",
                "plan_name": "Aegis Brick-and-Mortar Shield",
                "category": "home-property",
                "premium_monthly": 2000,
                "coverage_limit": 2500000,
                "waiting_period_months": 0,
                "style": "comprehensive",
                "claim_support_ratio": 98.4,
                "benefits": ["Fire and Burglary Protection", "Structure Rebuilding Cover"]
            },
            # Miscellaneous Subcategory
            {
                "id": "misc_cyber",
                "plan_name": "Aegis Cyber Safe Premium",
                "category": "miscellaneous",
                "premium_monthly": 1000,
                "coverage_limit": 1000000,
                "waiting_period_months": 0,
                "style": "elite",
                "claim_support_ratio": 99.0,
                "benefits": ["Identity Theft Coverage", "Phishing Protection", "Ransomware Remediation"]
            },
            {
                "id": "misc_pet",
                "plan_name": "Aegis Happy Paws Care",
                "category": "miscellaneous",
                "premium_monthly": 500,
                "coverage_limit": 200000,
                "waiting_period_months": 0,
                "style": "comprehensive",
                "claim_support_ratio": 98.2,
                "benefits": ["Accident & Illness Cover", "Vet Consultation Reimbursement", "Third-Party Liability"]
            }
        ]

    def _load_json(self, file_path: Path) -> Dict[str, Any]:
        """Safely loads JSON configurations."""
        if file_path.exists():
            try:
                with open(file_path, "r", encoding="utf-8") as f:
                    return json.load(f)
            except Exception as e:
                print(f"Error loading {file_path.name}: {e}")
        return {}

    def calculate_customer_risk_profile(self, profile: Dict[str, Any]) -> Dict[str, Any]:
        """
        Calculates aggregate customer risk score and assigns a risk tier:
        Low Risk, Medium Risk, High Risk, Critical Risk.
        """
        score = 0
        age = profile.get("age")
        family_size = profile.get("family_size") or 1
        income = profile.get("annual_income") or 500000
        medical_risk = profile.get("medical_risk") or {}
        vehicle_risk = profile.get("vehicle_risk") or {}
        property_risk = profile.get("property_risk") or {}
        travel_risk = profile.get("travel_risk") or {}
        claims_risk = profile.get("claims_risk") or {}

        # Age points
        if age:
            if age >= 60:
                score += 30
            elif age >= 45:
                score += 15
            elif age < 30:
                score -= 5

        # Medical factors
        if medical_risk.get("pre_existing"):
            score += 35
        if medical_risk.get("tobacco"):
            score += 20

        # Vehicle factors
        if vehicle_risk.get("vehicle_age", 0) > 7:
            score += 20
        if vehicle_risk.get("accidents", 0) > 0:
            score += 15

        # Property factors
        if property_risk.get("property_age", 0) > 20:
            score += 15
        if property_risk.get("coastal"):
            score += 20

        # Travel factors
        if travel_risk.get("high_risk_destination"):
            score += 25
        if travel_risk.get("duration", 0) > 30:
            score += 15

        # Claims history
        if claims_risk.get("prior_claims", 0) > 1:
            score += 20
        if claims_risk.get("recent_claim"):
            score += 15

        # Bound score between 0 and 100
        score = max(0, min(100, score))

        # Classify risk tier
        risk_tier = "Medium Risk"
        for key, limits in self.risk_thresholds.items():
            min_pts = limits.get("min_points", 0)
            max_pts = limits.get("max_points", 100)
            if "min_points" in limits and "max_points" in limits:
                if min_pts <= score <= max_pts:
                    risk_tier = limits["tier"]
            elif "min_points" in limits:
                if score >= min_pts:
                    risk_tier = limits["tier"]
            elif "max_points" in limits:
                if score <= max_pts:
                    risk_tier = limits["tier"]

        return {
            "risk_score": score,
            "risk_tier": risk_tier
        }

    def evaluate_eligibility(self, plan: Dict[str, Any], profile: Dict[str, Any]) -> str:
        """
        Determines binary pre-qualification status: Eligible, Conditionally Eligible, Not Eligible.
        """
        age = profile.get("age")
        family_size = profile.get("family_size") or 1
        budget = profile.get("budget") or 999999
        income = profile.get("annual_income") or 500000

        # Check Age Boundaries
        if age:
            min_age = self.eligibility_rules.get("age", {}).get("min", 18)
            max_standard_age = self.eligibility_rules.get("age", {}).get("max", 80)
            conditional_max_age = self.eligibility_rules.get("age", {}).get("conditional_max", 99)

            if age < min_age or age > conditional_max_age:
                return "Not Eligible"
            if age > max_standard_age:
                return "Conditionally Eligible"

        # Check Family Size Boundaries
        if family_size:
            max_standard_fam = self.eligibility_rules.get("family_size", {}).get("max_standard", 6)
            conditional_fam_lim = self.eligibility_rules.get("family_size", {}).get("conditional_limit", 10)

            if family_size > conditional_fam_lim:
                return "Not Eligible"
            if family_size > max_standard_fam:
                return "Conditionally Eligible"

        # Check Budget Floor
        min_budget = self.eligibility_rules.get("budget", {}).get("minimum_budget_rupees", 500)
        if budget < min_budget:
            return "Not Eligible"

        # Check Income Floor
        min_income = self.eligibility_rules.get("income", {}).get("minimum_annual_income", 150000)
        if income < min_income:
            return "Not Eligible"

        # Check Budget Match Limit (not eligible if premium is over 1.5x of target budget)
        plan_premium = plan["premium_monthly"]
        if plan_premium > 1.5 * budget:
            return "Not Eligible"
        elif plan_premium > 1.25 * budget:
            return "Conditionally Eligible"

        return "Eligible"

    def calculate_plan_scores(self, plan: Dict[str, Any], profile: Dict[str, Any], risk_profile: Dict[str, Any]) -> Dict[str, float]:
        """
        Calculates compatibility scores (0-100 range) across Budget, Coverage, Risk,
        Claim support, and Preference categories.
        """
        budget = profile.get("budget") or 3000
        family_size = profile.get("family_size") or 1
        plan_premium = plan["premium_monthly"]

        # 1) Budget Match (0 - 100)
        if plan_premium <= budget:
            budget_match = 100.0
        else:
            # Score decays down to 0 at 1.5x budget
            ratio = (plan_premium - budget) / budget
            budget_match = max(0.0, 100.0 - (ratio * 200.0))

        # 2) Coverage Match (0 - 100)
        plan_coverage = plan["coverage_limit"]
        if plan["category"] == "health":
            min_recommend = 1000000 if family_size >= 3 else 500000
            coverage_match = min(100.0, (plan_coverage / min_recommend) * 100.0)
        else:
            coverage_match = 100.0

        # 3) Risk Match (0 - 100)
        style = plan["style"]
        risk_tier = risk_profile["risk_tier"]
        if risk_tier == "Low Risk":
            risk_match = 100.0 if style == "essential" else (90.0 if style == "comprehensive" else 70.0)
        elif risk_tier == "Medium Risk":
            risk_match = 100.0 if style == "comprehensive" else (80.0 if style == "essential" else 90.0)
        else: # High or Critical Risk
            risk_match = 100.0 if style == "elite" else (90.0 if style == "comprehensive" else 50.0)

        # 4) Claim Support Match (0 - 100)
        claim_support_match = min(100.0, (plan["claim_support_ratio"] / 98.4) * 100.0)

        # 5) Preference Match (0 - 100)
        preference_match = 80.0
        assigned_segments = profile.get("assigned_segments") or []
        if "Family Protector" in assigned_segments and style in ["elite", "comprehensive"]:
            preference_match = 100.0
        elif "Young Professional" in assigned_segments and style in ["essential", "comprehensive"]:
            preference_match = 100.0

        # Weighted calculation
        total_score = (
            budget_match * self.weights.get("budget_match", 30) / 100.0 +
            coverage_match * self.weights.get("coverage_match", 25) / 100.0 +
            risk_match * self.weights.get("risk_match", 20) / 100.0 +
            claim_support_match * self.weights.get("claim_support_match", 15) / 100.0 +
            preference_match * self.weights.get("preference_match", 10) / 100.0
        )

        return {
            "budget_match": budget_match,
            "coverage_match": coverage_match,
            "risk_match": risk_match,
            "claim_support_match": claim_support_match,
            "preference_match": preference_match,
            "total_score": round(total_score, 1)
        }

    def generate_natural_language_reasons(self, plan: Dict[str, Any], profile: Dict[str, Any], risk_profile: Dict[str, Any], scores: Dict[str, float]) -> Dict[str, str]:
        """
        Dynamically formats XAI natural-language justifications for all compatibility dimensions.
        """
        plan_name = plan["plan_name"]
        score = scores["total_score"]
        premium = plan["premium_monthly"]
        budget = profile.get("budget") or 3000
        coverage = plan["coverage_limit"]
        family_size = profile.get("family_size") or 1
        risk_tier = risk_profile["risk_tier"]

        why_selected = self.justifications.get("why_selected", "").format(
            plan_name=plan_name,
            score=score,
            preference_label=plan["style"]
        )

        budget_compatibility = self.justifications.get("budget_compatibility", "").format(
            premium=premium,
            budget=budget,
            budget_match=int(scores["budget_match"])
        )

        risk_compatibility = self.justifications.get("risk_compatibility", "").format(
            risk_tier=risk_tier,
            risk_match=int(scores["risk_match"])
        )

        coverage_compatibility = self.justifications.get("coverage_compatibility", "").format(
            coverage_limit=coverage,
            family_size=family_size,
            coverage_match=int(scores["coverage_match"])
        )

        return {
            "why_selected": why_selected,
            "budget_compatibility": budget_compatibility,
            "risk_compatibility": risk_compatibility,
            "coverage_compatibility": coverage_compatibility
        }

    def recommend(self, customer_profile: Dict[str, Any], routing_context: Dict[str, Any]) -> Dict[str, Any]:
        """
        Executes policy matching, ranking rules, risk point scoring, and output aggregation.
        """
        active_category = routing_context.get("active_category", "health")

        # 1) Calculate Risk Profile
        risk_profile = self.calculate_customer_risk_profile(customer_profile)

        # 2) Filter and score eligible plans matching active category
        scored_plans = []
        rejected_plans = []

        for plan in self.products_catalog:
            if plan["category"] != active_category:
                continue

            eligibility = self.evaluate_eligibility(plan, customer_profile)
            if eligibility == "Not Eligible":
                rejected_plans.append(plan)
                continue

            scores = self.calculate_plan_scores(plan, customer_profile, risk_profile)
            scored_plans.append({
                "plan": plan,
                "scores": scores,
                "eligibility": eligibility
            })

        # Rank plans by total score descending
        scored_plans.sort(key=lambda x: x["scores"]["total_score"], reverse=True)

        if not scored_plans:
            # Fallback in case absolutely no plans are eligible
            return {
                "recommendation_score": 0.0,
                "risk_level": risk_profile["risk_tier"],
                "coverage_match_percentage": 0.0,
                "budget_match_percentage": 0.0,
                "top_recommendation": None,
                "alternative_recommendation": None,
                "recommendation_reason": "No plans matching your budget and pre-qualification constraints were found.",
                "confidence_score": 0.0
            }

        # 3) Populate Recommendation Slots
        top_item = scored_plans[0]
        alt_item = scored_plans[1] if len(scored_plans) > 1 else None

        top_plan = top_item["plan"]
        top_scores = top_item["scores"]

        # Generate XAI Justifications for Top selection
        justifications = self.generate_natural_language_reasons(top_plan, customer_profile, risk_profile, top_scores)

        # Generate alternative justifications
        alt_justification = ""
        if alt_item:
            alt_plan = alt_item["plan"]
            alt_justification = f"Alternative Plan {alt_plan['plan_name']} provides coverage capped at ₹{alt_plan['coverage_limit']} with compatibility fit of {alt_item['scores']['total_score']}/100."
        else:
            alt_justification = "No secondary alternative plan matched the minimum threshold guidelines."

        why_not_reason = ""
        if rejected_plans:
            why_not_reason = f"Essential plan was filtered because it falls beneath coverage thresholds, and plan premium over 1.5x budget caps out eligibility limit."
        else:
            why_not_reason = "No plans violated standard pre-qualification constraints."

        full_reason = (
            f"{justifications['why_selected']} {justifications['budget_compatibility']} "
            f"{justifications['risk_compatibility']} {justifications['coverage_compatibility']} "
            f"Not Selected Choice: {why_not_reason}"
        )

        # Confidence is the composite suitability score as a fraction
        confidence = round(top_scores["total_score"] / 100.0, 2)

        return {
            "recommendation_score": top_scores["total_score"],
            "risk_level": risk_profile["risk_tier"],
            "coverage_match_percentage": round(top_scores["coverage_match"], 1),
            "budget_match_percentage": round(top_scores["budget_match"], 1),
            "top_recommendation": {
                "plan_name": top_plan["plan_name"],
                "premium_monthly": top_plan["premium_monthly"],
                "coverage_limit": top_plan["coverage_limit"],
                "benefits": top_plan["benefits"],
                "style": top_plan["style"]
            },
            "alternative_recommendation": {
                "plan_name": alt_plan["plan_name"],
                "premium_monthly": alt_plan["premium_monthly"],
                "coverage_limit": alt_plan["coverage_limit"],
                "benefits": alt_plan["benefits"],
                "style": alt_plan["style"]
            } if alt_item else None,
            "recommendation_reason": full_reason,
            "confidence_score": confidence
        }
