from typing import AsyncGenerator, List, Optional, Any, Tuple
import json
import time
import asyncio
import google.generativeai as genai
from openai import (
    AsyncOpenAI,
    APITimeoutError,
    APIConnectionError,
    RateLimitError,
    InternalServerError,
)
from app.config.config import settings
from app.services.token_stream import current_sink, streaming_wanted
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


# Transient failures worth one bounded retry: the request timed out, the
# connection dropped, or the provider is briefly overloaded (5xx) or rate
# limiting (429 — openai.RateLimitError covers this for Ollama/OpenAI; the
# Gemini path already has its own dedicated 429 handling below). Deliberately
# excludes auth failures, bad input and unknown models — retrying those wastes
# the attempt budget on something that will fail identically every time and
# only delays the safe fallback the caller is going to reach anyway.
_TRANSIENT_OPENAI_ERRORS: Tuple[type, ...] = (
    APITimeoutError,
    APIConnectionError,
    RateLimitError,
    InternalServerError,
)


async def _create_chat_completion(client: AsyncOpenAI, **kwargs: Any) -> Any:
    """
    `client.chat.completions.create(**kwargs)`, with a small, bounded retry.

    Used for both Ollama and OpenAI — both speak the OpenAI-compatible API, so
    one retry policy covers both. Never infinite: `LLM_CALL_MAX_ATTEMPTS` is a
    hard ceiling, and a non-transient error (bad request, auth, unknown model)
    is re-raised on the first attempt rather than retried.
    """
    attempts = max(1, settings.LLM_CALL_MAX_ATTEMPTS)
    delay = 1.5
    for attempt in range(attempts):
        try:
            return await client.chat.completions.create(**kwargs)
        except _TRANSIENT_OPENAI_ERRORS as e:
            if attempt >= attempts - 1:
                raise
            logger.warning(
                f"LLM call transient failure ({type(e).__name__}: {e}), "
                f"retrying — attempt {attempt + 2} of {attempts}..."
            )
            await asyncio.sleep(delay)
            delay *= 2


class LLMService:
    """
    LLM provider abstraction — supports Ollama (local), Gemini, and OpenAI.
    Set DEFAULT_PROVIDER in .env to choose which one answers first, and
    LLM_FALLBACK_PROVIDERS to say who answers if that one cannot.

    Every provider in the chain is configured up front, because the point of a
    fallback is to be ready at the moment the primary fails — building its
    client only then would mean the first failed turn is also the turn that
    discovers the key is missing.
    """

    def __init__(self):
        self.chain = settings.provider_chain
        # The provider that answers first. Kept as `.provider` because that is
        # what this object has always exposed.
        self.provider = self.chain[0]
        self.gemini_configured = False
        self.openai_configured = False
        self.ollama_configured = False
        # Ollama speaks the OpenAI-compatible API, so both use the same SDK —
        # but they need separate clients, pointed at different hosts with
        # different keys. One shared attribute would mean whichever was
        # configured second silently answered for both.
        self.ollama_client: Optional[AsyncOpenAI] = None
        self.openai_client: Optional[AsyncOpenAI] = None

        for provider in self.chain:
            try:
                if provider == "ollama":
                    self.ollama_client = AsyncOpenAI(
                        base_url=f"{settings.OLLAMA_BASE_URL}/v1",
                        api_key=settings.OLLAMA_API_KEY,
                        timeout=settings.LLM_CALL_TIMEOUT_SECONDS,
                    )
                    self.ollama_configured = True
                    logger.info(
                        f"Ollama client configured: {settings.OLLAMA_BASE_URL} | model: {settings.OLLAMA_MODEL}"
                    )

                elif provider == "gemini":
                    if settings.GEMINI_API_KEY:
                        genai.configure(api_key=settings.GEMINI_API_KEY)
                        self.gemini_configured = True
                        logger.info("Gemini API client configured successfully.")
                    else:
                        logger.warning("GEMINI_API_KEY missing — Gemini will run in offline fallback mode.")

                elif provider == "openai":
                    if settings.OPENAI_API_KEY:
                        self.openai_client = AsyncOpenAI(
                            api_key=settings.OPENAI_API_KEY,
                            timeout=settings.LLM_CALL_TIMEOUT_SECONDS,
                        )
                        self.openai_configured = True
                        logger.info("OpenAI API client configured successfully.")
                    else:
                        logger.warning("OPENAI_API_KEY missing — OpenAI will run in offline fallback mode.")

                else:
                    logger.error(f"Unknown provider: {provider}")

            except Exception as e:
                # One provider failing to initialise must not take the others
                # with it — a bad OLLAMA_BASE_URL should still leave Gemini
                # able to answer.
                logger.error(f"Error initializing {provider} client: {e}. Remaining providers unaffected.")

        if len(self.chain) > 1:
            logger.info(f"LLM provider chain: {' → '.join(self.chain)}")
        else:
            logger.warning(
                f"LLM provider chain: {self.chain[0]} only — no fallback configured. "
                "Set GEMINI_API_KEY (or OPENAI_API_KEY) so a failed turn can still be answered."
            )

    async def _dispatch(
        self,
        provider: str,
        system_prompt: str,
        user_message: str,
        history: Optional[List],
        tools: Optional[List],
    ) -> str:
        """Route one attempt to the named provider."""
        if provider == "ollama":
            return await self._call_ollama(system_prompt, user_message, history, tools)
        if provider == "gemini":
            return await self._call_gemini(system_prompt, user_message, history, tools)
        if provider == "openai":
            return await self._call_openai(system_prompt, user_message, history, tools)
        raise ValueError(f"Unsupported provider: {provider}")

    # ── Streaming ─────────────────────────────────────────────────────────────
    #
    # A sibling of the three `_call_*` methods above, not a replacement for
    # them. Each one asks its provider for incremental output and yields what
    # arrives; none of them assembles a reply first and cuts it up afterwards,
    # which is the thing the SSE layer used to do and the reason a customer
    # waited out the whole generation in silence.
    #
    # Tools are the one case that never streams. A tool call is a round trip —
    # the model asks for a premium, the calculator answers, the model writes the
    # reply — and there is nothing to say until that has happened. Streaming it
    # would emit the request, not the answer.

    def _can_stream(self, provider: str, tools: Optional[List]) -> bool:
        if tools:
            return False
        return provider in ("ollama", "openai", "gemini")

    async def _stream_openai_compatible(
        self,
        client: AsyncOpenAI,
        model: str,
        system_prompt: str,
        user_message: str,
        history: Optional[List],
    ) -> AsyncGenerator[str, None]:
        """Ollama and OpenAI both speak this; one implementation covers both."""
        messages = [{"role": "system", "content": system_prompt}]
        if history:
            for turn in history:
                sender = turn.get("sender") or turn.get("role", "user")
                content = turn.get("message") or turn.get("content", "")
                if not content:
                    continue
                role = "user" if sender in ["customer", "user"] else "assistant"
                messages.append({"role": role, "content": content})
        messages.append({"role": "user", "content": user_message})

        stream = await client.chat.completions.create(
            model=model,
            messages=messages,
            temperature=0.3,
            stream=True,
            # Ollama's OpenAI-compatible endpoint omits usage unless asked, and
            # without it a streamed turn would silently stop being counted.
            stream_options={"include_usage": True},
        )

        prompt_tokens = completion_tokens = 0
        async for chunk in stream:
            usage = getattr(chunk, "usage", None)
            if usage:
                prompt_tokens = getattr(usage, "prompt_tokens", 0) or prompt_tokens
                completion_tokens = getattr(usage, "completion_tokens", 0) or completion_tokens
            choices = getattr(chunk, "choices", None)
            if not choices:
                continue
            delta = getattr(choices[0], "delta", None)
            piece = getattr(delta, "content", None) if delta else None
            if piece:
                yield piece

        if prompt_tokens or completion_tokens:
            metrics.record_llm_tokens(
                "openai" if client is self.openai_client else "ollama",
                prompt_tokens,
                completion_tokens,
            )

    async def _stream_gemini(
        self,
        system_prompt: str,
        user_message: str,
        history: Optional[List],
    ) -> AsyncGenerator[str, None]:
        if not self.gemini_configured:
            raise ValueError("Gemini client is not configured (missing API key).")

        model = genai.GenerativeModel(
            model_name=settings.GEMINI_MODEL,
            system_instruction=system_prompt,
        )

        formatted_context = ""
        if history:
            for turn in history:
                sender = turn.get("sender") or turn.get("role", "user")
                content = turn.get("message") or turn.get("content", "")
                if not content:
                    continue
                sender_label = "Customer" if sender in ["customer", "user"] else "Aegis Advisor"
                formatted_context += f"{sender_label}: {content}\n\n"

        final_prompt = f"{formatted_context}Customer: {user_message}\n\nAegis Advisor:"

        response = await model.generate_content_async(
            final_prompt,
            stream=True,
            request_options={"timeout": settings.LLM_CALL_TIMEOUT_SECONDS},
        )

        last = None
        async for chunk in response:
            last = chunk
            try:
                piece = chunk.text
            except Exception:  # noqa: BLE001 — a blocked or empty candidate
                piece = ""
            if piece:
                yield piece
        if last is not None:
            metrics.record_llm_tokens("gemini", *_gemini_usage(last))

    async def _stream_provider(
        self,
        provider: str,
        system_prompt: str,
        user_message: str,
        history: Optional[List],
    ) -> AsyncGenerator[str, None]:
        """Route one streaming attempt to the named provider."""
        if provider == "ollama":
            if not self.ollama_configured or self.ollama_client is None:
                raise ValueError("Ollama client is not configured.")
            logger.info(f"Streaming from Ollama model: {settings.OLLAMA_MODEL}")
            async for piece in self._stream_openai_compatible(
                self.ollama_client, settings.OLLAMA_MODEL, system_prompt, user_message, history
            ):
                yield piece
            return
        if provider == "openai":
            if not self.openai_configured or self.openai_client is None:
                raise ValueError("OpenAI client is not configured (missing API key).")
            logger.info("Streaming from OpenAI gpt-4o...")
            async for piece in self._stream_openai_compatible(
                self.openai_client, "gpt-4o", system_prompt, user_message, history
            ):
                yield piece
            return
        if provider == "gemini":
            logger.info(f"Streaming from Gemini ({settings.GEMINI_MODEL})...")
            async for piece in self._stream_gemini(system_prompt, user_message, history):
                yield piece
            return
        raise ValueError(f"Unsupported streaming provider: {provider}")

    async def stream_response(
        self,
        system_prompt: str,
        user_message: str,
        history: Optional[List] = None,
        tools: Optional[List] = None,
    ) -> AsyncGenerator[str, None]:
        """
        The same turn as `generate_response`, delivered as it is written.

        Public and usable on its own, but in practice reached through
        `generate_response` below, which streams into the request's sink while
        still returning the whole reply — so every caller in the pipeline keeps
        the contract it already has.

        Deliberately no provider chain. A fallback exists to answer a turn the
        primary could not, and a turn that has already put half a sentence on
        the customer's screen cannot be answered again from the start by
        somebody else. Failing here hands the turn back to the buffered path,
        which has the chain and can start over cleanly.
        """
        provider = self.chain[0]
        if not self._can_stream(provider, tools):
            raise ValueError(f"Provider '{provider}' cannot stream this request.")
        async for piece in self._stream_provider(provider, system_prompt, user_message, history):
            yield piece

    async def _generate_streamed(
        self,
        provider: str,
        system_prompt: str,
        user_message: str,
        history: Optional[List],
        sink: Any,
    ) -> str:
        """
        Stream to the sink and return the assembled reply.

        The return value is the point. Everything downstream — the
        recommendation embedder, the plan withholding rule, the response
        cleaner, the memory write — runs on this string exactly as it always
        has. The streaming happened on the way past.
        """
        started = time.perf_counter()
        first_token_at: Optional[float] = None
        pieces: List[str] = []

        async for piece in self._stream_provider(provider, system_prompt, user_message, history):
            if first_token_at is None:
                first_token_at = time.perf_counter()
                metrics.observe_stream_ttft(provider, first_token_at - started)
            pieces.append(piece)
            sink.emit(piece)

        reply = "".join(pieces)
        if not reply.strip():
            # A stream that produced nothing is not an answer. Raised so the
            # caller falls back to the buffered path rather than passing an
            # empty string down a pipeline that will have to invent something.
            raise ValueError("Streaming produced no content.")
        return reply

    async def generate_response(
        self,
        system_prompt: str,
        user_message: str,
        history: Optional[List] = None,
        tools: Optional[List] = None,
    ) -> str:
        """Generate a response, falling through the provider chain on failure.

        The whole turn — system prompt, history and message — is handed to each
        provider in turn, so a fallback answers with exactly the context the
        primary had. The customer sees a reply to what they actually asked;
        nothing about the switch reaches the conversation.

        Only if every provider fails does this raise, and it raises the last
        provider's error, which is the most recent true account of why no
        answer was produced.
        """
        last_error: Optional[BaseException] = None

        # A sink is present only on a streamed request, and armed only on turns
        # whose whole-reply guardrails cannot rewrite what the model writes —
        # see `BaseInsuranceAgent.generate_response`. Everywhere else this is
        # None and the loop below is the code that has always run.
        sink = current_sink() if streaming_wanted() else None

        for index, provider in enumerate(self.chain):
            is_last = index == len(self.chain) - 1
            # Time and count the LLM call by provider (8.2). Observation only —
            # the reply and any exception pass through unchanged.
            start = time.perf_counter()
            try:
                # Streaming is attempted by whichever provider is answering, for
                # as long as nothing has been shown to the customer yet.
                #
                # The invariant is `has_released`, not the position in the
                # chain. Pinning it to the first provider looked equivalent and
                # is not: a deployment whose primary is a local Ollama that
                # happens to be down would fall through to a perfectly capable
                # hosted provider and then never stream from it, quietly losing
                # the entire benefit while every test still passed. What must
                # never happen is restarting a turn that has already put words
                # on screen — and that is exactly what `has_released` says.
                if sink is not None and not sink.has_released and self._can_stream(provider, tools):
                    try:
                        reply = await self._generate_streamed(
                            provider, system_prompt, user_message, history, sink
                        )
                        metrics.observe_llm_call(provider, "success", time.perf_counter() - start)
                        return reply
                    except Exception as stream_error:
                        if sink.has_released:
                            # Half a sentence is already on screen. Re-running
                            # the turn would produce a different one, so this is
                            # the caller's failure to handle, not ours to paper
                            # over with a second answer.
                            metrics.observe_llm_call(provider, "error", time.perf_counter() - start)
                            raise
                        logger.warning(
                            f"Streaming from '{provider}' failed before any token "
                            f"({type(stream_error).__name__}: {stream_error}) — "
                            "falling back to the buffered call for this turn."
                        )
                        start = time.perf_counter()

                call = self._dispatch(provider, system_prompt, user_message, history, tools)
                # A provider with someone behind it gets a deadline, so a hang
                # cannot eat the budget its fallback needs. The last one has
                # nobody behind it and runs to its own policy.
                if is_last:
                    reply = await call
                else:
                    reply = await asyncio.wait_for(call, timeout=settings.LLM_PROVIDER_BUDGET_SECONDS)
            except Exception as e:
                metrics.observe_llm_call(provider, "error", time.perf_counter() - start)
                last_error = e
                if is_last:
                    raise
                if sink is not None and sink.has_released:
                    # Part of an answer is already on the customer's screen, and
                    # being read aloud. The fallback chain exists to answer a
                    # turn nobody answered — not to give a second, different
                    # answer to one that is half-said. The turn ends here and
                    # the agent's own fallback corrects it.
                    logger.warning(
                        f"LLM provider '{provider}' failed after streaming "
                        f"{len(sink.released)} characters — not retrying with a "
                        "fallback, because the customer already has part of this answer."
                    )
                    raise
                logger.warning(
                    f"LLM provider '{provider}' failed ({type(e).__name__}: {e}) — "
                    f"falling back to '{self.chain[index + 1]}' for this turn."
                )
                continue

            metrics.observe_llm_call(provider, "success", time.perf_counter() - start)
            if index > 0:
                logger.warning(f"Turn answered by fallback provider '{provider}'.")
            return reply

        # Unreachable: a non-empty chain either returns or re-raises on its
        # last provider. Kept so the function never returns None if that
        # invariant is ever broken.
        raise last_error or ValueError("No LLM provider configured.")

    # ── Ollama ────────────────────────────────────────────────────────────────

    async def _call_ollama(
        self,
        system_prompt: str,
        user_message: str,
        history: Optional[List],
        tools: Optional[List],
    ) -> str:
        if not self.ollama_configured or self.ollama_client is None:
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

        response = await _create_chat_completion(
            self.ollama_client,
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

        logger.info(f"Invoking Gemini ({settings.GEMINI_MODEL})...")

        model = genai.GenerativeModel(
            model_name=settings.GEMINI_MODEL,
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

        # The same bounded policy the OpenAI-compatible path uses. This loop
        # used to allow 5 attempts with a doubling 4s backoff, which on a
        # rate-limited key spends over a minute sleeping — long past the 45s
        # the Node backend waits for, so the customer sees a timeout and the
        # eventual answer arrives to nobody. The delay is capped for the same
        # reason: a retry that lands after the caller has given up is not a
        # retry.
        max_retries    = max(1, settings.LLM_CALL_MAX_ATTEMPTS)
        backoff_factor = 2.0
        max_delay      = 8.0
        delay          = 4.0

        for attempt in range(max_retries):
            try:
                if tools:
                    chat     = model.start_chat(enable_automatic_function_calling=True)
                    loop     = asyncio.get_event_loop()
                    response = await loop.run_in_executor(
                        None,
                        lambda: chat.send_message(
                            final_prompt,
                            request_options={"timeout": settings.LLM_CALL_TIMEOUT_SECONDS},
                        ),
                    )
                    logger.info("Gemini tool call response resolved.")
                    metrics.record_llm_tokens("gemini", *_gemini_usage(response))
                    return response.text
                else:
                    response = await model.generate_content_async(
                        final_prompt,
                        request_options={"timeout": settings.LLM_CALL_TIMEOUT_SECONDS},
                    )
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
                        delay = min(delay * backoff_factor, max_delay)
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

        response = await _create_chat_completion(
            self.openai_client,
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
                    try:
                        args = json.loads(tc.function.arguments)
                    except (json.JSONDecodeError, TypeError) as e:
                        # The model's own function-call arguments, not a
                        # value this codebase controls — malformed output is
                        # a real possibility, not a hypothetical. Falls back
                        # to calculate_premium's own defaults rather than
                        # raising and losing the whole reply over one bad
                        # argument string.
                        logger.warning(f"Malformed tool-call arguments from model: {e}")
                        args = {}
                    try:
                        age = int(args.get("age", 35))
                    except (TypeError, ValueError):
                        # Same reasoning as the JSON guard above: `age` is
                        # whatever the model put in the argument string, and
                        # int() on "unknown" or a list raises. One bad field
                        # should not lose the whole tool call.
                        age = 35
                    coverage = args.get("coverage", "₹1 Crore Cover")
                    plan_name = args.get("plan_name", "Aegis Supreme Health Shield")
                    result = calculate_premium(
                        age=age,
                        # calculate_premium calls .lower() on this; a model
                        # that returns a number or a list here (both valid
                        # JSON) would raise AttributeError otherwise.
                        coverage=coverage if isinstance(coverage, str) else "₹1 Crore Cover",
                        plan_name=plan_name if isinstance(plan_name, str) else "Aegis Supreme Health Shield",
                    )
                    messages.append({
                        "role": "tool",
                        "tool_call_id": tc.id,
                        "content": json.dumps(result),
                    })
            second = await _create_chat_completion(
                self.openai_client,
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
