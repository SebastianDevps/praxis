---
name: test-coverage-plan
description: Use when planning what to test for a change (test plan, what to test, testing strategy) — lists behaviors and edge cases, maps each to a unit/integration/e2e level, and flags gaps.
kind: skill
od:
  category: testing
  triggers:
    - "test plan"
    - coverage
    - "what to test"
    - "testing strategy"
---

## Process

1. **List behaviors.** For the change being made, enumerate each distinct behavior (happy path + variants). One bullet per behavior.
2. **List edge cases.** Boundaries, empty inputs, concurrency, error paths. If a behavior can fail, the failure is a separate case.
3. **Assign test level.** For each case: unit (pure function, no I/O), integration (module boundary, real dep), or e2e (full stack, browser). Default to the lowest level that exercises the behavior.
4. **Flag gaps.** Cases that have no test level assigned, or where the right level would be expensive, are gaps. Call them out — don't silently drop them.
5. **Check pyramid balance.** Count unit : integration : e2e. If e2e > 20% of total, revisit — you are over-weighting the slow and brittle tier.

## Output Format

| Behavior | Edge Case? | Level | Gap? |
|---|---|---|---|
| Creates user on valid input | — | unit | — |
| Rejects duplicate email | — | integration | — |
| Returns 422 on invalid payload | — | integration | — |
| Works with concurrent requests | yes | integration | yes — not yet written |
| Full signup flow in browser | — | e2e | — |

Keep the table short: one row per test case, not one row per line of code.

> Curated from vibecode vc-test-coverage-plan.
