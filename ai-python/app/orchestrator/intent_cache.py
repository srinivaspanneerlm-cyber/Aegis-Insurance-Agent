"""
Aegis AI — Intent Result Cache

LRU cache for IntentDetectionEngine results.
Avoids re-running the 10-step IDE analysis for identical or near-identical messages.

Design:
  - Key: (normalized_message[:120], active_agent)
  - Value: IntentResult + monotonic timestamp
  - Max entries: 300 (evict LRU on overflow)
  - TTL: 45 seconds (intents stale after ~1 conversation turn)
  - Thread-safe: no (asyncio single-threaded event loop — no lock needed)
"""

import time
from collections import OrderedDict
from typing import Optional

from app.utils.logger import logger


class IntentCache:
    """
    Bounded LRU cache for IDE IntentResult objects.

    Usage:
        cache = IntentCache()
        result = cache.get(message, active_agent)
        if result is None:
            result = intent_engine.analyze(...)
            cache.put(message, active_agent, result)
    """

    def __init__(self, max_size: int = 300, ttl_seconds: float = 45.0) -> None:
        self._store: OrderedDict[str, tuple] = OrderedDict()
        self._max   = max_size
        self._ttl   = ttl_seconds
        self._hits  = 0
        self._miss  = 0

    # ── Public interface ───────────────────────────────────────────────────────

    def get(self, message: str, active_agent: Optional[str]):
        key   = self._key(message, active_agent)
        entry = self._store.get(key)
        if entry is None:
            self._miss += 1
            return None

        result, ts = entry
        if time.monotonic() - ts > self._ttl:
            del self._store[key]
            self._miss += 1
            return None

        # Move to end (recently used)
        self._store.move_to_end(key)
        self._hits += 1
        logger.debug(f"[IntentCache] HIT — key={key[:40]}… hits={self._hits}")
        return result

    def put(self, message: str, active_agent: Optional[str], result) -> None:
        key = self._key(message, active_agent)
        self._store[key] = (result, time.monotonic())
        self._store.move_to_end(key)
        if len(self._store) > self._max:
            evicted_key, _ = self._store.popitem(last=False)
            logger.debug(f"[IntentCache] EVICT — {evicted_key[:30]}…")

    @property
    def stats(self) -> dict:
        total = self._hits + self._miss
        rate  = self._hits / total if total > 0 else 0.0
        return {
            "size":     len(self._store),
            "max":      self._max,
            "hits":     self._hits,
            "misses":   self._miss,
            "hit_rate": round(rate, 3),
        }

    # ── Key builder ────────────────────────────────────────────────────────────

    @staticmethod
    def _key(message: str, active_agent: Optional[str]) -> str:
        """Stable cache key: lowercase + strip + truncate to 120 chars."""
        normalized = message.lower().strip()[:120]
        return f"{active_agent or '_'}|{normalized}"
