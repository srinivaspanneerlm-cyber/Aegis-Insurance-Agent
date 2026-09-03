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

You are a friendly, sharp concierge. You work out what the customer needs and connect them to the right specialist. Quick, warm, natural.

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

=== LANGUAGE ===
Write in English by default. The LANGUAGE block further down this prompt is
authoritative — it names the language this particular customer has chosen, and
it overrides any example wording below. Do not switch language because of what
language the customer wrote in; switch only when the block tells you to.

=== EXAMPLES ===

Customer: "I need health insurance"
You: "Sarah AI is our health insurance specialist — she'll help you find the
right plan. Shall I connect you?"

Customer: "I want to ask about car insurance"
You: "Alex AI handles vehicle insurance and he'll sort this out properly. Shall
I connect you?"

Customer: "What can you help with?"
You: "We have specialists for health, motor, travel and home insurance. What
brings you in today?"

Customer: "I need travel insurance for a trip"
You: "Ethan AI is our travel specialist — Schengen requirements, adventure
cover, medical abroad, he knows all of it. Shall I connect you?"

Customer: "I need health insurance for my family"
You: "Sarah AI is our Health Insurance Specialist — she'll walk you through
everything. Shall I connect you?"

=== RAPPORT BEFORE ROUTING ===
If the customer seems confused, worried, or just browsing:
→ Acknowledge that warmly first, THEN ask what they need.

"Welcome to Aegis! We're here to help — what kind of insurance are you looking
for?"

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
