"""
Aegis AI — Enhanced Profile Manager

Provides TWO layers of customer profiling:

  1. SHARED profile: shared_{customer_id}.json
     Fields universal to every domain:
       name, age, gender, occupation, annual_income, family_size,
       budget, location, nominee, language, communication_preference,
       medical_history
     Written by ANY agent. Read by ALL agents.

  2. DOMAIN profile: {domain}_{customer_id}.json  (existing Layer 3 file)
     Domain-specific fields:
       health:        pre_existing_conditions, preferred_hospitals
       motor:         vehicle, registration_number, vehicle_year, ncb_history
       travel:        travel_plans, destination, trip_duration
       home-property: property, property_value, construction_year
       executive:     company_name, company_size, industry, turnover

  load_merged_profile() = shared + domain merged → single dict for agent use.

  This fixes:
    ✓ Problem 2:  Customer profile forgotten
    ✓ Problem 9:  Customer details disappear after page navigation
    ✓ Problem 10: Transferred conversations lose context
    ✓ Problem 7:  Agent repeats same questions (cross-domain field access)
"""
import json
import re
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

from app.utils.logger import logger


# ── Field definitions ─────────────────────────────────────────────────────────

SHARED_FIELDS: List[str] = [
    "name", "age", "gender", "occupation", "annual_income",
    "family_size", "budget", "location", "nominee", "language",
    "communication_preference", "medical_history",
]

DOMAIN_FIELDS: Dict[str, List[str]] = {
    "health":        ["pre_existing_conditions", "preferred_hospitals",
                      "maternity_required", "critical_illness_history"],
    "motor":         ["vehicle", "registration_number", "vehicle_year",
                      "vehicle_type", "ncb_history", "previous_insurer"],
    "travel":        ["travel_plans", "destination", "trip_duration",
                      "travel_frequency", "visa_type"],
    "home-property": ["property", "property_value", "construction_year",
                      "tenants", "floor_number", "property_type"],
    "executive":     ["company_name", "company_size", "industry",
                      "annual_turnover", "employee_count"],
}


class EnhancedProfileManager:
    """
    Manages shared + domain profiles for cross-agent customer context.

    Key rule: when ANY agent extracts age, budget, family_size, etc.
    from the customer's message, those fields are written to BOTH:
      - the shared profile  (shared_cust_xxx.json)
      - the domain profile  ({domain}_cust_xxx.json)

    Any agent can then read the shared profile to avoid re-asking
    questions that were already answered in a different domain.
    """

    def __init__(self, profiles_dir: Path, memory_engine=None):
        self.profiles_dir = Path(profiles_dir)
        self.profiles_dir.mkdir(parents=True, exist_ok=True)
        self.memory_engine = memory_engine  # AegisMemoryEngine (Layer 3)
        self._cache: Dict[str, Dict] = {}

    # ── Paths ─────────────────────────────────────────────────────────────────

    def _shared_path(self, base_customer_id: str) -> Path:
        return self.profiles_dir / f"shared_{base_customer_id}.json"

    # ── Shared profile ────────────────────────────────────────────────────────

    def load_shared_profile(self, base_customer_id: str) -> Dict[str, Any]:
        """Load (or initialize) the cross-domain shared profile."""
        key = f"shared:{base_customer_id}"
        if key in self._cache:
            return dict(self._cache[key])

        path = self._shared_path(base_customer_id)
        if path.exists():
            try:
                data = json.loads(path.read_text(encoding="utf-8"))
                self._cache[key] = data
                return dict(data)
            except Exception:
                pass

        empty = {
            "customer_id": f"shared_{base_customer_id}",
            "conversation_domains": [],
        }
        return empty

    def save_shared_profile(self, base_customer_id: str, shared: Dict[str, Any]) -> None:
        path = self._shared_path(base_customer_id)
        try:
            path.write_text(json.dumps(shared, indent=2, default=str), encoding="utf-8")
            self._cache[f"shared:{base_customer_id}"] = dict(shared)
        except Exception as e:
            logger.error(f"[ProfileManager] Save shared failed {base_customer_id}: {e}")

    # ── Domain profile ────────────────────────────────────────────────────────

    def load_domain_profile(self, domain_customer_id: str) -> Dict[str, Any]:
        """Load the domain-specific profile (uses Layer 3 engine if available)."""
        key = f"domain:{domain_customer_id}"
        if key in self._cache:
            return dict(self._cache[key])

        if self.memory_engine:
            profile = self.memory_engine.load_profile(domain_customer_id)
            self._cache[key] = profile
            return dict(profile)

        # Fallback: direct file access
        path = self.profiles_dir / f"{domain_customer_id}.json"
        if path.exists():
            try:
                data = json.loads(path.read_text(encoding="utf-8"))
                self._cache[key] = data
                return dict(data)
            except Exception:
                pass

        return {"customer_id": domain_customer_id}

    def save_domain_profile(self, domain_customer_id: str, profile: Dict[str, Any]) -> None:
        if self.memory_engine:
            self.memory_engine.save_profile(domain_customer_id, profile)
        else:
            path = self.profiles_dir / f"{domain_customer_id}.json"
            try:
                path.write_text(json.dumps(profile, indent=2, default=str), encoding="utf-8")
            except Exception as e:
                logger.error(f"[ProfileManager] Save domain failed {domain_customer_id}: {e}")
        self._cache[f"domain:{domain_customer_id}"] = dict(profile)

    # ── Merged profile ────────────────────────────────────────────────────────

    def load_merged_profile(self, base_customer_id: str, domain: str) -> Dict[str, Any]:
        """
        Returns: domain_profile fields + shared_profile fields overlaid.
        Shared fields win → ensures cross-domain data is always used.
        """
        domain_customer_id = f"{domain}_{base_customer_id}"
        shared = self.load_shared_profile(base_customer_id)
        domain_profile = self.load_domain_profile(domain_customer_id)

        merged = dict(domain_profile)
        for field in SHARED_FIELDS:
            v = shared.get(field)
            if v is not None:
                merged[field] = v

        return merged

    # ── Context-aware extraction ──────────────────────────────────────────────

    def context_aware_extract(
        self, message: str, last_agent_question: str
    ) -> Dict[str, Any]:
        """
        Infer field values when the current message is a bare answer (e.g. just "35")
        by combining NUMBER RANGE (primary) with question context (secondary).

        Number range alone handles most cases:
          35  → can only be age (not budget, not family_size > 20)
          4   → family_size (too young for primary insured, too small for budget)
          2500 → budget (too large for age/family)

        Question context resolves ambiguous ranges (e.g. 18 could be age or family_size).

        Examples:
          "35" after "share your age and monthly budget?" → age=35
          "4"  after "how many family members?"          → family_size=4
          "2500" after "what is your budget?"            → budget=2500.0
          "just me" after "how many in family?"          → family_size=1
        """
        extracted: Dict[str, Any] = {}
        if not last_agent_question:
            return extracted

        q = last_agent_question.lower()
        msg = message.strip()

        # Detect if current message is a bare number
        num_str = re.sub(r'[₹,\s,]', '', msg)
        is_bare_number = bool(re.match(r'^\d+(\.\d+)?$', num_str))

        if is_bare_number:
            try:
                num = float(num_str)
            except ValueError:
                return extracted

            # ── Range flags (mutually exclusive by design) ─────────────────
            in_family_range = (1 <= num <= 20)        # plausible family size
            in_age_range    = (18 <= num <= 120)       # plausible adult age
            in_budget_range = (num >= 100)             # realistic monthly budget (₹)
            in_income_range = (num >= 10000)           # realistic annual income

            # ── Question context signals ────────────────────────────────────
            has_age_ctx    = any(w in q for w in ['age', 'old', 'born', 'year', 'how old'])
            has_budget_ctx = any(w in q for w in ['budget', 'premium', 'monthly', 'spend', 'pay', 'afford', '₹', ' rs', 'rupee', 'how much'])
            has_family_ctx = any(w in q for w in ['family', 'member', 'cover', 'people', 'household', 'depend', 'person'])
            has_income_ctx = any(w in q for w in ['income', 'earn', 'salary', 'annual'])

            if has_income_ctx and in_income_range:
                # Annual income: large number + income context
                extracted['annual_income'] = num

            elif in_budget_range and not in_age_range and not in_family_range:
                # Numbers > 120 can ONLY be budget (too large for age or family)
                extracted['budget'] = num

            elif in_age_range and not in_family_range:
                # Numbers 21-120: too large to be family size, plausible as adult age
                # Even if question asks about budget/family too, this is age
                extracted['age'] = int(num)

            elif in_family_range and not in_age_range:
                # Numbers 1-17: too young for primary insured, interpret as family size
                extracted['family_size'] = int(num)

            else:
                # Ambiguous range 18-20 (could be age=18/19/20 or family_size)
                # OR small budget < 100
                if has_budget_ctx and not has_age_ctx and not has_family_ctx and in_budget_range:
                    extracted['budget'] = num
                elif has_age_ctx and not has_family_ctx and in_age_range:
                    extracted['age'] = int(num)
                elif has_family_ctx and not has_age_ctx and in_family_range:
                    extracted['family_size'] = int(num)
                elif in_age_range:
                    # Default: age wins for 18-20 ambiguous range
                    extracted['age'] = int(num)
                elif in_family_range:
                    extracted['family_size'] = int(num)

        # Non-numeric family answers ("just me", "only me", etc.)
        msg_lower = msg.lower().strip()
        if not extracted.get('family_size'):
            if any(w in q for w in ['family', 'member', 'cover', 'depend', 'household', 'how many', 'insure']):
                if any(p in msg_lower for p in ['just me', 'only me', 'myself', 'alone', 'just myself', 'me only']):
                    extracted['family_size'] = 1
                elif msg_lower in ('single', 'solo', 'individual', 'self'):
                    extracted['family_size'] = 1

        # Medical history responses
        if not extracted.get('medical_history'):
            if any(w in q for w in ['medical', 'condition', 'pre-existing', 'diabetes', 'disease',
                                     'health condition', 'existing', 'hypertension', 'heart']):
                neg_words = ['no', 'none', 'nothing', 'nope', 'healthy', 'no issues',
                             "don't have", 'all good', 'no condition', 'no problem',
                             'perfectly healthy', 'fit', 'fine', 'skip', 'na', 'n/a',
                             'no medical', 'no existing', 'normal', 'clean', 'clear',
                             'no pre', 'not any', 'nil']
                if any(w in msg_lower for w in neg_words) or msg_lower in ('no', 'none', 'na', 'nope', 'nothing', 'skip', 'healthy', 'fine', 'nil'):
                    extracted['medical_history'] = 'none'
                elif len(msg.strip()) >= 2 and msg_lower not in ('yes', 'yeah', 'yep', 'ok', 'okay'):
                    extracted['medical_history'] = msg.strip().capitalize()

        # Location / city (bare city name in response to "which city?" question)
        if not extracted.get('location'):
            if any(w in q for w in ['city', 'based in', 'location', 'live', 'reside', 'where are you', 'where do you']):
                msg_stripped = msg.strip()
                non_location = {'no', 'none', 'yes', 'yeah', 'okay', 'ok', 'sure', 'hi', 'hello', 'thanks', 'skip', 'na'}
                if (not is_bare_number and len(msg_stripped) >= 2
                        and msg_lower not in non_location
                        and re.match(r'^[A-Za-z\s,\-\.]+$', msg_stripped)):
                    extracted['location'] = msg_stripped.title()

        # Vehicle details (for Alex AI motor consultations)
        if not extracted.get('vehicle'):
            if any(w in q for w in ['vehicle', 'car', 'bike', 'model', 'motor', 'insure', 'make']):
                msg_stripped = msg.strip()
                if not is_bare_number and len(msg_stripped) >= 3:
                    extracted['vehicle'] = msg_stripped

        # Destination (for Ethan AI travel consultations)
        if not extracted.get('destination'):
            if any(w in q for w in ['travel', 'destination', 'where', 'going', 'trip', 'planning to', 'heading']):
                msg_stripped = msg.strip()
                dest_match = re.search(
                    r'\b(?:to|for|visiting|going to|travelling to|traveling to)\s+([A-Za-z][A-Za-z\s,]+?)(?:\s+(?:and|for|next|from)|[,\.]|$)',
                    msg_stripped, re.IGNORECASE
                )
                if dest_match:
                    extracted['destination'] = dest_match.group(1).strip().title()
                elif (not is_bare_number and re.match(r'^[A-Za-z\s,]+$', msg_stripped)
                      and len(msg_stripped) >= 2
                      and msg_lower not in ('no', 'none', 'yes', 'yeah', 'skip')):
                    extracted['destination'] = msg_stripped.title()

        # Trip duration (for Ethan AI travel consultations)
        if not extracted.get('trip_duration'):
            if any(w in q for w in ['long', 'duration', 'trip', 'days', 'weeks', 'how long', 'how many days']):
                dur_match = re.search(r'(\d+)\s*(day|week|month|night)s?', msg_lower)
                if dur_match:
                    extracted['trip_duration'] = f"{dur_match.group(1)} {dur_match.group(2)}s"
                elif (not is_bare_number and re.match(r'^[A-Za-z0-9\s\-]+$', msg.strip())
                      and len(msg.strip()) >= 2
                      and msg_lower not in ('no', 'none', 'yes', 'skip')):
                    extracted['trip_duration'] = msg.strip()

        # Property type (for Emma AI property consultations)
        if not extracted.get('property'):
            if any(w in q for w in ['property', 'house', 'apartment', 'home', 'own', 'rent', 'villa']):
                prop_keywords = ['apartment', 'flat', 'house', 'villa', 'bungalow', 'independent',
                                  'commercial', 'duplex', 'penthouse', 'studio', 'own', 'rent', 'rented', 'owned']
                msg_stripped = msg.strip()
                if any(kw in msg_lower for kw in prop_keywords) and len(msg_stripped) >= 3:
                    extracted['property'] = msg_stripped.capitalize()
                elif not is_bare_number and len(msg_stripped) >= 4 and msg_lower not in ('no', 'yes', 'none', 'skip'):
                    extracted['property'] = msg_stripped.capitalize()

        return extracted

    # ── Domain-field filter (prevents false cross-domain extractions) ─────────

    # Fields that belong ONLY to specific domains — never save them for others
    _DOMAIN_EXCLUSIVE: Dict[str, List[str]] = {
        "vehicle": ["motor"],
        "property": ["home-property"],
        "travel_plans": ["travel"],
        "destination": ["travel"],
        "trip_duration": ["travel"],
        "visa_type": ["travel"],
        "property_value": ["home-property"],
        "registration_number": ["motor"],
        "ncb_history": ["motor"],
    }

    def _filter_cross_domain_fields(
        self, extracted: Dict[str, Any], domain: str
    ) -> Dict[str, Any]:
        """Remove fields that belong exclusively to other domains."""
        filtered = {}
        for field, value in extracted.items():
            allowed_domains = self._DOMAIN_EXCLUSIVE.get(field)
            if allowed_domains is None or domain in allowed_domains:
                filtered[field] = value
        return filtered

    # ── Update (main write path) ──────────────────────────────────────────────

    def update_with_message(
        self,
        base_customer_id: str,
        domain: str,
        message: str,
        user_name: Optional[str] = None,
        context_question: str = "",
    ) -> Dict[str, Any]:
        """
        Extract facts from message → write to BOTH shared and domain profiles.
        Returns the merged profile (shared + domain).

        context_question: the last message the agent sent (used for context-aware
        extraction — interprets bare number answers like "35" as age, budget, etc.)
        """
        domain_customer_id = f"{domain}_{base_customer_id}"

        # ── 1. Extract from current message ───────────────────────────────────
        if self.memory_engine:
            raw = self.memory_engine.extract_from_message(message)
            extracted = self.memory_engine.validate_extracted_fields(raw)
        else:
            extracted = self._fallback_extract(message)

        # ── 1b. Context-aware extraction (supplements standard extraction) ──────
        # Always runs when a context_question is available — adds fields not
        # captured by standard extraction (bare answers, city names, medical
        # history, vehicle details, destination, etc.).
        if context_question:
            ctx_extracted = self.context_aware_extract(message, context_question)
            for k, v in ctx_extracted.items():
                if k not in extracted:  # supplement only — never override standard extraction
                    extracted[k] = v

        # ── 1c. Filter out false cross-domain field extractions ───────────────
        extracted = self._filter_cross_domain_fields(extracted, domain)

        # ── 2. Load existing profiles ─────────────────────────────────────────
        shared = self.load_shared_profile(base_customer_id)
        domain_profile = self.load_domain_profile(domain_customer_id)

        # ── 3. Set name from user_name if not already known ───────────────────
        if user_name and not shared.get("name"):
            clean_name = user_name.strip().title()
            if clean_name.lower() not in ("sri", "default") or not shared.get("name"):
                shared["name"] = clean_name

        # ── 4. Update SHARED profile with universal fields ────────────────────
        shared_changed = False
        for field in SHARED_FIELDS:
            val = extracted.get(field)
            if val is not None:
                old = shared.get(field)
                if old != val:
                    shared[field] = val
                    shared_changed = True

        shared["last_updated"] = datetime.utcnow().isoformat()
        if "conversation_domains" not in shared:
            shared["conversation_domains"] = []
        if domain not in shared["conversation_domains"]:
            shared["conversation_domains"].append(domain)
            shared_changed = True

        if shared_changed:
            self.save_shared_profile(base_customer_id, shared)

        # ── 5. Update DOMAIN profile with all extracted fields ────────────────
        domain_profile["customer_id"] = domain_customer_id

        # All extracted fields go into domain profile
        for field, val in extracted.items():
            if val is not None:
                domain_profile[field] = val

        # Sync shared fields down to domain profile (so domain is self-contained)
        for field in SHARED_FIELDS:
            v = shared.get(field)
            if v is not None:
                domain_profile[field] = v

        domain_profile["last_interaction"] = datetime.utcnow().isoformat()
        domain_profile["conversation_history_count"] = (
            domain_profile.get("conversation_history_count", 0) + 1
        )

        self.save_domain_profile(domain_customer_id, domain_profile)

        # Return the merged view
        return domain_profile

    # ── Cross-domain context helper ───────────────────────────────────────────

    def get_cross_domain_context(
        self, base_customer_id: str, current_domain: str
    ) -> str:
        """
        Returns a text block summarizing what's known from other agent conversations.
        Embedded in the system prompt to prevent re-asking already-collected fields.
        """
        shared = self.load_shared_profile(base_customer_id)

        parts = []
        if shared.get("name"):    parts.append(f"Name: {shared['name']}")
        if shared.get("age"):     parts.append(f"Age: {shared['age']}")
        if shared.get("family_size"): parts.append(f"Family size: {shared['family_size']}")
        if shared.get("budget"):  parts.append(f"Monthly budget: ₹{shared['budget']}")
        if shared.get("location"): parts.append(f"Location: {shared['location']}")
        if shared.get("occupation"): parts.append(f"Occupation: {shared['occupation']}")
        if shared.get("annual_income"): parts.append(f"Annual income: ₹{shared['annual_income']}")
        if shared.get("gender"):  parts.append(f"Gender: {shared['gender']}")
        if shared.get("nominee"): parts.append(f"Nominee: {shared['nominee']}")

        if not parts:
            return ""

        domains_seen = [d for d in shared.get("conversation_domains", []) if d != current_domain]
        if domains_seen:
            return (
                f"[Context from previous conversations in {', '.join(domains_seen)}: "
                + "; ".join(parts) + "]"
            )
        return "[Known customer info: " + "; ".join(parts) + "]"

    # ── Fallback extraction (no Layer 3 engine) ───────────────────────────────

    def _fallback_extract(self, message: str) -> Dict[str, Any]:
        """Minimal regex extraction when Layer 3 engine is unavailable."""
        extracted: Dict[str, Any] = {}
        msg = message.lower()

        # Age
        m = re.search(r'\bage\s*(?:is)?\s*(\d{1,3})\b', msg)
        if m:
            try:
                extracted["age"] = int(m.group(1))
            except ValueError:
                pass

        # Budget — handles ₹2500, rs 2500, budget 2500
        m = re.search(
            r'\bbudget\s*(?:is|of|around)?\s*(?:rs\.?|rupees|₹)?\s*(\d+(?:\.\d+)?)\b',
            msg,
        )
        if not m:
            m = re.search(r'(?:rs\.?|rupees|₹)\s*(\d+(?:\.\d+)?)\b', msg)
        if m:
            try:
                extracted["budget"] = float(m.group(1))
            except ValueError:
                pass

        # Family size
        m = re.search(r'\bfamily\s*(?:size|of)?\s*(?:is)?\s*(\d+)\b', msg)
        if m:
            try:
                extracted["family_size"] = int(m.group(1))
            except ValueError:
                pass
        else:
            m = re.search(r'\b(\d+)\s*(?:family\s+)?members\b', msg)
            if m:
                try:
                    extracted["family_size"] = int(m.group(1))
                except ValueError:
                    pass

        return extracted

    # ── Cache management ──────────────────────────────────────────────────────

    def invalidate_cache(self, base_customer_id: str, domain: str) -> None:
        self._cache.pop(f"shared:{base_customer_id}", None)
        self._cache.pop(f"domain:{domain}_{base_customer_id}", None)
