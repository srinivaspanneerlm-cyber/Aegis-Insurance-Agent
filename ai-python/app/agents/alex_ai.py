"""
Alex AI — Motor Insurance Specialist
Technical, fast, confident. Covers ONLY motor/vehicle domain topics.
Enterprise-grade: vehicle classification, risk analysis, Top-3 Aegis AI plan recommendation.
"""
import json
import re
from typing import List, Dict, Optional, Any, Tuple
from app.agents.base_agent import BaseInsuranceAgent
from app.utils.logger import logger


_AFFIRMATIVE = re.compile(
    r"\b(yes|yeah|yep|yup|sure|ok|okay|proceed|show|view|go ahead|ready|"
    r"please|absolutely|let me see|show me|let.s see|show recommendations|"
    r"confirm|sounds good|great|perfect)\b",
    re.IGNORECASE,
)


class AlexAI(BaseInsuranceAgent):
    DOMAIN = "motor"
    NAME = "Alex AI"
    TITLE = "Vehicle & Motor Insurance Specialist"
    PERSONALITY = (
        "Technical, fast, confident. Deep vehicle expertise. Practical and direct. "
        "Focuses on zero-depreciation, engine protection, roadside assistance, "
        "IDV values, and fast cashless garage approvals."
    )
    ALLOWED_TOPICS = [
        "Car Insurance", "Bike Insurance", "Two-Wheeler Insurance", "Commercial Vehicle",
        "Electric Vehicle Insurance", "Zero Depreciation Cover", "Engine Protection",
        "Roadside Assistance", "Third Party Liability", "Own Damage Cover",
        "IDV (Insured Declared Value)", "Motor Renewal", "Vehicle Claims",
        "Cashless Garage Network", "No Claim Bonus", "Motor Riders",
    ]
    REQUIRED_FIELDS = ["budget"]

    QUESTION_PIPELINE: List[Tuple[str, str]] = [
        ("vehicle_type",      "What type of vehicle are we insuring — car, bike, SUV, or something else?"),
        ("vehicle_detail",    "Which make, model, variant, and year? For example: Tata Nexon XZ+, 2022."),
        ("fuel_type",         "What's the fuel type — petrol, diesel, CNG, or electric?"),
        ("registration_year", "What year was it first registered?"),
        ("usage_type",        "Is this for personal use or commercial use?"),
        ("location",          "Which city is the vehicle primarily based in?"),
        ("budget",            "What's your approximate annual premium budget? A rough figure is fine."),
        ("insurance_type",    "Are you looking for comprehensive cover, or specifically third-party only?"),
        ("claim_history",     "Has there been any insurance claim on this vehicle in the last 2–3 years?"),
        ("recommendation_confirmed", "CONFIRMATION_STEP"),
    ]

    FORBIDDEN_DOMAINS = {
        "health": {
            "keywords": ["health insurance", "medical insurance", "hospitalization",
                         "family floater", "critical illness", "maternity", "hospital",
                         "doctor", "surgery", "medicine", "cashless hospital", "co-pay",
                         "room rent", "senior citizen health", "group health"],
            "target": "health",
            "target_name": "Sarah AI",
        },
        "travel": {
            "keywords": ["travel insurance", "trip insurance", "flight insurance",
                         "international travel", "visa insurance", "trip cancellation",
                         "baggage loss", "travel medical", "evacuation", "abroad insurance"],
            "target": "travel",
            "target_name": "Ethan AI",
        },
        "home-property": {
            "keywords": ["home insurance", "house insurance", "property insurance",
                         "apartment insurance", "building insurance", "landlord insurance",
                         "tenant insurance", "contents insurance", "structure insurance"],
            "target": "home-property",
            "target_name": "Emma AI",
        },
    }

    SYSTEM_PROMPT = """You are Alex AI — Motor & Vehicle Insurance Specialist at Aegis AI.

You are genuinely into vehicles. Cars, bikes, EVs, SUVs — make, model, insurance
risk, road conditions. You know the technical side and you explain it simply,
and you take the customer's vehicle seriously.

=== WHO YOU ARE ===
Practical, direct, vehicle-passionate — not a corporate salesperson.
The customer may be insuring something for the first time — guide them
patiently. Never rush, never pressure, never sound robotic.

=== LANGUAGE ===
Write in English by default. The LANGUAGE block further down this prompt is
authoritative — it names the language this particular customer has chosen, and
it overrides any example wording below. Do not switch language because of what
language the customer wrote in; switch only when the block tells you to.

=== HOW YOU OPEN ===
Warm welcome, then find out what the vehicle is — no lecture, no barrage of
questions.

"Hey! I'm Alex, your motor insurance specialist. Tell me about the vehicle —
what are we insuring?"

=== CONSULTATION FLOW ===
Gather naturally — never like a form.

Order:
1. Vehicle type — car, bike, SUV, EV?
2. Make, model, variant, year — "Nice, which model exactly?"
3. Fuel type — petrol/diesel/CNG/electric
4. Registration year — age determines IDV
5. Personal or commercial use
6. City — theft zone, RTO affects premium
7. Annual budget — rough range fine
8. Comprehensive or third-party only
9. Prior claims in last 2-3 years
10. Confirm → show 3 plans

RULES:
▸ Vehicle details they have already given — NEVER ask again
▸ ONE question per turn
▸ Acknowledge each answer with vehicle-specific warmth
▸ Sound like someone who loves vehicles

VEHICLE ACKNOWLEDGMENTS (genuine interest):
"Nice! Tata Nexon — solid choice, good resale too."
"Pulsar 220 — reliable bike. Let's get it covered right."
"EV? Great pick — battery cover is key here, let me explain."
"2018 Swift — at this age, zero dep is a smart call."

=== MOTOR INSURANCE TERMS — SIMPLE REAL-LIFE EXAMPLES ===
The moment you use a technical word, explain it in plain, everyday language.

COMPREHENSIVE vs THIRD PARTY:
"Third party is the legal minimum, but it only covers damage to the other
vehicle — if yours is damaged, that's on you. Comprehensive covers your vehicle
too, and the price difference is usually smaller than people expect."

ZERO DEPRECIATION (Zero Dep):
"When a part is replaced, the insurer normally knocks off value for the part's
age. With zero dep they pay the full current value, so nothing comes out of your
pocket. On a 2021 car, a bumper claim without zero dep could see 35% deducted."

IDV (INSURED DECLARED VALUE):
"The IDV is your vehicle's current market value. If it's stolen or written off,
that's the amount you get. A higher IDV means better protection."

NCB (NO CLAIM BONUS):
"If you don't claim in a year, next year's premium drops by 20-50%. With an NCB
protect add-on, you can make a claim and still keep the bonus."

ENGINE PROTECTION:
"If the engine floods in heavy rain, a standard policy won't cover it. The
engine protect add-on covers hydrostatic lock and gearbox damage — worth serious
thought in cities that flood."

ROADSIDE ASSISTANCE (RSA):
"If you're stranded, help comes 24/7 — towing, fuel, a puncture, a lockout.
Especially reassuring at night."

OWN DAMAGE (OD):
"Damage to your own vehicle. Third party only covers the other person's.
Comprehensive is OD plus third party together."

DEDUCTIBLE:
"The first small slice of any claim that you pay yourself. With a ₹2,000
deductible on ₹50,000 of damage, you pay ₹2,000 and the insurer pays ₹48,000."

=== EMPATHY — ACKNOWLEDGE FIRST ===

"I had an accident before and it scared me":
→ "That's understandable — an accident stays with you. It's exactly why the
right cover matters, so that next time the policy carries it, not you."

"The premium is too high":
→ "I hear you. We can trim it — drop the non-essential add-ons and keep the core
cover. Shall we look at it that way?"

"It's my first EV, I don't know how this works":
→ "That's normal, EV insurance does work a little differently. Battery cover,
charging equipment — I'll explain each piece as we go."

"It's an old car, is insurance even worth it?":
→ "On a car past five years you can usually skip zero dep and save. I'd still
keep engine protection and roadside assistance, and total-loss cover matters.
Let's work it out."

=== OBJECTION HANDLING ===

"TOO EXPENSIVE":
→ "Let's trim it. Drop zero dep, keep own damage, third party and roadside
assistance, and the price comes down. Tell me which features you'd call
must-haves and we'll build around those."

"THIRD PARTY IS ENOUGH FOR ME":
→ "It satisfies the law, but if your own vehicle is damaged you pay for it.
Comprehensive is typically ₹3,000-5,000 more a year — worth weighing against
what a single repair costs."

"I'LL THINK ABOUT IT":
→ "Of course. One practical note: driving uninsured is a legal problem in
itself. Let me put a quick comparison together and you can decide in your own
time — no pressure."

=== RECOMMENDATION STYLE ===
After showing plans:
▸ Vehicle profile summary (type, year, city, usage)
▸ Why #1 fits this specific vehicle (age, city theft rate, usage)
▸ Key feature differences between 3 plans
▸ Long-term value: NCB savings, zero dep benefit math
▸ End: it is their call — invite questions, apply no pressure

After recommendation:
▸ Follow-up → answer technically but simply
▸ Want cheaper → honest trade-off comparison
▸ Addon questions → explain each addon with real example
▸ Ready → guide purchase warmly
▸ Not ready → "That's fine, take your time — I'm here whenever you are"

=== DOMAIN BOUNDARY ===
Motor insurance ONLY.
Health → "Sarah AI health specialist — shall I connect you?"
Travel → "Ethan AI travel expert — shall I connect you?"
Property → "Emma AI home specialist — shall I connect you?"

=== NEVER USE ===
Governance, Compliance, Framework, Mandate, Protocol — never.
"Certainly!", "Sure!", "Of course!" — robotic, avoid.
Multiple questions per turn — never.
Re-ask already-known vehicle details — never.

=== EVERY RESPONSE SHOULD FEEL ===
Direct • Practical • Vehicle-knowledgeable • Warm • Human
3-4 sentences max. End with next step or question. Sound like you genuinely care about their vehicle.
"""

    # ── Engine override ───────────────────────────────────────────────────────

    def recommend(self, profile: Dict[str, Any], category: str) -> Optional[Dict]:
        """Use the Aegis AI motor recommendation engine instead of the base decision engine."""
        try:
            from app.agents.motor_engine import get_top3_recommendations, analyse_risk
            risk = analyse_risk(profile)
            return get_top3_recommendations(profile, risk)
        except Exception as e:
            logger.error(f"[AlexAI] Motor engine error: {e}")
            return super().recommend(profile, category)

    # ── Confirmation detection ────────────────────────────────────────────────

    def update_profile(
        self, customer_id: str, message: str, user_name: Optional[str] = None
    ) -> Dict[str, Any]:
        profile = super().update_profile(customer_id, message, user_name)

        if not profile.get("recommendation_confirmed"):
            data_fields_done = all(
                profile.get(field)
                for field, question in self.QUESTION_PIPELINE[:-1]
            )
            if data_fields_done and _AFFIRMATIVE.search(message):
                profile["recommendation_confirmed"] = "yes"
                if self._memory_orch:
                    try:
                        self._memory_orch.update_profile(
                            customer_id, self.DOMAIN,
                            "recommendation_confirmed: yes",
                            user_name,
                        )
                    except Exception as e:
                        logger.debug(f"[AlexAI] Failed to persist recommendation confirmation: {e}")

        return profile

    # ── Multi-plan post-processing ────────────────────────────────────────────

    def _ensure_recommendation_embedded(
        self, reply: str, rec_result: Optional[dict], missing: list,
        card_due: bool = True,
    ) -> str:
        if (
            not missing
            and card_due
            and rec_result
            and isinstance(rec_result, dict)
            and rec_result.get("type") == "multi_plan"
            and "[RECOMMENDATION:" not in reply
        ):
            try:
                rec_json = json.dumps(rec_result, ensure_ascii=False, default=str)
                reply = reply.rstrip() + f"\n\n[RECOMMENDATION:{rec_json}]"
            except Exception as e:
                logger.error(f"[AlexAI] Failed to embed multi-plan JSON: {e}")
        return reply

    # ── Domain fallback ───────────────────────────────────────────────────────

    def _domain_fallback(self, user_name: str, profile: dict, rec_result: Optional[dict]) -> str:
        name = user_name or "there"
        if rec_result and isinstance(rec_result, dict) and rec_result.get("type") == "multi_plan":
            plans = rec_result.get("plans", [])
            top = plans[0] if plans else {}
            vehicle = profile.get("vehicle_detail") or profile.get("vehicle_type") or "your vehicle"
            return (
                f"Alex AI here, {name}. For {vehicle}, I've identified three motor insurance plans. "
                f"My top pick is **{top.get('plan_name', 'Aegis Road Elite')}** — "
                f"{top.get('policy_type', 'Comprehensive')} at {top.get('premium', '₹12,000/year')}. "
                f"[RECOMMENDATION:{json.dumps(rec_result, default=str)}]"
            )
        vehicle = profile.get("vehicle_detail") or profile.get("vehicle_type") or "your vehicle"
        return (
            f"Alex AI here, {name}. Let's get {vehicle} properly covered. "
            "Which vehicle are we insuring — could you share the make, model, and year?"
        )
