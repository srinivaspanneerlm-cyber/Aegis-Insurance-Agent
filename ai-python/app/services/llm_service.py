from typing import List, Optional, Any, Tuple
import json
import time
import asyncio
import google.generativeai as genai
from openai import AsyncOpenAI
from app.config.config import settings
from app.utils import metrics
from app.utils.logger import logger
from app.utils.premium_calculator import calculate_premium


def _openai_usage(response: Any) -> Tuple[int, int]:
    """(prompt_tokens, completion_tokens) from an OpenAI-compatible response.
    Best-effort — Ollama's OpenAI-compat endpoint may omit usage entirely."""
    usage = getattr(response, "usage", None)
    if not usage:
        return (0, 0)
    return (getattr(usage, "prompt_tokens", 0) or 0, getattr(usage, "completion_tokens", 0) or 0)


def _gemini_usage(response: Any) -> Tuple[int, int]:
    """(prompt_tokens, completion_tokens) from a Gemini response's usage_metadata."""
    meta = getattr(response, "usage_metadata", None)
    if not meta:
        return (0, 0)
    return (getattr(meta, "prompt_token_count", 0) or 0, getattr(meta, "candidates_token_count", 0) or 0)


class LLMService:
    """
    LLM provider abstraction — supports Ollama (local), Gemini, and OpenAI.
    Set DEFAULT_PROVIDER in .env to switch between them.
    """

    def __init__(self):
        self.provider = settings.active_provider
        self.gemini_configured = False
        self.openai_configured = False
        self.ollama_configured = False
        self.openai_client = None  # reused for both OpenAI and Ollama (OpenAI-compat API)

        try:
            if self.provider == "ollama":
                self.openai_client = AsyncOpenAI(
                    base_url=f"{settings.OLLAMA_BASE_URL}/v1",
                    api_key=settings.OLLAMA_API_KEY,
                )
                self.ollama_configured = True
                logger.info(
                    f"Ollama client configured: {settings.OLLAMA_BASE_URL} | model: {settings.OLLAMA_MODEL}"
                )

            elif self.provider == "gemini":
                if settings.GEMINI_API_KEY:
                    genai.configure(api_key=settings.GEMINI_API_KEY)
                    self.gemini_configured = True
                    logger.info("Gemini API client configured successfully.")
                else:
                    logger.warning("GEMINI_API_KEY missing — Gemini will run in offline fallback mode.")

            elif self.provider == "openai":
                if settings.OPENAI_API_KEY:
                    self.openai_client = AsyncOpenAI(api_key=settings.OPENAI_API_KEY)
                    self.openai_configured = True
                    logger.info("OpenAI API client configured successfully.")
                else:
                    logger.warning("OPENAI_API_KEY missing — OpenAI will run in offline fallback mode.")

            else:
                logger.error(f"Unknown provider: {self.provider}")

        except Exception as e:
            logger.error(f"Error initializing LLM client: {e}. Fallback active.")

    async def generate_response(
        self,
        system_prompt: str,
        user_message: str,
        history: Optional[List] = None,
        tools: Optional[List] = None,
    ) -> str:
        """Generate a response from the configured LLM provider."""

        # Time and count the LLM call by provider (8.2). Observation only —
        # the reply and any exception pass through unchanged.
        start = time.perf_counter()
        try:
            if self.provider == "ollama":
                reply = await self._call_ollama(system_prompt, user_message, history, tools)
            elif self.provider == "gemini":
                reply = await self._call_gemini(system_prompt, user_message, history, tools)
            elif self.provider == "openai":
                reply = await self._call_openai(system_prompt, user_message, history, tools)
            else:
                raise ValueError(f"Unsupported provider: {self.provider}")
        except Exception:
            metrics.observe_llm_call(self.provider, "error", time.perf_counter() - start)
            raise

        metrics.observe_llm_call(self.provider, "success", time.perf_counter() - start)
        return reply

    # ── Ollama ────────────────────────────────────────────────────────────────

    async def _call_ollama(
        self,
        system_prompt: str,
        user_message: str,
        history: Optional[List],
        tools: Optional[List],
    ) -> str:
        if not self.ollama_configured or self.openai_client is None:
            raise ValueError("Ollama client is not configured.")

        logger.info(f"Invoking Ollama model: {settings.OLLAMA_MODEL}")

        messages = [{"role": "system", "content": system_prompt}]
        if history:
            for turn in history:
                sender  = turn.get("sender") or turn.get("role", "user")
                content = turn.get("message") or turn.get("content", "")
                if not content:
                    continue
                role = "user" if sender in ["customer", "user"] else "assistant"
                messages.append({"role": role, "content": content})
        messages.append({"role": "user", "content": user_message})

        response = await self.openai_client.chat.completions.create(
            model=settings.OLLAMA_MODEL,
            messages=messages,
            temperature=0.3,
        )
        logger.info("Ollama response resolved.")
        metrics.record_llm_tokens("ollama", *_openai_usage(response))
        return response.choices[0].message.content or ""

    # ── Gemini ────────────────────────────────────────────────────────────────

    async def _call_gemini(
        self,
        system_prompt: str,
        user_message: str,
        history: Optional[List],
        tools: Optional[List],
    ) -> str:
        if not self.gemini_configured:
            raise ValueError("Gemini client is not configured (missing API key).")

        logger.info("Invoking Gemini (gemini-2.5-flash)...")

        model = genai.GenerativeModel(
            model_name="gemini-2.5-flash",
            system_instruction=system_prompt,
            tools=tools,
        )

        formatted_context = ""
        if history:
            for turn in history:
                sender  = turn.get("sender") or turn.get("role", "user")
                content = turn.get("message") or turn.get("content", "")
                if not content:
                    continue
                sender_label = "Customer" if sender in ["customer", "user"] else "Aegis Advisor"
                formatted_context += f"{sender_label}: {content}\n\n"

        final_prompt = f"{formatted_context}Customer: {user_message}\n\nAegis Advisor:"

        max_retries   = 5
        backoff_factor = 2.0
        delay          = 4.0

        for attempt in range(max_retries):
            try:
                if tools:
                    chat     = model.start_chat(enable_automatic_function_calling=True)
                    loop     = asyncio.get_event_loop()
                    response = await loop.run_in_executor(None, lambda: chat.send_message(final_prompt))
                    logger.info("Gemini tool call response resolved.")
                    metrics.record_llm_tokens("gemini", *_gemini_usage(response))
                    return response.text
                else:
                    response = await model.generate_content_async(final_prompt)
                    logger.info("Gemini response resolved.")
                    metrics.record_llm_tokens("gemini", *_gemini_usage(response))
                    return response.text
            except Exception as e:
                err_msg = str(e)
                if "429" in err_msg or "quota" in err_msg.lower() or "limit" in err_msg.lower():
                    if attempt < max_retries - 1:
                        logger.warning(
                            f"Gemini rate limited (429). Retrying in {delay}s "
                            f"(attempt {attempt + 1}/{max_retries})..."
                        )
                        await asyncio.sleep(delay)
                        delay *= backoff_factor
                        continue
                raise e

    # ── OpenAI ────────────────────────────────────────────────────────────────

    async def _call_openai(
        self,
        system_prompt: str,
        user_message: str,
        history: Optional[List],
        tools: Optional[List],
    ) -> str:
        if not self.openai_configured or self.openai_client is None:
            raise ValueError("OpenAI client is not configured (missing API key).")

        logger.info("Invoking OpenAI gpt-4o...")

        messages = [{"role": "system", "content": system_prompt}]
        if history:
            for turn in history:
                sender  = turn.get("sender") or turn.get("role", "user")
                content = turn.get("message") or turn.get("content", "")
                if not content:
                    continue
                role = "user" if sender in ["customer", "user"] else "assistant"
                messages.append({"role": role, "content": content})
        messages.append({"role": "user", "content": user_message})

        openai_tools = None
        if tools:
            openai_tools = [
                {
                    "type": "function",
                    "function": {
                        "name": tool.__name__,
                        "description": tool.__doc__ or "Dynamic premium calculator.",
                        "parameters": {
                            "type": "object",
                            "properties": {
                                "age":       {"type": "integer", "description": "Age of the primary insured."},
                                "coverage":  {"type": "string",  "description": "Coverage limit, e.g. '₹5 Lakh Cover'."},
                                "plan_name": {"type": "string",  "description": "Name of the insurance plan."},
                            },
                            "required": ["age", "coverage", "plan_name"],
                        },
                    },
                }
                for tool in tools
            ]

        response = await self.openai_client.chat.completions.create(
            model="gpt-4o",
            messages=messages,
            tools=openai_tools,
            temperature=0.3,
        )

        metrics.record_llm_tokens("openai", *_openai_usage(response))
        tool_calls = response.choices[0].message.tool_calls
        if tool_calls:
            logger.info("OpenAI: processing tool calls...")
            messages.append(response.choices[0].message)
            for tc in tool_calls:
                if tc.function.name == "calculate_premium":
                    args = json.loads(tc.function.arguments)
                    result = calculate_premium(
                        age=int(args.get("age", 35)),
                        coverage=args.get("coverage", "₹1 Crore Cover"),
                        plan_name=args.get("plan_name", "Aegis Supreme Health Shield"),
                    )
                    messages.append({
                        "role": "tool",
                        "tool_call_id": tc.id,
                        "content": json.dumps(result),
                    })
            second = await self.openai_client.chat.completions.create(
                model="gpt-4o",
                messages=messages,
                temperature=0.3,
            )
            logger.info("OpenAI tool call resolved.")
            metrics.record_llm_tokens("openai", *_openai_usage(second))
            return second.choices[0].message.content or ""
        else:
            logger.info("OpenAI response resolved.")
            return response.choices[0].message.content or ""


# ── Singleton ─────────────────────────────────────────────────────────────────

_llm_service: Optional[LLMService] = None

def get_llm_service() -> LLMService:
    """Singleton getter — reuses client connections across requests."""
    global _llm_service
    if _llm_service is None:
        _llm_service = LLMService()
    return _llm_service
