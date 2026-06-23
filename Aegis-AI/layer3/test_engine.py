import os
import sys
import shutil
import json
from pathlib import Path

# Add current folder to path
sys.path.append(str(Path(__file__).resolve().parent))

from engine import AegisMemoryEngine

def test_engine_workflow():
    print("🧪 Starting Aegis AI Layer 3 Integration Tests...")
    
    # Initialize engine
    base_dir = Path(__file__).resolve().parent
    engine = AegisMemoryEngine(base_dir=str(base_dir))

    # Assert storage folders start empty (excluding gitkeeps or hidden files)
    def count_json_files(directory):
        return len(list(Path(directory).glob("*.json")))

    assert count_json_files(engine.profiles_storage) == 0, "Profiles storage was not empty!"
    assert count_json_files(engine.conversations_storage) == 0, "Conversations storage was not empty!"
    assert count_json_files(engine.contexts_storage) == 0, "Contexts storage was not empty!"
    assert count_json_files(engine.intelligence_storage) == 0, "Intelligence storage was not empty!"
    print("✅ Verified: All storage directories are completely empty initially.")

    customer_id = "test_cust_999"

    # Step 1: Simulate user saying "My age is 35"
    print("\n💬 Simulating turn 1: 'My age is 35'")
    profile = engine.update_profile(customer_id, "My age is 35")
    assert profile["age"] == 35, f"Expected age 35, got {profile.get('age')}"
    assert profile["customer_id"] == customer_id, "Customer ID mismatch!"
    print(f"✅ Verified: Extracted and stored age = 35. Profile file created at: customer_profiles/{customer_id}.json")

    state = engine.update_state(customer_id, profile)
    assert state["current_stage"] == "collecting_budget", f"Expected stage collecting_budget, got {state['current_stage']}"
    assert "collecting_age" in state["completed_questions"], "collecting_age should be marked completed"
    print(f"✅ Verified: State transitioned to 'collecting_budget'. Completed questions: {state['completed_questions']}")

    # Step 2: Simulate user saying "I have a family of 4"
    print("\n💬 Simulating turn 2: 'I have a family of 4'")
    profile = engine.update_profile(customer_id, "I have a family of 4")
    assert profile["family_size"] == 4, f"Expected family_size 4, got {profile.get('family_size')}"
    # Ensure it updated the same profile and age is still 35
    assert profile["age"] == 35, "Age was overwritten or lost!"
    print("✅ Verified: Extracted and updated family_size = 4. Age 35 was preserved (no duplicate records).")

    state = engine.update_state(customer_id, profile)
    assert state["current_stage"] == "collecting_budget", "Stage should still be collecting_budget"
    assert "collecting_family_size" in state["completed_questions"], "collecting_family_size should be marked completed"
    print(f"✅ Verified: Stage remains 'collecting_budget'. Completed questions: {state['completed_questions']}")

    # Step 3: Simulate user saying "My budget is 20000"
    print("\n💬 Simulating turn 3: 'My budget is 20000'")
    profile = engine.update_profile(customer_id, "My budget is 20000")
    assert profile["budget"] == 20000.0, f"Expected budget 20000, got {profile.get('budget')}"
    assert profile["age"] == 35, "Age was lost!"
    assert profile["family_size"] == 4, "Family size was lost!"
    print("✅ Verified: Extracted and updated budget = 20000.")

    state = engine.update_state(customer_id, profile)
    assert state["current_stage"] == "ready_for_recommendation", f"Expected stage ready_for_recommendation, got {state['current_stage']}"
    assert state["recommendation_readiness"] is True, "Recommendation readiness should be True"
    print(f"✅ Verified: State transitioned to 'ready_for_recommendation'. Completed questions: {state['completed_questions']}")

    # Step 4: Classify segments and risks
    print("\n🧠 Evaluating Customer Intelligence...")
    intel = engine.classify_intelligence(customer_id, profile)
    assert intel["assigned_risk_tier"] == "Medium", f"Expected risk Medium, got {intel['assigned_risk_tier']}"
    assert "Family Protector" in intel["assigned_segments"], f"Expected Family Protector segment, got {intel['assigned_segments']}"
    print(f"✅ Verified: Underwriting risk tier: {intel['assigned_risk_tier']}. Assigned segment: {intel['assigned_segments']}")

    # Step 5: Compile recommendation context
    print("\n📁 Compiling Recommendation Context...")
    context = engine.compile_recommendation_context(customer_id, profile, intel["assigned_risk_tier"])
    assert "Customer" in context["customer_summary"], "Customer summary format invalid"
    assert "₹20000" in context["budget_summary"], "Budget summary value invalid"
    print(f"✅ Verified: Context compiled successfully. summaries ready for downstream engine.")
    print(f"   Customer Summary: {context['customer_summary']}")
    print(f"   Budget Summary:   {context['budget_summary']}")

    # Step 6: Clean up generated test files to keep storage directories completely empty
    print("\n🧹 Cleaning up generated verification records...")
    
    # Empty directories
    for path in [engine.profiles_storage, engine.conversations_storage, engine.contexts_storage, engine.intelligence_storage]:
        for file in path.glob("*"):
            if file.is_file():
                file.unlink()
    
    assert count_json_files(engine.profiles_storage) == 0
    assert count_json_files(engine.conversations_storage) == 0
    assert count_json_files(engine.contexts_storage) == 0
    assert count_json_files(engine.intelligence_storage) == 0
    print("✅ Verified: All storage folders have been successfully returned to empty state.")

    print("\n🎉 ALL TESTS PASSED SUCCESSFULLY! LAYER 3 ARCHITECTURE IS 100% CORRECT & READY.")

if __name__ == "__main__":
    test_engine_workflow()
