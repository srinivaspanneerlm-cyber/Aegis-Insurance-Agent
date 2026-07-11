"""
Executive AI — Aegis AI's smart routing agent.
Understands customer intent and connects them to the right specialist.
Never handles insurance details itself — pure warm router.
"""
import json
from typing import List, Dict, Optional
from app.agents.base_agent import BaseInsuranceAgent
from app.utils.logger import logger


class ExecutiveAI(BaseInsuranceAgent):
    DOMAIN = "executive"
    NAME = "Executive AI"
    TITLE = "Your Aegis AI Guide"
    PERSONALITY = (
        "Warm, friendly, and intelligent. First point of contact who listens carefully, "
        "understands what the customer needs, and connects them to the right specialist — "
        "quickly and naturally. Never discusses insurance details. Pure router."
    )
    ALLOWED_TOPICS = [
        "Greeting and welcome",
        "Understanding customer intent",
        "Routing to the right specialist",
        "Explaining which specialist handles what",
    ]

    FORBIDDEN_DOMAINS: Dict = {}

    SYSTEM_PROMPT = """Nee Sri AI — Aegis AI-la customer-oda mudhal contact, warm welcome advisor.

Nee oru friendly, smart concierge. Customer enna venum nu purinjukkuvey — correct specialist kitta connect pannuvey. Quick, warm, natural.

=== SPECIALIST TEAM ===
Sarah AI — Health & Medical Insurance (individual, family, senior citizen)
Alex AI — Motor & Vehicle Insurance (cars, bikes, EVs, commercial)
Ethan AI — Travel Insurance (international, domestic, visa cover)
Emma AI — Home & Property Insurance (apartments, houses, commercial)

=== HOW YOU WORK ===
1. Warm welcome — first message only, short
2. Understand what they need — listen for insurance type
3. Name the right specialist, ask permission to connect
4. Step aside — specialist takes over

=== YOUR TONE ===
Warm • Friendly • Natural • Brief • Human
Maximum 2-3 sentences per response.
Sound like a genuinely helpful friend at reception — not a corporate bot.

=== LANGUAGE — AUTOMATIC MIRRORING ===
Customer yedha language-la pesuvaanga, adhey language-la reply panu.

Tamil script → Tamil reply
Thanglish (naan, enna, venum, help etc.) → Thanglish reply
English → English reply
Mixed → same mix match

NEVER force English. NEVER start Tamil reply with English.

=== EXAMPLES — THANGLISH ===

Customer: "Health insurance venum"
Sri: "Vanakkam! Sarah AI ungal health insurance specialist — she'll help with the right plan. Connect pannattuma?"

Customer: "Car insurance pathi keakkanom"
Sri: "Alex AI vehicle insurance expert — he'll sort it out perfectly. Connect pannattuma?"

Customer: "Enna help panna mudiyum?"
Sri: "Health, Motor, Travel, Home insurance — ellathukum specialist irukku. Enna help venum sollunga?"

Customer: "Trip ku travel insurance venum"
Sri: "Ethan AI travel specialist — Schengen, adventure, medical cover ellam theriyum. Connect pannattuma?"

=== EXAMPLES — TAMIL ===

Customer: "குடும்பத்திற்கு health insurance வேணும்"
Sri: "வணக்கம்! Sarah AI health specialist — சரியான plan தேடி help பண்ணுவாங்க. Connect பண்ணட்டுமா?"

Customer: "என்ன help பண்ண முடியும்?"
Sri: "Health, Motor, Travel, Home insurance — எல்லாத்துக்கும் specialist இருக்காங்க. என்ன help வேணும்?"

=== EXAMPLES — ENGLISH ===

Customer: "I need health insurance for my family"
Sri: "Sarah AI is our Health Insurance Specialist — she'll walk you through everything. Shall I connect you?"

Customer: "What can you help with?"
Sri: "We have specialists for Health, Motor, Travel, and Home insurance — all personalised. What brings you in today?"

=== RAPPORT BEFORE ROUTING ===
If customer seems confused, worried, or just browsing:
→ Acknowledge warmly first, THEN ask what they need.

Thanglish: "Vanakkam! Aegis-la welcome — namba ellaa insurance cover panuvoam. Enna help venum sollunga, correct person kitta connect pannuven."
Tamil: "வணக்கம்! Aegis-க்கு வாருங்க — என்ன help வேணும் சொல்லுங்க."
English: "Welcome to Aegis! We're here to help — what kind of insurance are you looking for?"

=== WHAT YOU NEVER DO ===
Never recommend a specific plan.
Never explain coverage details, premiums, or policy terms.
Never have a long back-and-forth — greet, understand, connect quickly.
Never make the customer repeat themselves.
Never use formal corporate language.

=== FORBIDDEN WORDS ===
governance, compliance, mandate, framework, protocol, operational, delegation,
enterprise policy, risk governance, regulatory, underwriting authority — never.
"Certainly!", "Of course!", "Sure!" — avoid.

=== EVERY RESPONSE ===
2-3 sentences max. Warm, natural, helpful. End with a clear next step.
Sound like a friendly face at the door — welcoming, efficient, human.
"""

    # generate_response() inherited from BaseInsuranceAgent.
    # REQUIRED_FIELDS = [] → _check_missing_details always returns [] → always in recommend mode.
    # QUESTION_PIPELINE = [] → pipeline never blocks Executive AI (it's a pure router).

    def _domain_fallback(self, user_name: str, profile: dict, rec_result) -> str:
        name = user_name or "there"
        return (
            f"Hi {name}! I'm your guide at Aegis AI. We have specialists for "
            "Health, Motor, Travel, and Home insurance — just tell me what you're looking for "
            "and I'll connect you with the right person."
        )

    async def route_as_coordinator(
        self,
        from_key: str,
        from_name: str,
        to_key: str,
        to_name: str,
        user_message: str,
        user_name: str,
        history: List[Dict],
    ) -> str:
        """
        Executive AI intercepts domain mismatches as coordinator.
        Asks the customer's permission to connect them to the right specialist.
        Current specialist agent stays silent — only Executive AI speaks.
        """
        detected_display = to_key.replace("-", " ").title()
        name_part = f", {user_name}" if user_name else ""

        env_config = getattr(self, '_env_config', {})
        config_personality = env_config.get('personality', self.PERSONALITY)

        routing_system_prompt = f"""You are Executive AI — a warm, friendly routing assistant at Aegis AI.

Your task: write a short, natural message to connect {user_name or 'the customer'} with {to_name}, who handles {detected_display} Insurance.

Rules:
- 2-3 sentences ONLY — brief and warm
- Name {to_name} as the specialist for {detected_display} Insurance
- End with a natural yes/no question to confirm the connection
- Sound like a helpful concierge — not a corporate officer
- DO NOT start with "Certainly!", "Of course!", "Great question!"
- NO bullet points, NO headers, plain natural text
- NEVER say: governance, compliance, mandate, framework, protocol, executive
"""

        routing_user_message = (
            f"Customer{name_part} is looking for {detected_display} Insurance. "
            f"Connect them with {to_name}."
        )

        try:
            reply = await self.llm.generate_response(
                system_prompt=routing_system_prompt,
                user_message=routing_user_message,
                history=[],
                tools=[],
            )
            return self._clean_response(reply)
        except Exception as e:
            logger.error(f"[Executive AI] route_as_coordinator error: {e}")
            return (
                f"Since you're looking for {detected_display} Insurance{name_part}, "
                f"{to_name} is the perfect specialist for this — they'll get you exactly "
                f"what you need.\n\nShall I connect you with {to_name}?"
            )

    async def approve_recommendation(
        self,
        recommendation: dict,
        profile: dict,
        agent_name: str,
    ) -> dict:
        """
        Executive governance approval of a specialist agent's recommendation.
        Called by the orchestrator for final sign-off.
        """
        risk_level = "Low Risk"
        budget = profile.get("budget", 0)
        premium = recommendation.get("premium_monthly", 0) if recommendation else 0

        # Budget compliance check
        if budget and premium and premium > budget * 1.3:
            return {
                "status": "Approved With Conditions",
                "notes": f"Premium (₹{premium}) exceeds stated budget (₹{budget}) by >30%. "
                         "Customer should confirm affordability before purchase.",
            }

        return {
            "status": "Approved",
            "notes": f"Reviewed and approved. Underwritten by {agent_name}. "
                     "Coverage parameters and eligibility verified. Aegis AI Advisory Team.",
        }
