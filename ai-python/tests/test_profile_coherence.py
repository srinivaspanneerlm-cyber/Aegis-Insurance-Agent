"""
Profile-store cache-coherence + merge-on-save (Phase 8.3b).

Two EnhancedProfileManager instances stand in for two uvicorn workers, each with
its own in-memory cache over a shared profiles directory. These prove reads pick
up another worker's write (mtime/size-aware cache) and that a save folds into the
latest on-disk state instead of clobbering a concurrent worker's fields.
"""
from app.memory.profile_manager import EnhancedProfileManager


def _pm(tmp_path):
    return EnhancedProfileManager(tmp_path)  # memory_engine=None → file-backed


def test_shared_read_is_coherent_across_workers(tmp_path):
    a = _pm(tmp_path)
    b = _pm(tmp_path)
    a.save_shared_profile("cust", {"customer_id": "shared_cust", "age": "30"})
    assert b.load_shared_profile("cust").get("age") == "30"   # b caches this view
    a.save_shared_profile("cust", {"age": "31"})              # a updates → signature changes
    assert b.load_shared_profile("cust").get("age") == "31"   # b re-reads, not stale cache


def test_shared_save_merges_concurrent_fields(tmp_path):
    a = _pm(tmp_path)
    b = _pm(tmp_path)
    a.load_shared_profile("cust")                             # a caches the empty view
    b.save_shared_profile("cust", {"budget": "1000", "conversation_domains": ["motor"]})
    # a writes a DIFFERENT field from its stale view — must not drop b's budget.
    a.save_shared_profile("cust", {"location": "Chennai", "conversation_domains": ["health"]})

    final = _pm(tmp_path).load_shared_profile("cust")
    assert final.get("budget") == "1000"       # b's field preserved
    assert final.get("location") == "Chennai"  # a's field written
    assert set(final.get("conversation_domains")) == {"motor", "health"}  # list unioned


def test_domain_fallback_save_merges_concurrent_fields(tmp_path):
    a = _pm(tmp_path)
    b = _pm(tmp_path)
    b.save_domain_profile("health_cust", {"customer_id": "health_cust", "budget": "500"})
    a.save_domain_profile("health_cust", {"pre_existing_conditions": "diabetes"})

    final = _pm(tmp_path).load_domain_profile("health_cust")
    assert final.get("budget") == "500"                        # preserved
    assert final.get("pre_existing_conditions") == "diabetes"  # written


def test_single_writer_round_trip_is_unchanged(tmp_path):
    pm = _pm(tmp_path)
    pm.save_shared_profile("cust", {"customer_id": "shared_cust", "name": "Sri", "age": "34"})
    got = pm.load_shared_profile("cust")
    assert got["name"] == "Sri" and got["age"] == "34"
