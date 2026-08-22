"""
The tee between an LLM call and the SSE stream.

Everything here is about one question: can what the customer was shown ever
disagree with what the turn actually decided? The sink is the only component
that can create that gap, so its rules — disarmed by default, filtered on the
way out, reconcilable at the end — are tested directly rather than inferred
from the stream that uses them.
"""

import asyncio
import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.services.token_stream import (
    TokenSink,
    current_sink,
    emit_token,
    set_sink,
    streaming_wanted,
)


def run(coro):
    return asyncio.run(coro)


async def collect(sink: TokenSink) -> list:
    return [piece async for piece in sink.drain()]


class TestArming:
    def test_a_new_sink_is_disarmed(self):
        # The safe default, and the whole reason this is safe to place in the
        # context of every streamed request: a sink that exists is not a sink
        # that is used. Only `BaseInsuranceAgent` arms one, and only where the
        # whole-reply guardrails provably cannot rewrite the model's words.
        sink = TokenSink()
        assert sink.is_armed is False
        sink.emit("hello")
        assert sink.released == ""

    def test_arming_lets_tokens_through(self):
        sink = TokenSink()
        sink.arm(agent_name="Sarah AI", agent_domain="health")
        sink.emit("hello ")
        sink.emit("there")
        assert sink.released == "hello there"
        assert sink.agent_name == "Sarah AI"
        assert sink.agent_domain == "health"

    def test_disarming_stops_them_again(self):
        sink = TokenSink()
        sink.arm()
        sink.emit("said")
        sink.disarm()
        sink.emit(" unsaid")
        assert sink.released == "said"

    def test_a_closed_sink_accepts_nothing_more(self):
        sink = TokenSink()
        sink.arm()
        sink.close()
        sink.emit("too late")
        assert sink.released == ""


class TestTheContextSlot:
    def test_a_request_with_no_sink_is_silent_and_safe(self):
        set_sink(None)
        assert current_sink() is None
        assert streaming_wanted() is False
        emit_token("goes nowhere")  # must not raise

    def test_streaming_wanted_follows_the_arming(self):
        sink = TokenSink()
        set_sink(sink)
        try:
            assert streaming_wanted() is False
            sink.arm()
            assert streaming_wanted() is True
            sink.disarm()
            assert streaming_wanted() is False
        finally:
            set_sink(None)

    def test_a_child_task_inherits_the_sink(self):
        # The property the whole design rests on: `stream_service` installs the
        # sink, `asyncio.create_task` copies the context, and the LLM call six
        # frames down finds it without a single signature having changed.
        async def scenario():
            sink = TokenSink()
            sink.arm()
            set_sink(sink)

            async def deep():
                async def deeper():
                    emit_token("from the bottom")
                await deeper()

            await asyncio.create_task(deep())
            return sink.released

        assert run(scenario()) == "from the bottom"


class TestDraining:
    def test_tokens_arrive_in_order_and_the_drain_ends_on_close(self):
        async def scenario():
            sink = TokenSink()
            sink.arm()
            for piece in ("I ", "recommend ", "the "):
                sink.emit(piece)
            sink.close()
            return await collect(sink)

        assert run(scenario()) == ["I ", "recommend ", "the "]

    def test_a_drain_waiting_on_nothing_is_released_by_close(self):
        # The case that would otherwise hang a request: dispatch raised, no
        # token was ever emitted, and something has to end the stream.
        async def scenario():
            sink = TokenSink()
            sink.arm()
            asyncio.get_event_loop().call_later(0.01, sink.close)
            return await asyncio.wait_for(collect(sink), timeout=1.0)

        assert run(scenario()) == []

    def test_a_full_queue_drops_rather_than_blocking_the_model(self):
        # A browser that cannot keep up must not stall the LLM call feeding it.
        # The reply is still delivered whole at the end, so a dropped token
        # costs the animation and nothing else.
        sink = TokenSink(max_queue=4)
        sink.arm()
        for i in range(20):
            sink.emit(f"{i} ")
        assert sink.dropped > 0
        assert len(sink.released) < 40


class TestHeaderFiltering:
    """
    The streamed text and the final text have to be the same text.

    `BaseInsuranceAgent._clean_response` drops whole lines that start with a
    scaffolding header, so a sink that released them would show the customer a
    line that then vanished from the finished reply.
    """

    HEADERS = ["Category:", "Advisor:", "Workflow Integrity Failure"]

    def test_a_scaffolding_line_never_reaches_the_customer(self):
        sink = TokenSink()
        sink.arm(strip_prefixes=self.HEADERS)
        sink.emit("Category: health\n")
        sink.emit("Hello there, how can I help?")
        sink.close()
        assert "Category:" not in sink.released
        assert "Hello there" in sink.released

    def test_a_header_split_across_tokens_is_still_caught(self):
        # Providers do not respect word boundaries; "Category:" arrives as
        # "Cat" + "egory" + ":" as often as not.
        sink = TokenSink()
        sink.arm(strip_prefixes=self.HEADERS)
        for piece in ("Cat", "egory", ":", " health", "\n", "Real answer."):
            sink.emit(piece)
        sink.close()
        assert "Category" not in sink.released
        assert "Real answer." in sink.released

    def test_ordinary_prose_is_not_held_back_waiting_for_a_decision(self):
        # The latency guard. Holding every line until its newline would stall
        # the first sentence behind the whole paragraph, which is the delay
        # this entire change exists to remove.
        sink = TokenSink()
        sink.arm(strip_prefixes=self.HEADERS)
        sink.emit("A health plan for your family is what I would suggest here.")
        assert "family" in sink.released

    def test_a_short_final_line_is_flushed_rather_than_swallowed(self):
        sink = TokenSink()
        sink.arm(strip_prefixes=self.HEADERS)
        sink.emit("Yes.")  # shorter than the longest header prefix
        sink.close()
        assert sink.released == "Yes."

    def test_no_filtering_when_no_prefixes_are_given(self):
        sink = TokenSink()
        sink.arm()
        sink.emit("Category: still fine\n")
        assert sink.released == "Category: still fine\n"


class TestReconciliation:
    def test_an_appended_card_comes_back_as_the_remainder(self):
        # The ordinary streamed turn: the model's prose was released as it was
        # written, and the recommendation embedder appended a card afterwards.
        sink = TokenSink()
        sink.arm()
        sink.emit("Here is what I suggest.")
        final = "Here is what I suggest.\n\n[RECOMMENDATION:{\"type\":\"single_plan\"}]"
        assert sink.reconcile(final) == "\n\n[RECOMMENDATION:{\"type\":\"single_plan\"}]"

    def test_an_unchanged_reply_leaves_nothing_to_send(self):
        sink = TokenSink()
        sink.arm()
        sink.emit("All done.")
        assert sink.reconcile("All done.") == ""

    def test_trailing_whitespace_stripped_by_the_cleaner_is_not_divergence(self):
        sink = TokenSink()
        sink.arm()
        sink.emit("All done.  ")
        assert sink.reconcile("All done.") == ""

    def test_a_diverged_reply_is_reported_rather_than_appended(self):
        # The LLM died half-way and the agent answered in its own voice. The
        # released text is no longer true, and appending the fallback under it
        # would read as the advisor contradicting itself.
        sink = TokenSink()
        sink.arm()
        sink.emit("Our Supreme plan costs")
        fallback = "I hit a technical problem just then. Could you say that once more?"
        assert sink.reconcile(fallback) is None

    def test_a_turn_that_streamed_nothing_reconciles_to_the_whole_reply(self):
        sink = TokenSink()
        assert sink.reconcile("the entire reply") == "the entire reply"
