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
    GEMINI_API_KEY: str = os.getenv("GEMINI_API_KEY", "")
    OPENAI_API_KEY: str = os.getenv("OPENAI_API_KEY", "")
    
    # Provider Selection
    DEFAULT_PROVIDER: str = os.getenv("DEFAULT_PROVIDER", "gemini").lower()

    @property
    def active_provider(self) -> str:
        """
        Dynamically determine the active provider based on configured API keys.
        """
        if self.GEMINI_API_KEY and self.DEFAULT_PROVIDER == "gemini":
            return "gemini"
        elif self.OPENAI_API_KEY and self.DEFAULT_PROVIDER == "openai":
            return "openai"
        elif self.GEMINI_API_KEY:
            return "gemini"
        elif self.OPENAI_API_KEY:
            return "openai"
        else:
            # Fallback if no keys are provided
            return "gemini"

# Instantiated single settings object for global import
settings = Settings()

