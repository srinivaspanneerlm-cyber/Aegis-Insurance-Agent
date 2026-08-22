"""
Real token streaming, and the line between it and the buffered path.

The claim being tested is narrow and easy to fake, so it is worth stating: the
provider must emit incremental output *as it generates*, and this code must not
assemble a reply and cut it up afterwards. The fakes below yield with an await
between pieces, and the tests assert that pieces arrived before the call
returned — a re-chunking implementation cannot pass that.

The other half is what happens when streaming does not work, which is where the
guarantees actually live: a stream that fails before releasing anything must
fall back invisibly, and one that fails *after* must not be answered twice.
"""

import asyncio
import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.services import llm_service as llm_mod
from app.services.llm_service import LLMService
from app.services.token_stream import TokenSink, set_sink


def run(coro):
    return asyncio.run(coro)


def make_service(chain=("ollama",)) -> LLMService:
    """An LLMService with its constructor skipped — no clients, no network."""
    service = LLMService.__new__(LLMService)
    service.chain = list(chain)
    service.provider = service.chain[0]
    service.gemini_configured = True
    service.openai_configured = True
    service.ollama_configured = True
    service.ollama_client = object()
    service.openai_client = object()
    return service


@pytest.fixture(autouse=True)
def no_sink():
    set_sink(None)
    yield
    set_sink(None)


@pytest.fixture
def armed_sink():
    sink = TokenSink()
    sink.arm(agent_name="Sarah AI", agent_domain="health")
    set_sink(sink)
    return sink


class TestTokensAreIncremental:
    def test_pieces_reach_the_sink_while_the_call_is_still_running(self, armed_sink):
        """The distinguishing test: a re-chunker cannot pass it."""
        service = make_service()
        seen_midway = []

        async def fake_stream(provider, system_prompt, user_message, history):
            for piece in ("I ", "would ", "suggest "):
                yield piece
                # What the sink holds *before* the call has finished. Under the
                # old word-batch replay this list would be empty every time,
                # because nothing existed until generation was complete.
                seen_midway.append(armed_sink.released)
                await asyncio.sleep(0)

        service._stream_provider = fake_stream

        reply = run(
            service.generate_response(system_prompt="p", user_message="m", history=None, tools=[])
        )

        assert reply == "I would suggest "
        assert seen_midway == ["I ", "I would ", "I would suggest "]

    def test_the_whole_reply_is_still_returned_for_the_pipeline(self, armed_sink):
        # Streaming is a tee, not a redirect. The recommendation embedder, the
        # plan withholding rule and the memory write all run on this string
        # exactly as they always have.
        service = make_service()

        async def fake_stream(provider, system_prompt, user_message, history):
            for piece in ("Health cover ", "for your family."):
                yield piece

        service._stream_provider = fake_stream
        reply = run(service.generate_response("p", "m", None, []))
        assert reply == "Health cover for your family."
        assert armed_sink.released == reply

    def test_nothing_streams_when_no_sink_is_installed(self):
        # Every non-streamed caller in the codebase — including the executive
        # agent's direct LLM call — takes this path unchanged.
        service = make_service()
        called = []

        async def fake_stream(*args, **kwargs):
            called.append(True)
            yield "should not happen"

        async def fake_dispatch(provider, system_prompt, user_message, history, tools):
            return "buffered reply"

        service._stream_provider = fake_stream
        service._dispatch = fake_dispatch

        assert run(service.generate_response("p", "m", None, [])) == "buffered reply"
        assert called == []

    def test_nothing_streams_when_the_sink_is_disarmed(self, armed_sink):
        armed_sink.disarm()
        service = make_service()

        async def fake_dispatch(provider, system_prompt, user_message, history, tools):
            return "buffered reply"

        service._dispatch = fake_dispatch
        assert run(service.generate_response("p", "m", None, [])) == "buffered reply"
        assert armed_sink.released == ""


class TestWhatCannotStream:
    def test_a_tool_call_never_streams(self, armed_sink):
        # A tool call is a round trip — the model asks for a premium, the
        # calculator answers, the model writes the reply. There is nothing to
        # say until that has happened, and streaming it would emit the request
        # rather than the answer.
        service = make_service()
        assert service._can_stream("ollama", tools=[lambda: None]) is False

        async def fake_dispatch(provider, system_prompt, user_message, history, tools):
            return "after the tool call"

        service._dispatch = fake_dispatch
        reply = run(service.generate_response("p", "m", None, [lambda: None]))
        assert reply == "after the tool call"
        assert armed_sink.released == ""

    def test_every_configured_provider_can_stream_plain_text(self):
        service = make_service()
        for provider in ("ollama", "openai", "gemini"):
            assert service._can_stream(provider, tools=None) is True

    def test_an_unknown_provider_cannot(self):
        assert make_service()._can_stream("something-else", tools=None) is False


class TestFallback:
    def test_a_stream_that_fails_before_any_token_falls_back_invisibly(self, armed_sink):
        service = make_service()

        async def failing_stream(provider, system_prompt, user_message, history):
            raise RuntimeError("provider refused the stream")
            yield  # pragma: no cover — makes this an async generator

        async def fake_dispatch(provider, system_prompt, user_message, history, tools):
            return "the buffered answer"

        service._stream_provider = failing_stream
        service._dispatch = fake_dispatch

        # Nothing was shown, so the turn can simply be answered again properly.
        assert run(service.generate_response("p", "m", None, [])) == "the buffered answer"
        assert armed_sink.released == ""

    def test_a_stream_that_fails_after_releasing_text_is_not_answered_twice(self, armed_sink):
        # Half a sentence is already on the customer's screen. Re-running the
        # turn would produce a different one, and appending it would read as the
        # advisor talking over itself — so this is raised for the agent's own
        # fallback to handle, and the SSE layer corrects the screen.
        service = make_service()
        dispatched = []

        async def dying_stream(provider, system_prompt, user_message, history):
            yield "Our Supreme plan "
            raise RuntimeError("connection dropped mid-generation")

        async def fake_dispatch(provider, system_prompt, user_message, history, tools):
            dispatched.append(True)
            return "should never be reached"

        service._stream_provider = dying_stream
        service._dispatch = fake_dispatch

        with pytest.raises(RuntimeError):
            run(service.generate_response("p", "m", None, []))
        assert armed_sink.released == "Our Supreme plan "
        assert dispatched == []

    def test_an_empty_stream_falls_back_rather_than_returning_nothing(self, armed_sink):
        service = make_service()

        async def silent_stream(provider, system_prompt, user_message, history):
            return
            yield  # pragma: no cover

        async def fake_dispatch(provider, system_prompt, user_message, history, tools):
            return "a real answer"

        service._stream_provider = silent_stream
        service._dispatch = fake_dispatch
        assert run(service.generate_response("p", "m", None, [])) == "a real answer"

    def test_a_fallback_provider_streams_too_when_nothing_was_shown(self, armed_sink):
        # The rule is "nothing released yet", not "first provider in the chain".
        # A deployment whose primary is a local Ollama that happens to be down
        # would otherwise fall through to a perfectly capable hosted provider
        # and never stream from it — losing the whole benefit silently, with
        # every test still green. This is that case.
        service = make_service(chain=("ollama", "gemini"))
        attempts = []

        async def stream_only_on_gemini(provider, system_prompt, user_message, history):
            attempts.append(provider)
            if provider == "ollama":
                raise RuntimeError("ollama is not running")
            yield "Streamed "
            yield "by gemini."

        async def fake_dispatch(provider, system_prompt, user_message, history, tools):
            raise RuntimeError(f"{provider} buffered call also failed")

        service._stream_provider = stream_only_on_gemini
        service._dispatch = fake_dispatch

        assert run(service.generate_response("p", "m", None, [])) == "Streamed by gemini."
        assert attempts == ["ollama", "gemini"]
        assert armed_sink.released == "Streamed by gemini."

    def test_a_provider_that_already_spoke_is_never_replaced(self, armed_sink):
        # The invariant that actually matters. Once words are on screen the turn
        # cannot be started again by somebody else — two different answers to
        # one question, one of them half-said.
        service = make_service(chain=("ollama", "gemini"))
        attempts = []

        async def dying_stream(provider, system_prompt, user_message, history):
            attempts.append(provider)
            yield "Our Supreme plan "
            raise RuntimeError("connection dropped mid-generation")

        async def fake_dispatch(provider, system_prompt, user_message, history, tools):
            return "a second, different answer"

        service._stream_provider = dying_stream
        service._dispatch = fake_dispatch

        with pytest.raises(RuntimeError):
            run(service.generate_response("p", "m", None, []))
        assert attempts == ["ollama"]
        assert armed_sink.released == "Our Supreme plan "


class TestStreamResponseDirectly:
    def test_it_yields_what_the_provider_yields(self):
        service = make_service()

        async def fake_stream(provider, system_prompt, user_message, history):
            for piece in ("a", "b", "c"):
                yield piece

        service._stream_provider = fake_stream

        async def scenario():
            return [p async for p in service.stream_response("p", "m")]

        assert run(scenario()) == ["a", "b", "c"]

    def test_it_refuses_a_request_it_cannot_stream(self):
        service = make_service()

        async def scenario():
            return [p async for p in service.stream_response("p", "m", tools=[lambda: None])]

        with pytest.raises(ValueError):
            run(scenario())
