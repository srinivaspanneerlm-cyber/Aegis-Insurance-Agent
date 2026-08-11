import os
import re
import json
from datetime import datetime
from pathlib import Path
from typing import Dict, Any, Optional, List

class AegisMemoryEngine:
    """
    🛡️ Aegis AI Layer 3 — Memory & Customer Intelligence Engine
    Performs real-time zero-knowledge information extraction, schema validation,
    progressive user profiling, state machine transitions, segment classification,
    and context compilation.
    
    All storage folders remain empty by default and profiles are created only
    on active user interactions.
    """
    def __init__(self, base_dir: Optional[str] = None):
        if base_dir:
            self.base_dir = Path(base_dir).resolve()
        else:
            self.base_dir = Path(__file__).resolve().parent

        # Folders Configuration
        self.profile_dir = self.base_dir / "customer_profile"
        self.memory_dir = self.base_dir / "conversation_memory"
        self.state_dir = self.base_dir / "state_manager"
        self.recommendation_dir = self.base_dir / "recommendation_context"
        self.intelligence_dir = self.base_dir / "customer_intelligence"

        # Storage paths
        self.profiles_storage = self.profile_dir / "customer_profiles"
        self.conversations_storage = self.memory_dir / "conversations"
        self.contexts_storage = self.recommendation_dir / "contexts"
        self.intelligence_storage = self.intelligence_dir / "intelligence_profiles"

        # Dynamically create storage folders if they do not exist
        for path in [self.profiles_storage, self.conversations_storage, self.contexts_storage, self.intelligence_storage]:
            path.mkdir(parents=True, exist_ok=True)

        # Load configuration files
        self.profile_schema = self._load_json(self.profile_dir / "profile_schema.json")
        self.profile_validation = self._load_json(self.profile_dir / "profile_validation.json")
        self.profile_completion = self._load_json(self.profile_dir / "profile_completion_rules.json")
        self.memory_rules = self._load_json(self.memory_dir / "memory_rules.json")
        self.state_transitions = self._load_json(self.state_dir / "state_transitions.json")
        self.state_schema = self._load_json(self.state_dir / "conversation_state.json")
        self.context_builder = self._load_json(self.recommendation_dir / "context_builder.json")
        self.customer_segments = self._load_json(self.intelligence_dir / "customer_segments.json")
        self.risk_rules = self._load_json(self.intelligence_dir / "risk_profile_rules.json")

    @staticmethod
    def _safe_id(customer_id: str) -> str:
        """
        Neutralise path separators before a customer id becomes a filename.

        This id is derived from data that arrived over the wire, so a separator
        in it would place the file outside the intended storage folder. The
        caller (ProfileManager) guards its own fallback path, but on this
        engine's path it passed the id through unfiltered — so the boundary has
        to live here, at the point of file I/O, to actually hold. Mirrors
        ProfileManager._safe / ConversationStore / RecommendationCache.
        """
        return str(customer_id).replace("/", "_").replace("\\", "_")

    def _load_json(self, file_path: Path) -> Dict[str, Any]:
        """Utility to safely load JSON files."""
        if file_path.exists():
            try:
                with open(file_path, "r", encoding="utf-8") as f:
                    return json.load(f)
            except Exception as e:
                print(f"Error loading {file_path.name}: {e}")
        return {}

    def extract_from_message(self, message: str) -> Dict[str, Any]:
        """
        Extracts age, family size, budget, income, location, vehicle, property, and travel plans
        from user messages using regex configurations from memory_rules.json.
        """
        extracted = {}
        if not self.memory_rules or "extraction_rules" not in self.memory_rules:
            return extracted

        detectors = self.memory_rules["extraction_rules"].get("detectors", {})
        message_lower = message.lower()

        # Custom high-fidelity extraction heuristics for age, budget, and family size
        # 1) Age extraction
        age_match = re.search(r'\bage\s*(?:is)?\s*(\d+)\b', message_lower)
        if age_match:
            extracted["age"] = int(age_match.group(1))

        # 2) Budget extraction — the hedged phrasing people actually use
        # ("budget is around 1000", "budget of about 2500") needs a repeating
        # filler run; a single optional word stopped at "budget is around" and
        # read no number, so the advisor kept asking for a budget it had already
        # been given. Kept in step with the same pattern in
        # ai-python/app/memory/profile_manager.py::_fallback_extract.
        budget_match = re.search(
            r'\bbudget\b'
            r'(?:\s*(?:is|of|around|about|approx\.?|approximately|roughly|'
            r'nearly|near|maybe|say|up\s*to))*'
            r'\s*(?:rs\.?|rupees|₹)?\s*(\d+)\b',
            message_lower,
        )
        if budget_match:
            extracted["budget"] = float(budget_match.group(1))

        # 3) Family size extraction
        fam_size_match = re.search(r'\bfamily\s*(?:size)?\s*(?:is|of)?\s*(\d+)\b', message_lower)
        members_match = re.search(r'\b(\d+)\s*(?:family\s+)?members\b', message_lower)
        
        if fam_size_match:
            extracted["family_size"] = int(fam_size_match.group(1))
        elif members_match:
            extracted["family_size"] = int(members_match.group(1))
        else:
            # Check family composition strings:
            # - "wife and 2 children" / "wife and 2 kids" -> self(1) + wife(1) + children(2) = 4
            # - "husband and 3 kids" / "husband and 3 children" -> self(1) + husband(1) + kids(3) = 5
            # - "myself and 3 children" / "myself and 3 kids" -> self(1) + 3 = 4
            comp_patterns = [
                (r'\b(?:wife|husband)\s+and\s+(\d+)\s*(?:children|kids|child|son|daughter|boys|girls|members)\b', lambda n: n + 2),
                (r'\b(?:myself|me)\s+and\s+(\d+)\s*(?:children|kids|child|son|daughter|boys|girls|members)\b', lambda n: n + 1),
                (r'\bmyself\s*,\s*(?:my\s+)?(?:wife|husband)\s+and\s+(\d+)\s*(?:children|kids|child|son|daughter|boys|girls|members)\b', lambda n: n + 2),
                (r'\b(?:wife|husband)\s+and\s+myself\s+with\s+(\d+)\s*(?:children|kids|child|son|daughter|boys|girls|members)\b', lambda n: n + 2),
                (r'\bhusband\s+and\s+wife\s+with\s+(\d+)\s*(?:children|kids|child|son|daughter|boys|girls|members)\b', lambda n: n + 2),
            ]
            matched_comp = False
            for pattern, formula in comp_patterns:
                match = re.search(pattern, message_lower)
                if match:
                    extracted["family_size"] = formula(int(match.group(1)))
                    matched_comp = True
                    break
            
            if not matched_comp:
                if any(w in message_lower for w in ["just me", "alone", "myself only", "myself", "only me"]):
                    extracted["family_size"] = 1

        # 4) Extract remaining fields or fall back to standard memory rules detectors
        for field in ["age", "family_size", "budget", "income", "location", "vehicle", "property", "travel_plans"]:
            if field in extracted:
                continue
            config = detectors.get(field, {})
            patterns = config.get("patterns", [])
            field_type = config.get("type", "string")

            for pattern in patterns:
                match = re.search(pattern, message_lower)
                if match:
                    val_str = match.group(1).strip() if len(match.groups()) > 0 else match.group(0).strip()
                    try:
                        if field_type == "integer":
                            extracted[field] = int(val_str)
                        elif field_type == "number":
                            extracted[field] = float(val_str)
                        else:
                            extracted[field] = val_str.capitalize()
                        break
                    except (ValueError, TypeError):
                        continue

        return extracted

    def validate_extracted_fields(self, extracted: Dict[str, Any]) -> Dict[str, Any]:
        """
        Validates extracted fields using rules defined in profile_validation.json.
        Drops fields that violate constraints.
        """
        if not self.profile_validation or "rules" not in self.profile_validation:
            return extracted

        validated = {}
        rules = self.profile_validation["rules"]

        for field, value in extracted.items():
            if field not in rules:
                validated[field] = value
                continue

            rule = rules[field]
            is_valid = True

            # Range checks
            if "min" in rule and value < rule["min"]:
                is_valid = False
            if "max" in rule and value > rule["max"]:
                is_valid = False

            # Enum checks
            if "enum" in rule:
                allowed = [e.lower() for e in rule["enum"]]
                if str(value).lower() not in allowed:
                    is_valid = False

            if is_valid:
                validated[field] = value

        return validated

    def load_profile(self, customer_id: str) -> Dict[str, Any]:
        """
        Loads a customer profile by ID. If it does not exist,
        instantiates an empty default profile matching profile_schema.json.
        """
        profile_file = self.profiles_storage / f"{self._safe_id(customer_id)}.json"
        if profile_file.exists():
            return self._load_json(profile_file)

        # Generate default empty structure from schema
        profile = {}
        if self.profile_schema and "properties" in self.profile_schema:
            for prop, details in self.profile_schema["properties"].items():
                profile[prop] = details.get("default", None)
        
        profile["customer_id"] = customer_id
        profile["existing_policies"] = []
        profile["conversation_history_count"] = 0
        return profile

    def save_profile(self, customer_id: str, profile: Dict[str, Any]) -> None:
        """Saves customer profile to profiles folder."""
        profile_file = self.profiles_storage / f"{self._safe_id(customer_id)}.json"
        with open(profile_file, "w", encoding="utf-8") as f:
            json.dump(profile, f, indent=2)

    def update_profile(self, customer_id: str, message: str) -> Dict[str, Any]:
        """
        Main interface to ingest a user message, extract facts, update profile parameters,
        and write back to profiles storage. Ensures we update existing records without duplicate profiles.
        """
        profile = self.load_profile(customer_id)

        # Perform extraction
        raw_extracted = self.extract_from_message(message)
        validated_extracted = self.validate_extracted_fields(raw_extracted)

        # Merge fields
        for field, val in validated_extracted.items():
            profile[field] = val

        # Increment engagement stats
        profile["conversation_history_count"] += 1
        profile["last_interaction"] = datetime.now().isoformat()

        # Save profile
        self.save_profile(customer_id, profile)

        return profile

    def update_state(self, customer_id: str, profile: Dict[str, Any]) -> Dict[str, Any]:
        """
        Maintains conversation stage machine progression and checks recommendation readiness.
        """
        state_file = self.conversations_storage / f"{self._safe_id(customer_id)}_state.json"
        
        # Load or initialize state
        if state_file.exists():
            state = self._load_json(state_file)
        else:
            state = {
                "current_stage": "greeting",
                "completed_questions": [],
                "pending_questions": ["collecting_age", "collecting_budget", "collecting_family_size"],
                "recommendation_readiness": False
            }

        # Check collected facts
        completed = []
        pending = []

        if profile.get("age") is not None:
            completed.append("collecting_age")
        else:
            pending.append("collecting_age")

        if profile.get("budget") is not None:
            completed.append("collecting_budget")
        else:
            pending.append("collecting_budget")

        if profile.get("family_size") is not None:
            completed.append("collecting_family_size")
        else:
            pending.append("collecting_family_size")

        state["completed_questions"] = completed
        state["pending_questions"] = pending

        # Determine stage transitions
        if not completed:
            state["current_stage"] = "greeting"
        elif "collecting_age" in pending:
            state["current_stage"] = "collecting_age"
        elif "collecting_budget" in pending:
            state["current_stage"] = "collecting_budget"
        elif "collecting_family_size" in pending:
            state["current_stage"] = "collecting_family_size"
        else:
            state["current_stage"] = "ready_for_recommendation"
            state["recommendation_readiness"] = True

        # Save state
        with open(state_file, "w", encoding="utf-8") as f:
            json.dump(state, f, indent=2)

        return state

    def classify_intelligence(self, customer_id: str, profile: Dict[str, Any]) -> Dict[str, Any]:
        """
        Performs automated underwriting risk scoring and assigns target segments:
        Family Protector, Young Professional, Senior Citizen Planner, etc.
        """
        # 1) Evaluate Risk Level
        risk_score = 0
        age = profile.get("age")
        income = profile.get("annual_income")
        family_size = profile.get("family_size")

        if age:
            if age >= 55:
                risk_score += 2
            elif age < 30:
                risk_score -= 1

        if income:
            if income >= 1500000:
                risk_score -= 1
            elif income < 300000:
                risk_score += 1

        if family_size and family_size >= 5:
            risk_score += 1

        # Classify risk
        risk_tier = "Medium"
        if risk_score < 0:
            risk_tier = "Low"
        elif risk_score >= 2:
            risk_tier = "High"

        profile["risk_profile"] = risk_tier
        self.save_profile(customer_id, profile)

        # 2) Segment Assignment
        segments = []
        occupation = profile.get("occupation")
        travel_plans = profile.get("travel_plans")
        vehicle = profile.get("vehicle")
        property_holding = profile.get("property")

        # Family Protector
        if family_size and age and family_size >= 3 and age >= 25:
            segments.append("Family Protector")

        # Young Professional
        if age and family_size is not None and age < 32 and family_size <= 2 and occupation:
            segments.append("Young Professional")

        # Senior Citizen Planner
        if age and age >= 60:
            segments.append("Senior Citizen Planner")

        # Business Owner
        if occupation:
            keywords = ["business", "owner", "founder", "entrepreneur", "ceo", "partner", "merchant", "director", "corporate"]
            if any(k in str(occupation).lower() for k in keywords):
                segments.append("Business Owner")

        # Frequent Traveler
        if travel_plans:
            segments.append("Frequent Traveler")

        # Property Owner
        if property_holding:
            segments.append("Property Owner")

        # Vehicle Owner
        if vehicle:
            segments.append("Vehicle Owner")

        intel_profile = {
            "customer_id": customer_id,
            "calculated_risk_score": risk_score,
            "assigned_risk_tier": risk_tier,
            "assigned_segments": segments,
            "last_processed": datetime.now().isoformat()
        }

        intel_file = self.intelligence_storage / f"{self._safe_id(customer_id)}.json"
        with open(intel_file, "w", encoding="utf-8") as f:
            json.dump(intel_profile, f, indent=2)

        return intel_profile

    def compile_recommendation_context(self, customer_id: str, profile: Dict[str, Any], risk_profile: str) -> Dict[str, Any]:
        """
        Dynamically builds the context summaries:
        Customer Summary, Risk Summary, Coverage Summary, Budget Summary.
        Only prepares text context and does not generate recommendations.
        """
        name = profile.get("name") or "User"
        age = profile.get("age") or "Not provided"
        occupation = profile.get("occupation") or "Not provided"
        family_size = profile.get("family_size") or "Not provided"
        location = profile.get("location") or "Not provided"
        preferred_category = profile.get("preferred_category") or "General"
        existing_policies = profile.get("existing_policies") or []
        budget = profile.get("budget") or "Not provided"
        income = profile.get("annual_income") or "Not provided"

        # Build summaries using formats defined in context_builder.json or fallbacks
        customer_summary = f"Customer {name} (ID: {customer_id}) is a {age}-year-old {occupation} with a family size of {family_size} based in {location}."
        risk_summary = f"Underwriting Risk classified as {risk_profile}. Primary focus: {preferred_category} protection rules."
        coverage_summary = f"Targeting coverage options matching family floater or individual limits for family size of {family_size}. Active policies: {existing_policies}."
        budget_summary = f"Affordability tier established around ₹{budget} per month based on annual income of ₹{income}."

        context = {
            "customer_id": customer_id,
            "customer_summary": customer_summary,
            "risk_summary": risk_summary,
            "coverage_summary": coverage_summary,
            "budget_summary": budget_summary,
            "compiled_at": datetime.now().isoformat()
        }

        context_file = self.contexts_storage / f"{self._safe_id(customer_id)}.json"
        with open(context_file, "w", encoding="utf-8") as f:
            json.dump(context, f, indent=2)

        return context
