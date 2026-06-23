import os
import google.generativeai as genai
from dotenv import load_dotenv

load_dotenv()
api_key = os.getenv("GEMINI_API_KEY")
genai.configure(api_key=api_key)

models = ["gemini-1.5-flash", "gemini-2.0-flash", "gemini-2.5-flash"]
for model_name in models:
    try:
        print(f"Testing {model_name}...")
        model = genai.GenerativeModel(model_name=model_name)
        response = model.generate_content("Say hello in one word.")
        print(f"Success: {response.text.strip()}")
    except Exception as e:
        print(f"Failed: {e}")
