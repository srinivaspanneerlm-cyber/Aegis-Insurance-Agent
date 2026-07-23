"""
A fixed catalogue of realistic customer personas for the recommendation eval.

These are the people Aegis exists to serve (CLAUDE.md §1) — a rural senior on a
tiny monthly budget, a first-time buyer, a middle-income metro family — spread
across all four domains and all three budget tiers. They are deliberately
*plausible*, not exhaustive: the harness asserts quality invariants that must
hold for any customer, and pins the engine's decisions against a baseline so a
future change that quietly moves a recommendation is caught in review.

Each persona is a plain dict of the fields the engines read (discovered from the
engines themselves). Nothing here is customer data — it is invented fixtures.
"""
from __future__ import annotations

from typing import Any, Dict, List

# Budget tier each persona is authored to fall into, used by the segment
# monotonicity invariant. `None` = an edge case with no asserted tier.
BUDGET_ORDER = ["budget", "standard", "premium"]

PERSONAS: List[Dict[str, Any]] = [
    # ── Health (Sarah AI) ────────────────────────────────────────────────────
    {
        "id": "health-rural-senior-budget",
        "domain": "health",
        "tier": "budget",
        "description": "68-year-old retiree in a small town, tight monthly budget, pre-existing conditions.",
        "profile": {
            "age": "68", "budget": "600/month", "location": "Karaikudi",
            "family_size": "2", "medical_history": "diabetes, hypertension",
            "lifestyle": "retired",
        },
    },
    {
        "id": "health-metro-family-standard",
        "domain": "health",
        "tier": "standard",
        "description": "Middle-income family of four in a metro, no pre-existing conditions.",
        "profile": {
            "age": "38", "budget": "2200/month", "location": "Chennai",
            "family_size": "4", "medical_history": "none", "lifestyle": "active",
        },
    },
    {
        "id": "health-firsttime-premium",
        "domain": "health",
        "tier": "premium",
        "description": "Young first-time buyer with room in the budget, healthy.",
        "profile": {
            "age": "29", "budget": "5500/month", "location": "Bangalore",
            "family_size": "1", "medical_history": "none", "lifestyle": "gym",
        },
    },
    {
        "id": "health-coldstart-empty",
        "domain": "health",
        "tier": None,
        "description": "Cold start — nothing collected yet; must still yield a usable answer.",
        "profile": {},
    },

    # ── Motor (Alex AI) ──────────────────────────────────────────────────────
    {
        "id": "motor-twowheeler-budget",
        "domain": "motor",
        "tier": "budget",
        "description": "Two-wheeler owner in a tier-2 town on a small budget.",
        "profile": {
            "budget": "400/month", "vehicle_type": "two wheeler",
            "registration_year": "2019", "fuel_type": "petrol",
            "usage_type": "personal", "location": "Salem", "idv": "65000",
            "insurance_type": "comprehensive", "claim_history": "none",
        },
    },
    {
        "id": "motor-hatchback-standard",
        "domain": "motor",
        "tier": "standard",
        "description": "Family hatchback, personal use, clean claim history.",
        "profile": {
            "budget": "1500/month", "vehicle_type": "car",
            "vehicle_detail": "hatchback", "registration_year": "2021",
            "fuel_type": "petrol", "usage_type": "personal",
            "location": "Coimbatore", "idv": "550000", "claim_history": "none",
        },
    },
    {
        "id": "motor-suv-premium",
        "domain": "motor",
        "tier": "premium",
        "description": "New diesel SUV in a metro, one prior claim.",
        "profile": {
            "budget": "4500/month", "vehicle_type": "car",
            "vehicle_detail": "SUV", "registration_year": "2024",
            "fuel_type": "diesel", "usage_type": "personal",
            "location": "Chennai", "idv": "1800000", "claim_history": "1 claim",
        },
    },

    # ── Travel (Ethan AI) ────────────────────────────────────────────────────
    {
        "id": "travel-domestic-budget",
        "domain": "travel",
        "tier": "budget",
        "description": "Short domestic leisure trip for a young couple.",
        "profile": {
            "budget": "300", "destination": "Goa", "purpose": "leisure",
            "num_travellers": "2", "traveller_ages": "30, 28",
            "trip_cost": "25000", "travel_dates": "5 days",
            "visa_requirement": "none", "medical_conditions": "none",
        },
    },
    {
        "id": "travel-family-intl-standard",
        "domain": "travel",
        "tier": "standard",
        "description": "Family of four on an international holiday.",
        "profile": {
            "budget": "1500", "destination": "Singapore",
            "purpose": "family holiday", "num_travellers": "4",
            "traveller_ages": "40, 38, 12, 8", "trip_cost": "180000",
            "travel_dates": "7 days", "visa_requirement": "required",
            "medical_conditions": "none",
        },
    },
    {
        "id": "travel-senior-intl-premium",
        "domain": "travel",
        "tier": "premium",
        "description": "Senior couple on a long overseas trip with a medical condition.",
        "profile": {
            "budget": "4000", "destination": "USA",
            "purpose": "visiting family", "num_travellers": "2",
            "traveller_ages": "66, 63", "trip_cost": "350000",
            "travel_dates": "21 days", "visa_requirement": "required",
            "medical_conditions": "hypertension",
        },
    },

    # ── Property / Home (Emma AI) ────────────────────────────────────────────
    {
        "id": "property-renter-budget",
        "domain": "property",
        "tier": "budget",
        "description": "Tenant insuring only belongings on a small budget.",
        "profile": {
            "budget": "300/month", "property_type": "rented apartment",
            "property": "2BHK", "location": "Salem", "property_value": "0",
            "contents_value": "250000", "construction_type": "rcc",
            "property_age": "10", "security_system": "none",
        },
    },
    {
        "id": "property-homeowner-standard",
        "domain": "property",
        "tier": "standard",
        "description": "Owner of a metro apartment with basic security.",
        "profile": {
            "budget": "1200/month", "property_type": "owned apartment",
            "location": "Coimbatore", "property_value": "4500000",
            "contents_value": "800000", "construction_type": "rcc",
            "property_age": "6", "security_system": "cctv",
        },
    },
    {
        "id": "property-villa-premium",
        "domain": "property",
        "tier": "premium",
        "description": "High-value independent villa with full security.",
        "profile": {
            "budget": "4000/month", "property_type": "independent villa",
            "location": "Chennai", "property_value": "18000000",
            "contents_value": "3000000", "construction_type": "rcc",
            "property_age": "3", "security_system": "cctv, alarm, guard",
        },
    },
]
