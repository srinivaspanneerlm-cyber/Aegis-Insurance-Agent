import os
from pathlib import Path
from dotenv import load_dotenv

# Base Directory of the application
BASE_DIR = Path(__file__).resolve().parent.parent.parent

# Load environment variables from the specific .env file in the ai-python root
env_path = BASE_DIR / ".env"
load_dotenv(dotenv_path=env_path)

class Settings:
    # Service Network Settings
    PORT: int = int(os.getenv("PORT", 8000))
    HOST: str = os.getenv("HOST", "0.0.0.0")

    # API Credentials
    GEMINI_API_KEY: str  = os.getenv("GEMINI_API_KEY", "")
    OPENAI_API_KEY: str  = os.getenv("OPENAI_API_KEY", "")

    # Gemini model names. Configurable because a hardcoded one is a time bomb:
    # Google retires a model, the name that worked for a year starts returning
    # 404 to new keys, and the only symptom is every Gemini call failing. A
    # name in .env can be changed in the seconds before it matters; a name in
    # the source cannot.
    GEMINI_MODEL: str = os.getenv("GEMINI_MODEL", "gemini-3.5-flash")
    # Embedding model for hybrid (semantic + keyword) knowledge retrieval.
    # Set empty to skip embedding entirely and search on keywords alone —
    # the same path taken when no Gemini key is configured.
    GEMINI_EMBEDDING_MODEL: str = os.getenv("GEMINI_EMBEDDING_MODEL", "models/gemini-embedding-001")

    # Ollama settings — local or cloud-hosted
    OLLAMA_BASE_URL: str = os.getenv("OLLAMA_BASE_URL", "http://localhost:11434")
    OLLAMA_MODEL: str    = os.getenv("OLLAMA_MODEL", "llama3.2")
    OLLAMA_API_KEY: str  = os.getenv("OLLAMA_API_KEY", "ollama")

    # Provider Selection
    DEFAULT_PROVIDER: str = os.getenv("DEFAULT_PROVIDER", "ollama").lower()

    # Providers to try, in order, when the active one fails mid-conversation.
    # A single hosted provider is a single point of failure: when it rate
    # limits or its endpoint is unreachable, the customer's turn dies and the
    # conversation stops there. With a chain, the next provider answers the
    # same turn with the same history, so the conversation continues instead
    # — no restart, no lost context. Comma-separated; a provider without
    # credentials is skipped, so this default is inert until a key is set.
    LLM_FALLBACK_PROVIDERS: str = os.getenv("LLM_FALLBACK_PROVIDERS", "gemini,openai")

    # Deployment environment — controls docs exposure and CORS strictness.
    ENVIRONMENT: str = os.getenv("ENVIRONMENT", "development").lower()

    # Shared secret used to authenticate calls from the Node backend.
    # When empty, internal-key enforcement is disabled (backward compatible).
    AI_INTERNAL_API_KEY: str = os.getenv("AI_INTERNAL_API_KEY", "")

    # Per-attempt LLM call timeout, in seconds. Every provider had no explicit
    # timeout before this — an SDK default (often minutes) or, for the
    # streaming path, nothing at all, since the Node backend deliberately runs
    # its stream client with no timeout of its own. Kept below the backend's
    # own 45s non-streaming timeout (AI_TIMEOUT_MS) so a bounded retry here
    # still finishes inside that envelope rather than racing it.
    LLM_CALL_TIMEOUT_SECONDS: float = float(os.getenv("LLM_CALL_TIMEOUT_SECONDS", "20"))
    # Total attempts for a transient failure (timeout, connection drop, 5xx).
    # Never for input/auth errors, where a retry only delays the safe fallback.
    LLM_CALL_MAX_ATTEMPTS: int = int(os.getenv("LLM_CALL_MAX_ATTEMPTS", "2"))
    # Wall-clock ceiling for one provider's whole turn — its bounded retry
    # included — before the chain gives up on it and asks the next one.
    # Applied only while another provider is still waiting behind it: the
    # deadline exists to leave that provider room inside the backend's 45s
    # envelope, and the last provider in the chain has nobody to leave room
    # for, so it runs to its own timeout and retry policy as before.
    LLM_PROVIDER_BUDGET_SECONDS: float = float(os.getenv("LLM_PROVIDER_BUDGET_SECONDS", "18"))

    @property
    def is_production(self) -> bool:
        return self.ENVIRONMENT == "production"

    @property
    def allowed_origins(self) -> list:
        """CORS allowlist parsed from ALLOWED_ORIGINS (comma-separated)."""
        raw = os.getenv("ALLOWED_ORIGINS", "").strip()
        if raw:
            return [o.strip() for o in raw.split(",") if o.strip()]
        # Safe local-dev default.
        return [
            "http://localhost:3000",
            "http://localhost:5000",
            "http://127.0.0.1:3000",
            "http://127.0.0.1:5000",
        ]

    @property
    def active_provider(self) -> str:
        """
        Dynamically determine the active provider based on .env configuration.
        Priority: DEFAULT_PROVIDER env var → key availability fallback.
        """
        p = self.DEFAULT_PROVIDER

        if p == "ollama":
            return "ollama"
        if p == "gemini" and self.GEMINI_API_KEY:
            return "gemini"
        if p == "openai" and self.OPENAI_API_KEY:
            return "openai"

        # Fallback by available key
        if self.GEMINI_API_KEY:
            return "gemini"
        if self.OPENAI_API_KEY:
            return "openai"

        # Default to ollama if nothing else is configured
        return "ollama"

    def provider_is_usable(self, provider: str) -> bool:
        """Whether a provider has everything it needs to be called at all.

        Ollama needs no key of its own (a local daemon accepts any string, and
        a hosted one carries its key in OLLAMA_API_KEY, which has a default),
        so it counts as usable whenever it is named. The two hosted providers
        are only usable with their key present — calling them without one
        raises on every attempt and would waste the fallback's turn.
        """
        if provider == "ollama":
            return True
        if provider == "gemini":
            return bool(self.GEMINI_API_KEY)
        if provider == "openai":
            return bool(self.OPENAI_API_KEY)
        return False

    @property
    def provider_chain(self) -> list:
        """The active provider first, then each usable fallback after it.

        Order is the order written in LLM_FALLBACK_PROVIDERS. The active
        provider is never repeated later in the chain — retrying the provider
        that just failed is not a fallback.
        """
        chain = [self.active_provider]
        for name in self.LLM_FALLBACK_PROVIDERS.split(","):
            provider = name.strip().lower()
            if provider and provider not in chain and self.provider_is_usable(provider):
                chain.append(provider)
        return chain

# Instantiated single settings object for global import
settings = Settings()
