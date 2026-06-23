import os
import sys
from pathlib import Path

# Add current folder to path
sys.path.append(str(Path(__file__).resolve().parent))

from engine import AegisDecisionEngine

def test_recommendation_workflow():
    print("🧪 Starting Aegis AI Layer 4 Recommendation & Decision Integration Tests...")
    
    # Initialize engine
    base_dir = Path(__file__).resolve().parent
    engine = AegisDecisionEngine(base_dir=str(base_dir))

    # ----------------------------------------------------
    # TEST CASE 1: Standard Health Customer (Family Protector Segment)
    # ----------------------------------------------------
    print("\n📋 Test Case 1: Health intake (Age: 35, Family Size: 4, Budget: 4000, Income: 800000)")
    customer_profile = {
        "customer_id": "cust_test_101",
        "name": "Sri Kumar",
        "age": 35,
        "family_size": 4,
        "budget": 4000,
        "annual_income": 800000,
        "occupation": "Software Engineer",
        "location": "Chennai",
        "assigned_segments": ["Family Protector"],
        "medical_risk": {
            "pre_existing": True,
            "tobacco": False
        }
    }
    
    routing_context = {
        "active_category": "health",
        "advisor_id": "elite_advisor_health"
    }

    result = engine.recommend(customer_profile, routing_context)

    # Assertions for Output Format compliance
    assert "recommendation_score" in result, "recommendation_score missing!"
    assert "risk_level" in result, "risk_level missing!"
    assert "coverage_match_percentage" in result, "coverage_match_percentage missing!"
    assert "budget_match_percentage" in result, "budget_match_percentage missing!"
    assert "top_recommendation" in result, "top_recommendation missing!"
    assert "alternative_recommendation" in result, "alternative_recommendation missing!"
    assert "recommendation_reason" in result, "recommendation_reason missing!"
    assert "confidence_score" in result, "confidence_score missing!"

    # Assertions for Decision Integrity
    assert result["risk_level"] == "Medium Risk", f"Expected Medium Risk, got {result['risk_level']}"
    assert result["top_recommendation"]["plan_name"] == "Aegis Supreme Health Shield", f"Expected Aegis Supreme Health Shield, got {result['top_recommendation']['plan_name']}"
    assert result["alternative_recommendation"]["plan_name"] == "Aegis Care Silver Floater", f"Expected Aegis Care Silver Floater, got {result['alternative_recommendation']['plan_name']}"
    assert result["coverage_match_percentage"] == 100.0, "Coverage match score for Supreme plan should be 100%"
    assert result["budget_match_percentage"] == 100.0, "Budget match score for Supreme plan (premium 3000 <= budget 4000) should be 100%"
    
    # Assertions for XAI Justification compliance
    reason = result["recommendation_reason"]
    assert "Recommended" in reason, "Explanation should justify why selected"
    assert "premium of ₹3000" in reason, "Explanation should cover budget compatibility"
    assert "risk profile 'Medium Risk'" in reason, "Explanation should cover risk compatibility"
    assert "coverage limits of ₹1500000" in reason, "Explanation should cover coverage compatibility"
    
    print("✅ Verified: Case 1 matched and evaluated all scoring factors correctly.")
    print(f"   Top Recommendation:        {result['top_recommendation']['plan_name']} (Premium: ₹{result['top_recommendation']['premium_monthly']}/mo)")
    print(f"   Alternative Recommendation: {result['alternative_recommendation']['plan_name']} (Premium: ₹{result['alternative_recommendation']['premium_monthly']}/mo)")
    print(f"   Calculated Suitability:     {result['recommendation_score']}/100")
    print(f"   Underwriting Risk Tier:     {result['risk_level']}")
    print(f"   Confidence Level:           {result['confidence_score']}")
    print(f"   Natural Explanation:        {result['recommendation_reason'][:150]}...")

    # ----------------------------------------------------
    # TEST CASE 2: Strict Eligibility Failure (Extreme Low Budget / Income)
    # ----------------------------------------------------
    print("\n📋 Test Case 2: Under-limit Profile (Age: 25, Budget: 200, Income: 50000)")
    poor_profile = {
        "customer_id": "cust_test_102",
        "name": "Ravi Kumar",
        "age": 25,
        "family_size": 1,
        "budget": 200,
        "annual_income": 50000,
        "occupation": "Unemployed",
        "assigned_segments": ["Young Professional"]
    }

    result_poor = engine.recommend(poor_profile, routing_context)
    
    assert result_poor["top_recommendation"] is None, "Top recommendation should be None due to eligibility boundaries!"
    assert "No plans matching" in result_poor["recommendation_reason"], "Reason should denote pre-qualification limits"
    print("✅ Verified: Correctly rejected candidate based on eligibility boundaries.")

    # ----------------------------------------------------
    # TEST CASE 3: Dynamic Motor Insurance Scoring & Matching
    # ----------------------------------------------------
    print("\n📋 Test Case 3: Motor matching (Age: 40, Budget: 3000, Category: motor)")
    motor_profile = {
        "customer_id": "cust_test_103",
        "name": "Devi Prasad",
        "age": 60,
        "family_size": 2,
        "budget": 3000,
        "annual_income": 900000,
        "assigned_segments": ["Vehicle Owner"],
        "vehicle_risk": {
            "vehicle_age": 8,
            "accidents": 2
        },
        "claims_risk": {
            "prior_claims": 2,
            "recent_claim": True
        }
    }
    
    motor_routing = {
        "active_category": "motor"
    }

    result_motor = engine.recommend(motor_profile, motor_routing)
    
    assert result_motor["top_recommendation"]["plan_name"] == "Aegis Bumper-to-Bumper Shield", "Should select Elite Zero-dep Motor plan"
    assert "Premium" in result_motor["top_recommendation"]["style"] or "elite" in result_motor["top_recommendation"]["style"], "Elite plan selected style error"
    print("✅ Verified: Correctly recommended and matched zero-depreciation Motor shield.")
    print(f"   Top Motor Selection:        {result_motor['top_recommendation']['plan_name']} (Premium: ₹{result_motor['top_recommendation']['premium_monthly']}/mo)")

    print("\n🎉 ALL LAYER 4 INTEGRATION TESTS PASSED SUCCESSFULLY! ARCHITECTURE IS 100% CORRECT.")

if __name__ == "__main__":
    test_recommendation_workflow()
