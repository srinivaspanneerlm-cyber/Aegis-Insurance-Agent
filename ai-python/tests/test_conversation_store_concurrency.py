"""
The conversation append is now disk-authoritative under a lock (Phase 8.3a).

Two ConversationStore instances stand in for two uvicorn workers, each with its
own in-memory cache. The test reproduces the lost-update the old cache-based
append allowed: a worker with a stale cache overwriting another worker's turns.
"""
import json

from app.memory.conversation_store import ConversationStore


def _turns_on_disk(store, customer_id, domain):
    data = json.loads(store._path(customer_id, domain).read_text(encoding="utf-8"))
    return [t["content"] for t in data["turns"]]


def test_stale_cache_does_not_overwrite_another_workers_turns(tmp_path):
    a = ConversationStore(tmp_path)
    b = ConversationStore(tmp_path)

    a.save_turn("cust_x", "health", "u1", "a1")   # a.cache = [u1,a1]; disk = [u1,a1]
    b.save_turn("cust_x", "health", "u2", "a2")   # disk = [u1,a1,u2,a2]; a's cache is now stale
    a.save_turn("cust_x", "health", "u3", "a3")   # must re-read disk, not clobber from stale cache

    assert _turns_on_disk(a, "cust_x", "health") == ["u1", "a1", "u2", "a2", "u3", "a3"]


def test_history_is_readable_by_a_fresh_reader_after_save(tmp_path):
    writer = ConversationStore(tmp_path)
    writer.save_turn("cust_y", "motor", "hi", "hello")

    reader = ConversationStore(tmp_path)  # fresh cache → reads from disk
    history = reader.load_history("cust_y", "motor")
    assert [h["content"] for h in history] == ["hi", "hello"]


def test_append_still_trims_to_max_turns(tmp_path):
    store = ConversationStore(tmp_path)
    for i in range(store.MAX_TURNS + 10):
        store.save_turn("cust_z", "travel", f"u{i}", f"a{i}")

    turns = _turns_on_disk(store, "cust_z", "travel")
    assert len(turns) == store.MAX_TURNS * 2  # trim preserved after the refactor
