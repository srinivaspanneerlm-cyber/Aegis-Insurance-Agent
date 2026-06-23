import urllib.request
import json
import time

def test_payload(name, payload):
    url = "http://localhost:8000/api/ai/ai-chat"
    headers = {"Content-Type": "application/json"}
    data = json.dumps(payload).encode("utf-8")
    req = urllib.request.Request(url, data=data, headers=headers, method="POST")
    
    print(f"\n========================================\nTEST: {name}\n========================================\n")
    print(f"Message: {payload['message']}")
    
    try:
        with urllib.request.urlopen(req) as response:
            res_body = response.read().decode("utf-8")
            res_json = json.loads(res_body)
            print("Response:")
            print(res_json.get("reply", "No reply key returned."))
    except Exception as e:
        print(f"Request failed: {e}")

if __name__ == "__main__":
    # Test 1: General Conversation
    test_payload("General Conversation", {
        "message": "Hi Aegis, hope you are doing well! Just wanted to say hello.",
        "user_name": "Sri",
        "history": []
    })

    print("Sleeping 10s...")
    time.sleep(10)

    # Test 2: Recommendation Request (Missing Info)
    test_payload("Recommendation Request (Missing info)", {
        "message": "I need a health insurance recommendation for my family please.",
        "user_name": "Sri",
        "product_type": "health",
        "history": []
    })

    print("Sleeping 10s...")
    time.sleep(10)

    # Test 3: Recommendation Request (Complete Info)
    test_payload("Recommendation Request (Complete info)", {
        "message": "Can you recommend a plan? I am 35 years old and my monthly premium budget is 3000 rupees.",
        "user_name": "Sri",
        "product_type": "health",
        "history": [
            {"sender": "customer", "message": "Hi, I need health insurance recommendation for my family"},
            {"sender": "advisor", "message": "Greetings, Sri. Category: Health, Subcategory: Individual Health, Advisor: Sarah AI. Relevant Knowledge: Recommendations cannot be generated yet because required details are missing. Could you please share your age and monthly budget?"}
        ]
    })
