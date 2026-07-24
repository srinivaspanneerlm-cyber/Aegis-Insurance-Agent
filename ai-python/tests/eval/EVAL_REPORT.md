# Aegis AI — Recommendation Evaluation Report

> Generated from the deterministic evaluation harness in `tests/eval/`
> (Phase 8.1). The harness is **LLM-free and side-effect-free**: it drives the
> four rule-based specialist engines directly on plain dicts, so it writes no
> customer data and runs on every push in CI.

## 1. What is evaluated

All four specialist recommendation engines share one contract —
`get_top3_recommendations(profile) → envelope` — computed by pure, rule-based
scoring:

| Advisor | Domain | Engine |
|---|---|---|
| Sarah | health | `health_engine.py` |
| Alex | motor | `motor_engine.py` |
| Ethan | travel | `travel_engine.py` |
| Emma | property | `property_engine.py` |

They are exercised across **13 realistic, mission-aligned personas** (a rural
senior on a tight budget, a first-time buyer, a metro family, and so on) spanning
every domain and budget tier — see `personas.py`.

## 2. Quality invariants (must hold for every persona)

`test_recommendation_quality.py` asserts the properties that define a trustworthy
recommendation, for **all** personas on **all** engines:

- **Stable envelope** — `type = multi_plan`, `category` matches the domain,
  exactly 3 ranked plans, `recommended` = the rank-1 plan.
- **Bounded scores** — every score dimension is within `[0, 100]`.
- **Honest ranking** — plans are ordered by descending `overall`; the
  recommended plan is the maximum.
- **Determinism** — the same profile yields the same recommendation twice.
- **Advisory narrative** — every plan carries `why_this_plan`, `future_benefits`,
  `claim_experience`, and `benefits`.
- **No profile mutation** — the engine treats the customer profile as read-only.
- **Segment monotonicity** — within a domain, a larger budget never drops a
  customer into a lower tier.

## 3. Regression baselines

- `test_recommendation_regression.py` pins each persona's **decision** (segment,
  recommended plan, ranked names + overall scores) in
  `golden/recommendations.json`. Any engine change that moves a recommendation
  shows up as a reviewable diff.
- `test_prompt_regression.py` freezes the exact rendered system-prompt text for
  ordinary / Tamil / empty / **poisoned-legacy** profiles in `golden/prompts.json`,
  hardening the injection-critical profile renderer against silent drift.

Regenerate baselines after an intended change:

```bash
UPDATE_EVAL_GOLDEN=1 ./venv/bin/pytest tests/eval/
```

## 4. Current baseline (from `golden/recommendations.json`)

| Persona | Domain | Segment | Recommended plan |
|---|---|---|---|
| health-rural-senior-budget | health | Budget | Essential Care Plus |
| health-metro-family-standard | health | Standard | Complete Care |
| health-firsttime-premium | health | Premium | Premium Elite |
| health-coldstart-empty | health | Budget | Value Guard |
| motor-twowheeler-budget | motor | Budget | Third Party Only |
| motor-hatchback-standard | motor | Standard | Road Elite |
| motor-suv-premium | motor | Premium | Drive Supreme |
| travel-domestic-budget | travel | Budget | Travel Basic |
| travel-family-intl-standard | travel | Standard | Travel Shield |
| travel-senior-intl-premium | travel | Standard | Complete Traveller |
| property-renter-budget | property | Budget | Home Value |
| property-homeowner-standard | property | Standard | Complete Property Care |
| property-villa-premium | property | Premium | Platinum Property Guard |

Observations that fall out of the baseline (all correct, documented behaviour):

- Budget tracks segment monotonically per domain (Budget → Standard → Premium),
  **except** travel's premium-tier persona, which the engine classifies as
  *Standard* — the invariant is therefore *non-decreasing*, not strictly distinct.
- The cold-start (empty) health profile still yields a usable Budget-tier plan.

## 5. Coverage & how to run

```bash
./venv/bin/pytest tests/eval/            # all eval tests
./venv/bin/pytest tests/                 # full AI suite (eval included)
```

The eval currently adds **98 tests** to the AI suite. It is a quality safety net
for the **rule-based** recommendation path; a future step extends coverage to the
retrieval/RAG layer and (once wired) the live agent responses.
