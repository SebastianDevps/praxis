---
name: strategy-compare
description: Use when 2–4 plausible approaches exist and you must pick one (which approach, how should we do this) — scores scope fit, risk, effort, and reversibility, surfaces ties, and recommends one.
kind: skill
od:
  category: reasoning
  triggers:
    - strategy
    - which approach
    - compare options
    - "how should we do this"
---

## When to use

Before committing to an approach for a substantial change when two or more plausible paths exist. Never pick silently between meaningful alternatives.

Do not run this on trivial changes (single file, no new behavior — just do it).

## Steps

1. **Name 2–4 candidates.** More candidates add noise; fewer miss the real alternative.

2. **Score each on four signals:**

   | Signal | Question |
   |---|---|
   | Scope fit | Does it match the actual problem — no more, no less? |
   | Risk | What can go wrong, and how bad is the worst case? |
   | Effort / cost | Rough relative cost vs. the simplest option (1×, 2×, 3×). |
   | Reversibility | Can you undo this if it turns out wrong? |

3. **Estimate relative cost.** Absolute estimates are unreliable; relative is not. Pick the simplest option as the 1× baseline.

4. **Surface ties.** If two candidates are within noise on all four signals, present both to the user. Never resolve a tie silently — the user holds the deciding context.

5. **Recommend one.** State which candidate wins and why in one sentence. If there is a tie, name the specific factor you would want the user to break.

## Anti-patterns

- Listing options without recommending one (that offloads your analysis to the user).
- Recommending based on familiarity, not the four signals.
- Running this on changes where only one reasonable path exists.

> Curated from vibecode vc-agent-strategy-compare.
