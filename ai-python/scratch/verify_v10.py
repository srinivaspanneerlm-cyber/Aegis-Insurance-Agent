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
    
    max_attempts = 6
    for attempt in range(max_attempts):
        try:
            with urllib.request.urlopen(req) as response:
                res_body = response.read().decode("utf-8")
                res_json = json.loads(res_body)
                print("Response:")
                reply = res_json.get("reply", "No reply key returned.")
                print(reply)
                # If we got a workflow diagnostic error or rating issue on "General Conversation", it might be due to LLM error or intent mismatch.
                break
        except Exception as e:
            print(f"Attempt {attempt + 1}/{max_attempts} failed: {e}")
            if attempt < max_attempts - 1:
                print("Sleeping 12s before retrying...")
                time.sleep(12)
            else:
                print("Failed all attempts.")

if __name__ == "__main__":
    # Test 1: General Conversation
    test_payload("General Conversation", {
        "message": "Hi, just saying hello!",
        "user_name": "Sri",
        "history": []
    })

    print("\nSleeping 5s...")
    time.sleep(5)

    # Test 2: Keyword override (Motor)
    test_payload("Keyword override (Motor)", {
        "message": "I drive a Hyundai Creta and need to insure it.",
        "user_name": "Sri",
        "history": []
    })

    print("\nSleeping 5s...")
    time.sleep(5)

    # Test 3: Keyword override (Travel)
    test_payload("Keyword override (Travel)", {
        "message": "I am traveling to USA next week.",
        "user_name": "Sri",
        "history": []
    })

    print("\nSleeping 5s...")
    time.sleep(5)

    # Test 4: Keyword override (Property)
    test_payload("Keyword override (Property)", {
        "message": "Need insurance for my tenant apartment.",
        "user_name": "Sri",
        "history": []
    })

    print("\nSleeping 5s...")
    time.sleep(5)

    # Test 5: Recommendation Request with missing info
    test_payload("Recommendation Request (Missing info)", {
        "message": "I want a health insurance plan.",
        "user_name": "Sri",
        "product_type": "health",
        "history": []
    })

    print("\nSleeping 5s...")
    time.sleep(5)

    # Test 6: Recommendation Request with complete info
    test_payload("Recommendation Request (Complete info)", {
        "message": "Recommend a plan. I am 35 years old, have a family of 4, and my monthly premium budget is 3000 rupees.",
        "user_name": "Sri",
        "product_type": "health",
        "history": [
            {"sender": "customer", "message": "I want health insurance plan."},
            {"sender": "advisor", "message": "Recommendations cannot be generated yet as some key profile details are missing. To provide the best options, please tell me: age, budget, family size."}
        ]
    })
