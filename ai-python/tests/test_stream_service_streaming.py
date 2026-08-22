"""
The SSE stream, end to end, with a fake orchestrator standing in for the turn.

This is the test that proves the plumbing actually connects: the sink is
installed before the orchestrator task is created, `create_task` copies the
context, and a token emitted from inside the dispatch — where the real LLM call
lives, six frames down — comes out of this generator as an SSE event while the
turn is still running.

It also pins the event *order*, which is not decoration. The browser keys off
`agent_info` to move from "thinking" to "answering", and a token that arrives
before one has no advisor to be attributed to.
"""

import asyncio
import json
import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.services import stream_service
from app.services.token_stream import current_sink


def events(raw: list) -> list:
    """The SSE frames, parsed."""
    out = []
    for frame in raw:
        for line in frame.split("\n"):
            if line.startswith("data: "):
                out.append(json.loads(line[6:]))
    return out


def types(parsed: list) -> list:
    return [e["type"] for e in parsed]


def text_of(parsed: list) -> str:
    return "".join(e["text"] for e in parsed if e["type"] == "token")


class FakeOrchestrator:
    """
    Stands in for `CentralOrchestrator`, emitting into whatever sink the context
    holds — exactly as `LLMService` does on a real streamed turn.
    """

    def __init__(self, pieces=(), reply=None, arm=True, raises=None, delay=0.0):
        self.pieces = list(pieces)
        self.reply = reply if reply is not None else "".join(pieces)
        self.arm = arm
        self.raises = raises
        self.delay = delay
        self.seen_kwargs = None

    async def dispatch(self, **kwargs):
        self.seen_kwargs = kwargs
        if self.delay:
            await asyncio.sleep(self.delay)
        if self.raises:
            raise self.raises

        sink = current_sink()
        if sink is not None and self.arm:
            sink.arm(agent_name="Sarah AI", agent_domain="health")
            for piece in self.pieces:
                sink.emit(piece)
                await asyncio.sleep(0)
            sink.disarm()

        return {
            "reply": self.reply,
            "agent_name": "Sarah AI",
            "agent_domain": "health",
            "transferred": False,
            "suggest_transfer": False,
            "session_id": "session-123",
        }


def collect(orchestrator, **overrides) -> list:
    async def scenario():
        frames = []
        generator = stream_service.stream_chat(
            message=overrides.get("message", "I need health cover for my family"),
            history=[],
            user_name="Sri",
            product_type="health",
            session_id="session-123",
        )
        async for frame in generator:
            frames.append(frame)
        return frames

    original = stream_service._orchestrator
    stream_service._orchestrator = orchestrator
    try:
        return events(asyncio.run(scenario()))
    finally:
        stream_service._orchestrator = original


class TestRealTokensReachTheBrowser:
    def test_a_token_emitted_inside_dispatch_comes_out_as_an_sse_event(self):
        parsed = collect(FakeOrchestrator(pieces=["Health cover ", "is what I'd suggest."]))
        assert text_of(parsed) == "Health cover is what I'd suggest."

    def test_the_advisor_is_named_before_the_first_word(self):
        parsed = collect(FakeOrchestrator(pieces=["Hello ", "there."]))
        kinds = types(parsed)
        first_info = kinds.index("agent_info")
        first_token = kinds.index("token")
        # Without this the browser has a word and nobody to attribute it to.
        assert first_info < first_token
        assert parsed[first_info]["agent_name"] == "Sarah AI"
        assert parsed[first_info]["streaming"] is True

    def test_the_stream_ends_with_the_authoritative_metadata_and_done(self):
        parsed = collect(FakeOrchestrator(pieces=["One. ", "Two."]))
        kinds = types(parsed)
        assert kinds[-1] == "done"
        # The full metadata — transfers, session — is only known once dispatch
        # returns, so it arrives after the words rather than before them.
        assert kinds[-2] == "agent_info"
        assert parsed[-1]["session_id"] == "session-123"

    def test_thinking_stops_once_the_advisor_starts_talking(self):
        parsed = collect(FakeOrchestrator(pieces=["Answering now."]))
        kinds = types(parsed)
        first_token = kinds.index("token")
        # Animating "Reviewing your family profile..." over words the advisor is
        # already saying would be a lie about what is happening.
        assert "thinking" not in kinds[first_token:]

    def test_the_recommendation_card_arrives_as_the_tail(self):
        card = '\n\n[RECOMMENDATION:{"type":"single_plan"}]'
        orchestrator = FakeOrchestrator(
            pieces=["Here is my suggestion."],
            reply="Here is my suggestion." + card,
        )
        parsed = collect(orchestrator)
        assert text_of(parsed) == "Here is my suggestion." + card
        # One piece, not paced out word by word: it is a payload, not prose.
        tokens = [e["text"] for e in parsed if e["type"] == "token"]
        assert tokens[-1] == card

    def test_the_turn_still_reaches_the_orchestrator_unchanged(self):
        orchestrator = FakeOrchestrator(pieces=["ok."])
        collect(orchestrator)
        # Nothing about streaming may alter what dispatch is asked to do.
        assert orchestrator.seen_kwargs["message"] == "I need health cover for my family"
        assert orchestrator.seen_kwargs["session_id"] == "session-123"
        assert orchestrator.seen_kwargs["initial_domain"] == "health"


class TestTheBufferedPathIsUntouched:
    def test_a_turn_that_refuses_to_stream_is_replayed_as_before(self):
        # `arm=False` is a turn where the guardrails could still rewrite the
        # reply — the consultation is incomplete. It must behave exactly as it
        # did before this change.
        orchestrator = FakeOrchestrator(arm=False, reply="One two three four five six")
        parsed = collect(orchestrator)
        kinds = types(parsed)

        assert text_of(parsed) == "One two three four five six"
        # Word-batched, so more than one token event for a six-word reply.
        assert kinds.count("token") > 1
        # And the metadata precedes the words, as it always did.
        assert kinds.index("agent_info") < kinds.index("token")

    def test_an_empty_reply_still_becomes_a_question_rather_than_silence(self):
        orchestrator = FakeOrchestrator(arm=False, reply="   ")
        parsed = collect(orchestrator)
        assert "say that once more" in text_of(parsed)

    def test_thinking_steps_still_play_while_a_slow_turn_runs(self):
        orchestrator = FakeOrchestrator(arm=False, reply="Done.", delay=0.5)
        parsed = collect(orchestrator)
        assert types(parsed).count("thinking") >= 1


class TestFailure:
    def test_a_dispatch_that_raises_ends_the_stream_with_an_error(self):
        parsed = collect(FakeOrchestrator(raises=RuntimeError("boom")))
        assert types(parsed)[-1] == "error"
        # Never the internal message.
        assert "boom" not in json.dumps(parsed)

    def test_a_dispatch_that_raises_does_not_hang_the_request(self):
        # The sink is closed in a `finally`, so the drain terminates even when
        # nothing was ever emitted. Without that this test never returns.
        parsed = collect(FakeOrchestrator(raises=RuntimeError("boom")))
        assert len(parsed) >= 1

    def test_a_diverged_reply_corrects_the_screen_instead_of_appending(self):
        # The LLM died part-way and the agent answered in its own voice. What
        # was streamed is retracted, not built upon.
        orchestrator = FakeOrchestrator(
            pieces=["Our Supreme plan costs "],
            reply="I hit a technical problem just then. Could you say that once more?",
        )
        parsed = collect(orchestrator)
        kinds = types(parsed)

        assert "replace" in kinds
        replace = next(e for e in parsed if e["type"] == "replace")
        assert replace["text"].startswith("I hit a technical problem")
        # And nothing was appended after it that would restate the retraction.
        assert kinds.index("replace") > kinds.index("token")


class TestLatencyReporting:
    def test_a_streamed_turn_reports_when_its_first_word_arrived(self):
        parsed = collect(FakeOrchestrator(pieces=["Hello ", "there."]))
        latency = parsed[-1]["latency"]
        assert latency["streamed"] is True
        assert isinstance(latency["first_token_ms"], int)
        assert latency["total_ms"] >= latency["first_token_ms"]

    def test_a_buffered_turn_says_so_and_reports_no_first_token(self):
        parsed = collect(FakeOrchestrator(arm=False, reply="Buffered answer."))
        latency = parsed[-1]["latency"]
        assert latency["streamed"] is False
        assert latency["first_token_ms"] is None
