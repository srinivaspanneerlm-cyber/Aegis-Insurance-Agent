import urllib.request
import json

def test_chat():
    url = "http://localhost:8000/api/ai/ai-chat"
    
    # We ask a targeted mathematical pricing question that triggers our calculate_premium function tool!
    payload = {
        "message": "I want to protect my family with the Aegis Supreme Health Shield. How much will it cost? I am 45 years old.",
        "user_name": "Sri",
        "product_type": "health",
        "history": [
            {"sender": "customer", "message": "Hi, I am Sri and I need family health coverage."},
            {"sender": "advisor", "message": "Welcome, Sri! I can certainly assist you in finding the ultimate protective shield. What plan do you have in mind?"}
        ]
    }
    
    headers = {"Content-Type": "application/json"}
    data = json.dumps(payload).encode("utf-8")
    
    req = urllib.request.Request(url, data=data, headers=headers, method="POST")
    
    print("🚀 Sending request to Aegis Advanced AI Engine...")
    print(f"Message: '{payload['message']}'\n")
    
    try:
        with urllib.request.urlopen(req) as response:
            res_body = response.read().decode("utf-8")
            res_json = json.loads(res_body)
            print("✅ Response Received!")
            print("----------------------------------------")
            print(res_json.get("reply", "No reply key returned."))
            print("----------------------------------------")
    except Exception as e:
        print(f"❌ Request failed: {e}")

if __name__ == "__main__":
    test_chat()
