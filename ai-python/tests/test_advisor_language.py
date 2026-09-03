"""
The advisor answers in English until the customer asks for something else.

The product serves Tamil, Thanglish and English speakers, and the agents used to
mirror whatever language the last message was written in. In practice that made
them unstable rather than accommodating: people code-switch inside a single
sentence, quote a relative, or drop one Thanglish word into an otherwise English
message, and the advisor changed language under them each time.

So the rule is now a request, not a guess. English is the default, writing in
Tamil is not the same as asking for Tamil, and a request — once made — sticks
and follows the customer across domains.
"""
import pytest

from app.memory.profile_manager import detect_language_request
from app.agents.base_agent import BaseInsuranceAgent
from app.agents.sarah_ai import SarahAI
from app.memory.memory_orchestrator import MemoryOrchestrator


class _StubLLM:
    def __init__(self):
        self.prompts = []

    async def generate_response(self, system_prompt, user_message, history, tools=None):
        self.prompts.append(system_prompt)
        return "(advisor reply)"


@pytest.fixture
def agent(tmp_path):
    sarah = SarahAI(_StubLLM(), None, None)
    sarah._memory_orch = MemoryOrchestrator(tmp_path, None)
    return sarah


# ── Recognising a request ─────────────────────────────────────────────────────


class TestWhatCountsAsAsking:
    @pytest.mark.parametrize("message,expected", [
        ("can you speak in tamil please", "tamil"),
        ("tamil la pesunga", "tamil"),
        ("tamil-la sollunga", "tamil"),
        ("please reply in Tamil", "tamil"),
        ("switch to tamil", "tamil"),
        ("தமிழில் பேசுங்க", "tamil"),
        ("tamil", "tamil"),
        ("can you talk in thanglish", "thanglish"),
        ("thanglish la pesunga", "thanglish"),
        ("thanglish", "thanglish"),
        ("speak in english", "english"),
        ("english please", "english"),
    ])
    def test_a_request_is_recognised(self, message, expected):
        assert detect_language_request(message) == expected

    @pytest.mark.parametrize("message", [
        # Writing in Thanglish is not asking for Thanglish. This is the whole
        # distinction: these customers get an English reply.
        "enakku family health insurance venum, budget 15k",
        "3 per, naan 32 vayasu wife 30 kid 5",
        "medical problem illa",
        "vanakkam",
        # And the sentence most likely to be mistaken for a request.
        "I live in Tamil Nadu",
        "we are based in tamilnadu, near Coimbatore",
        "my hospital is in Tamil Nadu",
        "",
    ])
    def test_ordinary_messages_are_not_requests(self, message):
        assert detect_language_request(message) is None


# ── What the prompt then tells the model ──────────────────────────────────────


class TestTheInstructionTheModelGets:
    def _block(self, profile):
        return BaseInsuranceAgent._language_block(BaseInsuranceAgent, profile)

    def test_english_is_the_default(self):
        block = self._block({})
        assert "=== LANGUAGE — ENGLISH ===" in block
        assert "Write every reply in clear, plain English" in block

    def test_writing_in_tamil_does_not_change_the_default(self):
        # No `language` on the profile means nobody asked, whatever they typed.
        block = self._block({"coverage_type": "enakku family cover venum"})
        assert "=== LANGUAGE — ENGLISH ===" in block

    @pytest.mark.parametrize("choice", ["tamil", "thanglish", "english"])
    def test_a_recorded_choice_is_honoured(self, choice):
        block = self._block({"language": choice})
        assert "THE CUSTOMER CHOSE THIS" in block
        assert choice in block.lower()

    def test_an_unknown_value_falls_back_to_english(self):
        # A stale or hand-edited profile must not produce an empty instruction.
        assert "=== LANGUAGE — ENGLISH ===" in self._block({"language": "klingon"})


# ── End to end, through the real turn ─────────────────────────────────────────


class TestThroughTheAgent:
    def test_a_thanglish_customer_still_gets_the_english_instruction(self, agent):
        import asyncio

        asyncio.run(agent.generate_response(
            "enakku family health insurance venum, budget 15k",
            [], "Test Customer", "sess-lang-1",
        ))
        prompt = agent.llm.prompts[-1]
        assert "=== LANGUAGE — ENGLISH ===" in prompt
        assert "THE CUSTOMER CHOSE THIS" not in prompt

    def test_asking_is_recorded_and_survives(self, agent):
        profile = agent.update_profile("cust_lang", "tamil la pesunga", "Test Customer")
        assert profile.get("language") == "tamil"
        # And it is still there on the next load — including for other agents,
        # because language is a shared field.
        assert agent.load_profile("cust_lang").get("language") == "tamil"

    def test_the_customer_can_switch_back(self, agent):
        agent.update_profile("cust_back", "tamil la pesunga", "Test Customer")
        profile = agent.update_profile("cust_back", "actually english please", "Test Customer")
        assert profile.get("language") == "english"


# ── Nothing the customer sees is hardcoded Thanglish ──────────────────────────


class TestHardcodedRepliesAreEnglish:
    """These strings never reach the LLM, so no prompt instruction governs them.

    They were Thanglish, which meant the two moments the advisor speaks without
    the model — suggesting a transfer, and apologising for a failure — came back
    in Thanglish no matter what language policy was in force.
    """

    def test_the_transfer_suggestion(self):
        text = BaseInsuranceAgent._build_soft_boundary_message(
            SarahAI(None, None, None),
            {"target": "motor", "target_name": "Alex AI", "detected_domain": "motor"},
            "Ravi",
        )
        assert "Alex AI" in text and "Shall I connect you" in text
        assert "pohanum" not in text and "pannattuma" not in text

    def test_the_failure_fallback(self):
        text = SarahAI(None, None, None)._domain_fallback("Ravi", {}, None)
        assert "Vanakkam" not in text and "sollunga" not in text
