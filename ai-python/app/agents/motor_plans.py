"""
Aegis AI — Motor Insurance Plan Catalog
Complete internal plan registry for Alex AI.
Nine plans across three customer segments for all vehicle types.
"""

# ── Vehicle type classification ───────────────────────────────────────────────

VEHICLE_CATEGORIES = {
    "two_wheeler": [
        "bike", "motorcycle", "scooter", "moped", "two-wheeler", "2-wheeler",
        "activa", "pulsar", "bullet", "ktm", "re", "royal enfield", "tvs",
        "honda", "yamaha", "suzuki", "bajaj",
    ],
    "private_car": [
        "car", "sedan", "hatchback", "swift", "i20", "baleno", "city", "verna",
        "nexon", "brezza", "creta", "seltos", "punch", "tiago", "altroz",
        "wagon r", "alto", "dzire", "ciaz",
    ],
    "suv_muv": [
        "suv", "muv", "innova", "crysta", "fortuner", "endeavour",
        "safari", "xuv", "scorpio", "bolero", "ertiga", "marazzo",
        "hexa", "harrier", "hector", "thar",
    ],
    "luxury": [
        "luxury", "bmw", "mercedes", "audi", "jaguar", "land rover",
        "volvo", "lexus", "porsche", "bentley", "rolls", "lamborghini",
        "ferrari", "maserati", "mercedes benz",
    ],
    "electric": [
        "electric", "ev", "tata nexon ev", "mg zs ev", "hyundai ioniq",
        "kia ev6", "bmw i", "ola electric", "ather", "ola s1",
        "rivian", "tesla", "byd", "nexon ev",
    ],
    "commercial_lmv": [
        "tempo", "truck", "lorry", "van", "goods vehicle", "lmv",
        "commercial", "bolero pick up", "tata ace", "mahindra supro",
    ],
}

# ── Segment thresholds (annual premium budget in INR) ─────────────────────────

SEGMENT_THRESHOLDS = {
    "budget":   (0,       8000),   # < ₹8,000/year
    "standard": (8000,    25000),  # ₹8,000–₹25,000/year
    "premium":  (25000,   999999), # > ₹25,000/year
}

# ── Motor plan catalog ────────────────────────────────────────────────────────

MOTOR_PLANS = {

    # ════════════════════════════════════════════════════════════════════════
    # BUDGET SEGMENT
    # ════════════════════════════════════════════════════════════════════════

    "third_party_only": {
        "plan_id":         "AEG-MOT-001",
        "plan_name":       "Third Party Only",
        "segment":         "budget",
        "policy_type":     "Third Party",
        "coverage_display":"Third Party Liability",

        # Premium (indicative, final depends on RTO, CC, etc.)
        "premium_min":     2500,
        "premium_max":     5000,
        "premium_period":  "annual",

        # Core covers
        "own_damage":      False,
        "third_party":     True,
        "pa_owner_driver": "₹15,00,000 (mandatory)",
        "zero_dep":        False,
        "engine_protect":  False,
        "rsa":             False,
        "ncb":             "Not applicable (no OD cover)",
        "consumables":     False,
        "return_invoice":  False,
        "key_protect":     False,
        "tyre_protect":    False,
        "hydrostatic_lock":False,

        # IDV & Claim
        "idv":             "Not applicable (TP only)",
        "claim_process":   "Third-party claims through motor tribunal",
        "claim_ratio":     "98.1%",
        "cashless_garages":"Not applicable",
        "pa_cover":        "₹15L personal accident for owner-driver",
        "compulsory_deductible": "Nil (TP policy)",

        "benefits": [
            "Mandatory legal compliance — drive without penalty",
            "Third-party bodily injury + property damage cover",
            "₹15L PA cover for owner-driver (mandatory)",
            "Lowest premium option",
        ],
        "exclusions": [
            "Own vehicle damage not covered",
            "No theft or fire cover",
            "No add-on available",
        ],
        "suitable_for": [
            "Old vehicles (> 10 years)",
            "Extremely tight budget",
            "Low-value vehicles",
        ],
    },

    "road_guard_basic": {
        "plan_id":         "AEG-MOT-002",
        "plan_name":       "Road Guard Basic",
        "segment":         "budget",
        "policy_type":     "Comprehensive",
        "coverage_display":"OD + TP",

        "premium_min":     4500,
        "premium_max":     8000,
        "premium_period":  "annual",

        "own_damage":      True,
        "third_party":     True,
        "pa_owner_driver": "₹15,00,000",
        "zero_dep":        False,
        "engine_protect":  False,
        "rsa":             False,
        "ncb":             "20% after 1 claim-free year (up to 50%)",
        "consumables":     False,
        "return_invoice":  False,
        "key_protect":     False,
        "tyre_protect":    False,
        "hydrostatic_lock":False,

        "idv":             "Market value (age-depreciated)",
        "claim_process":   "Cashless at 2,000+ network garages",
        "claim_ratio":     "97.8%",
        "cashless_garages":"2,000+",
        "pa_cover":        "₹15L owner-driver",
        "compulsory_deductible": "₹1,000 (private car) / ₹500 (two-wheeler)",

        "benefits": [
            "Own damage + third party comprehensive cover",
            "Cashless at 2,000+ network garages",
            "NCB: 20% after first claim-free year",
            "Fire, theft, natural calamity included in OD",
            "₹15L PA cover for owner-driver",
        ],
        "exclusions": [
            "Depreciation deducted on parts (no zero dep)",
            "No engine protection (water damage)",
            "No RSA included",
            "Normal wear and tear not covered",
        ],
        "suitable_for": [
            "Vehicles 3–8 years old",
            "Budget-conscious buyers",
            "Low-risk urban/suburban drivers",
        ],
    },

    "drive_safe_starter": {
        "plan_id":         "AEG-MOT-003",
        "plan_name":       "Drive Safe Starter",
        "segment":         "budget",
        "policy_type":     "Comprehensive + RSA",
        "coverage_display":"OD + TP + RSA",

        "premium_min":     6000,
        "premium_max":     9500,
        "premium_period":  "annual",

        "own_damage":      True,
        "third_party":     True,
        "pa_owner_driver": "₹15,00,000",
        "zero_dep":        False,
        "engine_protect":  False,
        "rsa":             True,
        "rsa_services":    "Towing (50 km), flat tyre, battery jumpstart, fuel delivery",
        "ncb":             "25% after 1 claim-free year (up to 50%)",
        "consumables":     False,
        "return_invoice":  False,
        "key_protect":     False,
        "tyre_protect":    False,
        "hydrostatic_lock":False,

        "idv":             "Market value (age-depreciated)",
        "claim_process":   "Cashless at 3,000+ garages",
        "claim_ratio":     "98.0%",
        "cashless_garages":"3,000+",
        "pa_cover":        "₹15L owner-driver + ₹2L per passenger (up to 3)",
        "compulsory_deductible": "₹1,000",

        "benefits": [
            "Comprehensive OD + TP with RSA included",
            "24×7 Roadside Assistance — towing, tyre, battery",
            "Cashless at 3,000+ garages",
            "25% NCB from year 1",
            "Passenger PA cover (up to 3 passengers)",
        ],
        "exclusions": [
            "No zero depreciation",
            "No engine protection",
            "Depreciation deducted on metal/rubber parts",
        ],
        "suitable_for": [
            "Daily commuters",
            "Vehicles 2–7 years old",
            "First-time comprehensive insurance buyers",
        ],
    },

    # ════════════════════════════════════════════════════════════════════════
    # STANDARD SEGMENT
    # ════════════════════════════════════════════════════════════════════════

    "motor_shield": {
        "plan_id":         "AEG-MOT-004",
        "plan_name":       "Motor Shield",
        "segment":         "standard",
        "policy_type":     "Comprehensive + Zero Dep",
        "coverage_display":"OD + TP + Zero Depreciation",

        "premium_min":     9000,
        "premium_max":     16000,
        "premium_period":  "annual",

        "own_damage":      True,
        "third_party":     True,
        "pa_owner_driver": "₹15,00,000",
        "zero_dep":        True,
        "zero_dep_claims": "2 claims/year",
        "engine_protect":  False,
        "rsa":             True,
        "rsa_services":    "Towing (100 km), flat tyre, battery, fuel, keys locked",
        "ncb":             "30% after 1 year (up to 50%)",
        "consumables":     False,
        "return_invoice":  False,
        "key_protect":     False,
        "tyre_protect":    False,
        "hydrostatic_lock":False,

        "idv":             "Market value or declared value",
        "claim_process":   "Cashless at 5,000+ garages + doorstep pick-up",
        "claim_ratio":     "98.5%",
        "cashless_garages":"5,000+",
        "pa_cover":        "₹15L owner + ₹5L per passenger (up to 4)",
        "compulsory_deductible": "₹1,000",

        "benefits": [
            "Zero depreciation on parts — full claim amount",
            "2 zero-dep claims allowed per year",
            "Cashless at 5,000+ garages",
            "24×7 RSA (100 km towing)",
            "Doorstep vehicle pick-up for repair",
            "30% NCB from first year",
        ],
        "exclusions": [
            "No engine protection (hydrostatic/oil damage)",
            "No consumables cover",
            "Radiator, tyres not included",
        ],
        "suitable_for": [
            "Newer cars (0–5 years)",
            "Mid-range vehicles",
            "Drivers seeking full part replacement value",
        ],
    },

    "road_elite": {
        "plan_id":         "AEG-MOT-005",
        "plan_name":       "Road Elite",
        "segment":         "standard",
        "policy_type":     "Comprehensive + Zero Dep + Engine Protect",
        "coverage_display":"OD + TP + Zero Dep + Engine + RSA",

        "premium_min":     13000,
        "premium_max":     22000,
        "premium_period":  "annual",

        "own_damage":      True,
        "third_party":     True,
        "pa_owner_driver": "₹15,00,000",
        "zero_dep":        True,
        "zero_dep_claims": "Unlimited within policy year",
        "engine_protect":  True,
        "engine_protect_detail": "Hydrostatic lock, oil leakage, gearbox, engine seizure",
        "rsa":             True,
        "rsa_services":    "Towing (150 km), tyre, battery, fuel, keys, cab arrangement",
        "ncb":             "35% after 1 year (up to 50%)",
        "consumables":     False,
        "return_invoice":  False,
        "key_protect":     True,
        "key_protect_detail": "₹15,000 for lost/damaged key replacement",
        "tyre_protect":    False,
        "hydrostatic_lock":True,

        "idv":             "Declared IDV (agreed value option)",
        "claim_process":   "Cashless at 6,500+ garages + priority repair + pickup-drop",
        "claim_ratio":     "98.7%",
        "cashless_garages":"6,500+",
        "pa_cover":        "₹15L owner + ₹7.5L per passenger (up to 5)",
        "compulsory_deductible": "Nil (waiver included)",

        "benefits": [
            "Engine + gearbox protection (hydrostatic lock, oil leaks)",
            "Zero depreciation — unlimited claims",
            "Key replacement: ₹15,000",
            "RSA with 150 km towing + cab arrangement",
            "Compulsory deductible waiver included",
            "Priority repair at 6,500+ cashless garages",
            "35% NCB from year 1",
        ],
        "exclusions": [
            "No consumables (engine oil, AC gas, etc.)",
            "Tyre damage not covered",
        ],
        "suitable_for": [
            "Cars 0–7 years old",
            "Owners in flood-prone areas",
            "Anyone valuing comprehensive protection",
        ],
    },

    "drive_complete": {
        "plan_id":         "AEG-MOT-006",
        "plan_name":       "Drive Complete",
        "segment":         "standard",
        "policy_type":     "Comprehensive — All Standard Add-ons",
        "coverage_display":"OD + TP + Zero Dep + Engine + RSA + Consumables",

        "premium_min":     18000,
        "premium_max":     28000,
        "premium_period":  "annual",

        "own_damage":      True,
        "third_party":     True,
        "pa_owner_driver": "₹15,00,000",
        "zero_dep":        True,
        "zero_dep_claims": "Unlimited",
        "engine_protect":  True,
        "engine_protect_detail": "Full engine + gearbox protection",
        "rsa":             True,
        "rsa_services":    "Towing (unlimited), tyre, battery, fuel, keys, cab + hotel",
        "ncb":             "40% after 1 year (up to 50%)",
        "consumables":     True,
        "consumables_detail": "Engine oil, coolant, AC gas, brake fluid — all covered",
        "return_invoice":  True,
        "key_protect":     True,
        "key_protect_detail": "₹25,000 for key loss + locksmith charges",
        "tyre_protect":    True,
        "tyre_protect_detail": "Up to ₹20,000 for tyre sidewall damage",
        "hydrostatic_lock":True,

        "idv":             "Agreed/declared IDV (no depreciation cap)",
        "claim_process":   "Cashless + Digital claim (24-hr approval) + Pickup-drop",
        "claim_ratio":     "99.0%",
        "cashless_garages":"7,500+",
        "pa_cover":        "₹15L owner + ₹10L per passenger (up to 6)",
        "compulsory_deductible": "Nil (waiver included)",

        "benefits": [
            "All standard add-ons in one policy",
            "Consumables cover (oil, gas, coolant)",
            "Return to invoice on total loss",
            "Tyre sidewall damage: ₹20,000",
            "Unlimited RSA: towing + hotel arrangement",
            "Zero dep + engine protect unlimited claims",
            "24-hour digital claim approval",
            "40% NCB from year 1",
        ],
        "exclusions": [
            "Mechanical/electrical breakdown (non-accident)",
            "Gradual wear and tear",
        ],
        "suitable_for": [
            "New to 7-year-old vehicles",
            "Comprehensive cover seekers",
            "Frequent long-distance drivers",
        ],
    },

    # ════════════════════════════════════════════════════════════════════════
    # PREMIUM SEGMENT
    # ════════════════════════════════════════════════════════════════════════

    "bumper_to_bumper_plus": {
        "plan_id":         "AEG-MOT-007",
        "plan_name":       "Bumper-to-Bumper Plus",
        "segment":         "premium",
        "policy_type":     "Zero Depreciation + Full Add-on Suite",
        "coverage_display":"Complete Cover — Nil Depreciation",

        "premium_min":     25000,
        "premium_max":     45000,
        "premium_period":  "annual",

        "own_damage":      True,
        "third_party":     True,
        "pa_owner_driver": "₹15,00,000",
        "zero_dep":        True,
        "zero_dep_claims": "Unlimited (all parts, all claims)",
        "engine_protect":  True,
        "engine_protect_detail": "Complete powertrain protection: engine, gearbox, differential",
        "rsa":             True,
        "rsa_services":    "Nationwide RSA: towing (any distance), 5-star hotel, cab, flight rebooking",
        "ncb":             "50% after 1 year + Super NCB bonus (60% cap)",
        "consumables":     True,
        "consumables_detail": "All fluid consumables + filters + spark plugs",
        "return_invoice":  True,
        "key_protect":     True,
        "key_protect_detail": "₹50,000 for key + smart key + reprogramming",
        "tyre_protect":    True,
        "tyre_protect_detail": "Full tyre replacement (all four) up to ₹40,000",
        "hydrostatic_lock":True,
        "personal_baggage": "₹25,000 for theft of personal belongings",
        "depreciation_shield": True,

        "idv":             "Invoice value (new vehicle) / Agreed IDV",
        "claim_process":   "Cashless + Priority Claims Desk + 6-hr approval SLA",
        "claim_ratio":     "99.3%",
        "cashless_garages":"8,500+ including all authorized dealers",
        "pa_cover":        "₹15L owner + ₹15L per passenger (unlimited)",
        "compulsory_deductible": "Nil (premium waiver)",
        "claim_manager":   "Dedicated claims relationship manager",

        "benefits": [
            "Nil depreciation on all parts — 100% claim every time",
            "Complete powertrain cover (engine + gearbox + differential)",
            "Full tyre replacement: all 4 tyres up to ₹40,000",
            "Personal baggage theft: ₹25,000",
            "5-star hotel + flight rebooking if stranded",
            "Return to invoice on total loss",
            "Dedicated claims manager — single point of contact",
            "50% NCB + Super NCB from year 1",
        ],
        "exclusions": [
            "Electrical/electronic component failure (non-accident)",
            "Intentional damage",
        ],
        "suitable_for": [
            "New to 5-year-old cars",
            "Premium/luxury segment buyers",
            "Zero tolerance for out-of-pocket on claims",
        ],
    },

    "drive_supreme": {
        "plan_id":         "AEG-MOT-008",
        "plan_name":       "Drive Supreme",
        "segment":         "premium",
        "policy_type":     "All Add-ons + EV Compatible",
        "coverage_display":"Supreme Cover — Nil Dep + EV Battery",

        "premium_min":     40000,
        "premium_max":     75000,
        "premium_period":  "annual",

        "own_damage":      True,
        "third_party":     True,
        "pa_owner_driver": "₹15,00,000",
        "zero_dep":        True,
        "zero_dep_claims": "Unlimited + OEM parts guarantee",
        "engine_protect":  True,
        "engine_protect_detail": "ICE: full powertrain | EV: motor + controller + onboard charger",
        "rsa":             True,
        "rsa_services":    "Worldwide RSA + EV charging assistance + towing to nearest EV station",
        "ncb":             "60% after 1 year + Super NCB (no cap)",
        "consumables":     True,
        "return_invoice":  True,
        "key_protect":     True,
        "key_protect_detail": "₹75,000 for key fob, smart key, digital key reprogramming",
        "tyre_protect":    True,
        "tyre_protect_detail": "Premium tyre protection: run-flat + tyres up to ₹60,000",
        "hydrostatic_lock":True,
        "battery_cover":   True,
        "battery_cover_detail": "EV battery pack replacement up to ₹8,00,000",
        "personal_baggage": "₹50,000 for personal belongings",
        "depreciation_shield": True,
        "gps_tracking":    "Real-time GPS theft tracking service included",

        "idv":             "On-road price (no depreciation) for first 5 years",
        "claim_process":   "Cashless + 4-hour approval SLA + Concierge claims",
        "claim_ratio":     "99.6%",
        "cashless_garages":"10,000+ including EV-authorised service centres",
        "pa_cover":        "₹15L owner + ₹20L per passenger (unlimited seating)",
        "compulsory_deductible": "Nil",
        "claim_manager":   "24×7 dedicated senior claims manager",

        "benefits": [
            "Full EV battery pack cover: up to ₹8,00,000",
            "OEM parts guaranteed — no aftermarket substitution",
            "Worldwide RSA + EV charging rescue",
            "4-hour claim approval SLA",
            "60% NCB + unlimited Super NCB from year 1",
            "GPS theft tracking service",
            "Run-flat tyre protection included",
            "Senior dedicated claims manager 24×7",
        ],
        "exclusions": [
            "Battery degradation from normal use (>5% annual capacity loss)",
            "Racing or competitive events",
        ],
        "suitable_for": [
            "Electric vehicles and hybrids",
            "New luxury cars",
            "Customers needing maximum protection",
        ],
    },

    "platinum_drive": {
        "plan_id":         "AEG-MOT-009",
        "plan_name":       "Platinum Drive",
        "segment":         "premium",
        "policy_type":     "Ultimate Cover — Bespoke Policy",
        "coverage_display":"Platinum Cover — Agreed Value + Global",

        "premium_min":     65000,
        "premium_max":     200000,
        "premium_period":  "annual",

        "own_damage":      True,
        "third_party":     True,
        "pa_owner_driver": "₹50,00,000",
        "zero_dep":        True,
        "zero_dep_claims": "Unlimited — any workshop worldwide",
        "engine_protect":  True,
        "engine_protect_detail": "Full mechanical + electrical + EV powertrain (any country)",
        "rsa":             True,
        "rsa_services":    "Worldwide door-to-door recovery, private aviation arrangement if needed",
        "ncb":             "70% after 1 year + Cumulative Super NCB (up to 100%)",
        "consumables":     True,
        "return_invoice":  True,
        "key_protect":     True,
        "key_protect_detail": "Unlimited key replacement worldwide",
        "tyre_protect":    True,
        "tyre_protect_detail": "All-tyre global cover (no value cap)",
        "hydrostatic_lock":True,
        "battery_cover":   True,
        "battery_cover_detail": "Unlimited EV battery + charging infrastructure damage",
        "personal_baggage": "₹2,00,000 for personal belongings",
        "depreciation_shield": True,
        "gps_tracking":    "AI-driven theft prevention + live GPS fleet monitoring",
        "global_cover":    True,
        "global_cover_detail": "Drive in 180+ countries — same coverage applies",
        "bespoke_service": "White-glove concierge — Aegis Platinum Helpline: 24×7 personal agent",

        "idv":             "Agreed value (collector/exotic car option available)",
        "claim_process":   "White-glove: dedicated Platinum Claims Concierge, 2-hour resolution",
        "claim_ratio":     "99.9%",
        "cashless_garages":"Any workshop globally (no network restriction)",
        "pa_cover":        "₹50L owner + ₹25L per passenger + global medical evacuation",
        "compulsory_deductible": "Nil",
        "claim_manager":   "Platinum Claims Concierge: personal agent, no-queue guarantee",

        "benefits": [
            "Global cover — same protection in 180+ countries",
            "Any workshop worldwide — no network restriction",
            "Unlimited EV battery cover (any damage cause)",
            "AI theft-prevention + real-time fleet GPS",
            "Personal aviation arrangement if stranded abroad",
            "₹2L personal baggage cover",
            "Agreed value option for exotic/collector cars",
            "70% NCB + 100% cumulative cap",
            "2-hour claim resolution SLA",
            "White-glove Platinum Concierge 24×7",
        ],
        "exclusions": [
            "Intentional damage",
            "Participation in speed racing events",
        ],
        "suitable_for": [
            "Luxury / exotic / collector vehicles",
            "Ultra-HNI customers",
            "International drivers needing global cover",
        ],
    },
}

# Quick lookup by segment
PLANS_BY_SEGMENT = {
    "budget":   ["third_party_only", "road_guard_basic", "drive_safe_starter"],
    "standard": ["motor_shield",     "road_elite",        "drive_complete"],
    "premium":  ["bumper_to_bumper_plus", "drive_supreme", "platinum_drive"],
}
