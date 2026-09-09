# The utility tree — construction and prioritization

Loaded when step 5 runs. Source: CMU/SEI-2000-TR-004 §7 and §8 step 5
(https://www.sei.cmu.edu/documents/629/2000_005_001_13706.pdf).

The tree's purpose, verbatim:

> *"used to translate the business context first into quality attribute drivers and then into
> concrete scenarios that represent each business driver. Each scenario is described in terms of a
> stimulus and the desired response. These scenarios are prioritized in terms of how important they
> are to the overall mission of the system and the perceived risk in realizing them."*

## The four levels

```
Utility
└── Quality attribute driver          performance, availability, security, modifiability, …
    └── Refinement                    the specific concern under that attribute
        └── Scenario                  stimulus → desired response
            └── (importance, risk)    two independent H / M / L ratings
```

The tree is built **top-down from the business drivers of step 2**, never from the architecture.
Starting from the architecture produces the attributes the system already happens to be good at,
which is how an evaluation reaches a comfortable conclusion without touching the question.

## Scenarios

A scenario is a **stimulus** and a **desired response**, both concrete enough that two people would
agree whether the system met it. "The system should be fast" is not a scenario; it is a refinement
with the scenario still missing.

Illustration, not a citation — the shape, filled in:

| Attribute | Refinement | Scenario (stimulus → response) | (Importance, Risk) |
|---|---|---|---|
| Performance | Transaction latency | 1000 concurrent checkouts arrive → p99 completes under 300 ms | (H, H) |
| Availability | Node loss | One application node dies mid-request → no request is lost, recovery under 30 s | (H, M) |
| Modifiability | New payment provider | A provider is added → one adapter module changes, no schema migration | (M, H) |
| Security | Credential compromise | A leaked service token is used externally → blast radius is one bounded context | (H, H) |

## The two ratings are independent, and that is the point

- **Importance** — how much this scenario matters to the system's overall mission. Comes from the
  business drivers, so the stakeholder sets it, not the evaluator.
- **Risk** — how hard the evaluator judges it to be to *achieve* this response in this architecture.

Rate them separately and never collapse them into one score. The cell that drives the whole
evaluation is **(H, H)**: important to the mission and hard to realize here. Analyze those first in
step 6, and if the budget runs out, that is the honest place to stop — record the unanalyzed
scenarios as `SKIP`, with "budget" as the reason.

`(H, L)` scenarios are where non-risks come from: important, and the architecture already handles it.
Record them with the assumption they rest on rather than skipping them for being uninteresting —
that assumption is the tripwire for the day the system changes around it.

## After step 7

Step 7 brainstorms scenarios with stakeholders, and step 8 re-runs the analysis against them. When a
brainstormed scenario has no home in the tree, it exposed a driver step 2 missed: add the branch,
rate it, and say in the report that it arrived from step 7 rather than from the business drivers.
