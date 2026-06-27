---
name: learn-graduate
description: Use when a candidate learned skill must be pressure-tested before it is trusted (promoted to active).
kind: skill
od:
  category: memory
  triggers:
    - "graduate skill"
    - "promote candidate"
    - "pressure-test skill"
    - "trust learned skill"
---

# Learn-Graduate — the probation gate

A candidate learned skill is a HYPOTHESIS, not a trusted procedure. Graduation is the gate that turns
it into settled practice — or discards it. Operates on one candidate under `.praxis/memory/skills/`.
Follows the `praxis-memory` contract.

This is **verify-before-store** (Voyager: a skill enters the library only after it provably solves the
task) plus a **test-gate** (GEPA/Hermes: promote only what beats its own bar on a held-out trial).

## The gate

1. **Construct a mini-eval.** Take the recurring task that taught the candidate — the real situation it
   claims to handle. Re-run that task using ONLY the candidate skill as guidance. One concrete,
   checkable trial, not a vibe.

2. **Judge with fresh eyes.** The evaluation MUST be separate from the author — a fresh/independent
   pass (a sub-agent or a clean-context judge), never the same reasoning that wrote the skill. An
   author grading their own work passes everything. Judge against an observable criterion: did the
   candidate produce the right outcome on its own?

3. **Decide:**
   - **Pass** → promote `metadata.status: candidate → active`, set `last_verified` to today, raise
     `confidence`. Move its line in `index.md` from `## Candidates` to `## Learned skills (active)`.
   - **Repairable miss** → fix the skill body, then re-run the gate. Do not promote on a patched-but-
     untested skill.
   - **Fail** → discard it: delete the skill dir and its `## Candidates` line. A skill that cannot pass
     its own task is worse than none — it would mislead with false authority.

## Why probation exists

Without a gate, every captured guess becomes trusted doctrine, and the memory fills with plausible-
but-wrong procedures that the agent then follows confidently. The gate is what makes an `active` skill
mean something: it earned its trust on a real trial, judged by someone other than its author.
