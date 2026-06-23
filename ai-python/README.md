# 🛡️ Aegis AI Insurance Conversational Engine

A premium, sovereign, and ultra-lightweight conversational AI service tailored for elite fintech and insurance underwriting ecosystems. 

Aegis AI acts as an emotionally intelligent, empathetic, and financially sophisticated personal advisor. Built with direct asynchronous SDK endpoints and **zero external RAG or LangChain overhead** to guarantee sub-second latency, peak execution performance, and bulletproof security.

---

## 🌟 Premium Features

* 💼 **Elite Insurance Advisor Persona:** Highly empathetic, financially astute, and professional conversational assistant.
* 🤖 **Dual LLM Native Integration:** Underpinned by direct async implementations of Google Gemini (`gemini-1.5-flash`) and OpenAI (`gpt-4o`) with instant runtime failover protection.
* 📋 **Dynamic Insurance Recommendation Intake:** Conversational workflow designed to assess insurance type, family size, budget, age, and coverage goals before recommending matches.
* 🛡️ **Flagship Plan Portfolio:**
  * **Aegis Essential Shield** (₹25 Lakh cover, starts at ₹390/mo) - Perfect for individuals.
  * **Aegis Supreme Health Shield** (₹1 Crore cover, starts at ₹850/mo) - Full comprehensive family shield with zero room rent limits.
  * **Aegis Global Elite Shield** (₹5 Crore cover, starts at ₹2100/mo) - Top-tier worldwide cashless medical safety net.
* 🔌 **Flexible & Standardized Integration:** Standard routes supporting both the root `POST /ai-chat` and legacy Node.js routing via `POST /api/ai` endpoints.
* 🔒 **Elite Failure Resiliency:** In-memory, high-fidelity emotional intelligence fallback model active if upstream LLM APIs go offline.

---

## 📂 Project Architecture

```
ai-python/
│
├── app/
│   ├── config/
│   │   └── config.py          # Centralized, environment-aware configuration
│   ├── models/
│   │   └── schemas.py         # Elegant Pydantic data schemas
│   ├── prompts/
│   │   └── insurance_prompts.py # Emotionally intelligent system prompt
│   ├── routes/
│   │   └── chat_routes.py     # Clean async endpoints for direct integration
│   ├── services/
│   │   ├── chat_service.py    # Conversation manager & custom offline fallback
│   │   └── llm_service.py     # Native OpenAI & Gemini direct async clients
│   ├── utils/
│   │   └── logger.py          # Fintech-themed premium logger
│   └── __init__.py
│
├── requirements.txt           # Cleaned, lightweight, direct SDK dependencies
├── .env                       # Standardized environment keys
├── pyrightconfig.json         # Static analysis config
├── start.sh                   # Autoconfigured Linux daemon startup shell script
└── README.md                  # Elite service documentation
```

---

## 🚀 Setup & Execution Guide

### 1. Configure the Environment
Ensure your `.env` file in the `ai-python/` root contains your preferred provider and API key:
```ini
# Aegis AI Engine Configuration
PORT=8000
HOST=0.0.0.0

# Supported options for DEFAULT_PROVIDER: "openai" or "gemini"
DEFAULT_PROVIDER=gemini
GEMINI_API_KEY="YOUR_GEMINI_API_KEY"
OPENAI_API_KEY="YOUR_OPENAI_API_KEY"
```

### 2. Fast Launch with Auto-Setup (Linux)
Aegis includes a self-healing startup script that handles Python virtual environment creation and dependency configuration in a single command:
```bash
bash start.sh
```

### 3. Manual Launch
To start manually using your shell:
```bash
# Create and activate virtual environment
python3 -m venv venv
source venv/bin/activate

# Install elite direct requirements
pip install -r requirements.txt

# Launch FastAPI development server
python main.py
```
Server is active at `http://localhost:8000`. You can inspect endpoints interactively at `http://localhost:8000/docs`.

---

## 📡 API Reference

### Root Chat Endpoint
`POST /ai-chat`
* **Description:** Submits customer inquiry directly to Aegis AI.
* **Payload:**
  ```json
  {
    "message": "I need medical protection for my wife and two kids under a budget of 1500/month."
  }
  ```
* **Response (Gemini/OpenAI Native):**
  ```json
  {
    "reply": "I completely understand that protecting your wife and children is your absolute top priority. To secure them with maximum clarity, I highly recommend our flagship **Aegis Supreme Health Shield** which offers a substantial ₹1 Crore coverage limit starting at just ₹850/month. This locks in zero room rent limits and guarantees seamless cashless claims..."
  }
  ```

### Direct Node.js Integration
`POST /api/ai`
* **Description:** Backwards-compatible route mapped to direct Node.js Axios connector (`AI_SERVICE_URL`). Accepts identical JSON payload structure.

---

## 🛡️ Central Resiliency Verification
If your internet connection drops or either API provider experiences an outage, Aegis immediately activates the local financial fallback layers:
```python
# Automatic fallback handler is triggered gracefully
logger.warning("LLM model execution failed. Activating premium local fallback...")
```
This guarantees 100% service availability and resilient lead capture pipelines.
