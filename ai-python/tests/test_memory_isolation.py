"""
Customer and domain isolation in MemoryOrchestrator.

CLAUDE.md names this invariant directly: "Each agent has its own environment,
config, and memory namespace ({domain}_{customer_id}). Do not let one domain
read or write another's memory except via the sanctioned cross-domain export."
Nothing in the existing suite drove two customers' data through the same
MemoryOrchestrator instance and asserted one never surfaces in the other's
load — coverage today is indirect, via different keys mapping to different
file paths. This closes that gap directly, against a tmp_path-backed
orchestrator so nothing touches the real Aegis-AI tree.

Three stores are exercised: conversation history (keyed by customer_id+domain
directly), the domain profile (keyed by "{domain}_{customer_id}", CLAUDE.md's
own namespace format), and the shared profile (keyed by customer_id alone —
deliberately shared across a customer's own domains, so the positive case is
asserted too, to be sure isolation isn't being proven against the wrong
invariant).
"""
from app.memory.memory_orchestrator import MemoryOrchestrator


def _orch(tmp_path):
    return MemoryOrchestrator(tmp_path, None)


# ── Conversation history: two different customers ─────────────────────────────

def test_two_customers_conversation_history_never_crosses(tmp_path):
    orch = _orch(tmp_path)

    orch.save_turn("cust_priya", "health", "I have diabetes", "Noted, thank you.")
    orch.save_turn("cust_arjun", "health", "I earn 8 lakhs a year", "Understood.")

    priya_history = orch.load_history("cust_priya", "health")
    arjun_history = orch.load_history("cust_arjun", "health")

    priya_text = " ".join(t["content"] for t in priya_history)
    arjun_text = " ".join(t["content"] for t in arjun_history)

    assert "diabetes" in priya_text
    assert "8 lakhs" not in priya_text
    assert "8 lakhs" in arjun_text
    assert "diabetes" not in arjun_text


# ── Conversation history: same customer, two domains ───────────────────────────

def test_one_customers_domains_never_cross_in_history(tmp_path):
    orch = _orch(tmp_path)

    orch.save_turn("cust_priya", "health", "I have diabetes", "Noted, thank you.")
    orch.save_turn("cust_priya", "motor", "My car is a Honda City", "Got it.")

    health_history = orch.load_history("cust_priya", "health")
    motor_history = orch.load_history("cust_priya", "motor")

    health_text = " ".join(t["content"] for t in health_history)
    motor_text = " ".join(t["content"] for t in motor_history)

    assert "diabetes" in health_text
    assert "Honda City" not in health_text
    assert "Honda City" in motor_text
    assert "diabetes" not in motor_text


# ── Domain profile: two different customers ────────────────────────────────────

def test_two_customers_domain_profiles_never_cross(tmp_path):
    orch = _orch(tmp_path)

    orch.profile_manager.save_domain_profile(
        "health_cust_priya", {"customer_id": "health_cust_priya", "age": 34, "condition": "diabetes"}
    )
    orch.profile_manager.save_domain_profile(
        "health_cust_arjun", {"customer_id": "health_cust_arjun", "age": 41, "income": 800000}
    )

    priya = orch.profile_manager.load_domain_profile("health_cust_priya")
    arjun = orch.profile_manager.load_domain_profile("health_cust_arjun")

    assert priya.get("condition") == "diabetes"
    assert "condition" not in arjun
    assert arjun.get("income") == 800000
    assert "income" not in priya


# ── Domain profile: one customer, two domains (the {domain}_{customer_id} rule) ─

def test_one_customers_domain_profiles_never_cross(tmp_path):
    """CLAUDE.md's own example: health and motor must not read/write each
    other's memory namespace for the same underlying customer."""
    orch = _orch(tmp_path)

    orch.profile_manager.save_domain_profile(
        "health_cust_priya", {"customer_id": "health_cust_priya", "condition": "diabetes"}
    )
    orch.profile_manager.save_domain_profile(
        "motor_cust_priya", {"customer_id": "motor_cust_priya", "vehicle": "Honda City"}
    )

    health_profile = orch.profile_manager.load_domain_profile("health_cust_priya")
    motor_profile = orch.profile_manager.load_domain_profile("motor_cust_priya")

    assert health_profile.get("condition") == "diabetes"
    assert "vehicle" not in health_profile
    assert motor_profile.get("vehicle") == "Honda City"
    assert "condition" not in motor_profile


# ── Shared profile: deliberately shared across one customer's own domains ──────

def test_shared_profile_is_shared_within_one_customer_by_design(tmp_path):
    """Not an isolation bug: `save_shared_profile` is the sanctioned
    cross-domain export CLAUDE.md carves out, keyed by customer_id alone.
    Asserted here so the isolation tests above aren't mistaken for proving
    the shared store should be isolated too — it deliberately is not."""
    orch = _orch(tmp_path)

    shared = orch.profile_manager.load_shared_profile("cust_priya")
    shared["age"] = 34
    shared["conversation_domains"] = ["health"]
    orch.profile_manager.save_shared_profile("cust_priya", shared)

    reloaded = orch.profile_manager.load_shared_profile("cust_priya")
    assert reloaded["age"] == 34
    assert "health" in reloaded["conversation_domains"]


def test_shared_profile_still_never_crosses_customers(tmp_path):
    orch = _orch(tmp_path)

    priya_shared = orch.profile_manager.load_shared_profile("cust_priya")
    priya_shared["age"] = 34
    orch.profile_manager.save_shared_profile("cust_priya", priya_shared)

    arjun_shared = orch.profile_manager.load_shared_profile("cust_arjun")
    assert "age" not in arjun_shared
