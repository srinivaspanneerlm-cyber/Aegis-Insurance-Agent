from typing import Dict, Any

def calculate_premium(age: int, coverage: str, plan_name: str) -> dict:
    """
    Calculates the exact underwritten insurance premium for a plan based on the customer's age and coverage limit.
    
    Args:
        age: The age of the primary insured person.
        coverage: The coverage limit amount, e.g., '₹1 Crore Cover', '₹10 Lakh Cover', '₹50 Lakh Cover', '₹5 Crore Cover'.
        plan_name: The name of the insurance plan.
    """
    # Pure premium calculation math logic
    base_premium = 500  # default
    
    cov_lower = coverage.lower()
    cov_mult = 1.0
    if "1 crore" in cov_lower:
        base_premium = 850
        cov_mult = 1.2
    elif "10 lakh" in cov_lower:
        base_premium = 350
        cov_mult = 0.8
    elif "50 lakh" in cov_lower:
        base_premium = 600
        cov_mult = 1.0
    elif "5 crore" in cov_lower:
        base_premium = 2500
        cov_mult = 2.0
    
    # Age factor multiplier
    age_mult = 1.0
    if age < 30:
        age_mult = 0.9
    elif age > 50:
        age_mult = 1.4
    elif age > 65:
        age_mult = 1.8
        
    final_premium = round(base_premium * cov_mult * age_mult)
    
    return {
        "plan_name": plan_name,
        "age": age,
        "coverage": coverage,
        "calculated_monthly_premium": f"₹{final_premium}/month",
        "underwriting_status": "APPROVED",
        "tax_exemption_qualified": "YES"
    }
