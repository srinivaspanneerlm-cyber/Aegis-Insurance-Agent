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

    # Ollama settings — local or cloud-hosted
    OLLAMA_BASE_URL: str = os.getenv("OLLAMA_BASE_URL", "http://localhost:11434")
    OLLAMA_MODEL: str    = os.getenv("OLLAMA_MODEL", "llama3.2")
    OLLAMA_API_KEY: str  = os.getenv("OLLAMA_API_KEY", "ollama")

    # Provider Selection
    DEFAULT_PROVIDER: str = os.getenv("DEFAULT_PROVIDER", "ollama").lower()

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

# Instantiated single settings object for global import
settings = Settings()
