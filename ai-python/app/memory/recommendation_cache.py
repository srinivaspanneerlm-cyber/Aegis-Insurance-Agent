"""
Aegis AI — Recommendation Cache

Stores generated recommendations per customer per domain.
Avoids regenerating plans when the key profile fields haven't changed.

Storage: Aegis-AI/layer3/recommendation_context/cache/{domain}_{customer_id}_rec.json

Cache invalidation: keyed profile fields change → automatic cache miss.
  health:        age, budget, family_size
  motor:         budget, vehicle
  travel:        budget, travel_plans, destination
  home-property: budget, property
  executive:     budget, annual_income

This fixes:
  ✓ Problem 3: Recommendation disappears
  ✓ Problem 8: Recommendation resets after every message
  ✓ Problem 9: Customer details disappear after page navigation
"""
import json
import hashlib
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, Optional

from app.utils.logger import logger


class RecommendationCache:
    """
    Persists the last generated recommendation for each customer+domain.

    Usage:
        cached = cache.retrieve(customer_id, domain, profile)
        if cached:
            rec_result    = cached["rec_result"]
            exec_approval = cached["exec_approval"]
        else:
            rec_result    = generate()
            exec_approval = validate()
            cache.store(customer_id, domain, rec_result, exec_approval, profile)
    """

    # Profile fields that trigger cache invalidation when they change.
    KEY_FIELDS: Dict[str, list] = {
        "health":        ["age", "budget", "family_size"],
        "motor":         ["budget", "vehicle"],
        "travel":        ["budget", "travel_plans", "destination"],
        "home-property": ["budget", "property"],
        "executive":     ["budget", "annual_income"],
    }

    def __init__(self, cache_dir: Path):
        self.cache_dir = Path(cache_dir)
        self.cache_dir.mkdir(parents=True, exist_ok=True)
        self._mem: Dict[str, Dict] = {}  # in-memory layer

    # ── Helpers ───────────────────────────────────────────────────────────────

    def _path(self, customer_id: str, domain: str) -> Path:
        safe = f"{domain}_{customer_id}".replace("/", "_")
        return self.cache_dir / f"{safe}_rec.json"

    def _cache_key(self, customer_id: str, domain: str) -> str:
        return f"{customer_id}:{domain}"

    def _profile_hash(self, profile: Dict, domain: str) -> str:
        """SHA-256 of the key fields → invalidation fingerprint."""
        fields = self.KEY_FIELDS.get(domain, ["budget"])
        snapshot = {f: profile.get(f) for f in fields}
        raw = json.dumps(snapshot, sort_keys=True, default=str)
        return hashlib.sha256(raw.encode()).hexdigest()[:16]

    # ── Store ─────────────────────────────────────────────────────────────────

    def store(
        self,
        customer_id: str,
        domain: str,
        rec_result: Optional[Dict[str, Any]],
        exec_approval: Optional[Dict[str, Any]],
        profile: Dict[str, Any],
    ) -> None:
        """Persist recommendation + approval under a profile fingerprint."""
        if not rec_result:
            return  # Don't cache empty recommendations

        profile_hash = self._profile_hash(profile, domain)
        fields = self.KEY_FIELDS.get(domain, ["budget"])

        entry = {
            "customer_id":      customer_id,
            "domain":           domain,
            "profile_hash":     profile_hash,
            "key_field_snapshot": {f: profile.get(f) for f in fields},
            "rec_result":       rec_result,
            "exec_approval":    exec_approval or {},
            "generated_at":     datetime.utcnow().isoformat(),
        }

        try:
            self._path(customer_id, domain).write_text(
                json.dumps(entry, indent=2, default=str),
                encoding="utf-8",
            )
        except Exception as e:
            logger.warning(f"[RecCache] Write failed {customer_id}/{domain}: {e}")

        self._mem[self._cache_key(customer_id, domain)] = entry
        logger.debug(f"[RecCache] Stored: {customer_id}/{domain} hash={profile_hash}")

    # ── Retrieve ──────────────────────────────────────────────────────────────

    def retrieve(
        self,
        customer_id: str,
        domain: str,
        profile: Dict[str, Any],
    ) -> Optional[Dict[str, Any]]:
        """
        Return the cached recommendation if the key profile fields haven't changed.
        Returns None on cache miss or invalidation.
        """
        mem_key = self._cache_key(customer_id, domain)

        # Try memory first
        entry = self._mem.get(mem_key)
        if not entry:
            path = self._path(customer_id, domain)
            if not path.exists():
                return None
            try:
                entry = json.loads(path.read_text(encoding="utf-8"))
                self._mem[mem_key] = entry
            except Exception as e:
                logger.debug(f"[RecCache] Corrupt cache entry {customer_id}/{domain}: {e}")
                return None

        # Validate fingerprint
        current_hash = self._profile_hash(profile, domain)
        if entry.get("profile_hash") != current_hash:
            logger.debug(
                f"[RecCache] Invalidated: {customer_id}/{domain} "
                f"stored={entry.get('profile_hash')} current={current_hash}"
            )
            return None

        logger.debug(f"[RecCache] Hit: {customer_id}/{domain}")
        return {
            "rec_result":    entry.get("rec_result"),
            "exec_approval": entry.get("exec_approval", {}),
            "from_cache":    True,
            "generated_at":  entry.get("generated_at"),
        }

    # ── Invalidate ────────────────────────────────────────────────────────────

    def invalidate(self, customer_id: str, domain: str) -> None:
        """Force-invalidate cache (e.g. after explicit plan change)."""
        path = self._path(customer_id, domain)
        if path.exists():
            try:
                path.unlink()
            except Exception:
                pass
        self._mem.pop(self._cache_key(customer_id, domain), None)
        logger.debug(f"[RecCache] Invalidated: {customer_id}/{domain}")

    def is_cached(self, customer_id: str, domain: str, profile: Dict[str, Any]) -> bool:
        return self.retrieve(customer_id, domain, profile) is not None
