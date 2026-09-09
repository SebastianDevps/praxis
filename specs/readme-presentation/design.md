# README as a Presentation Card — Design

## Overview
The README is the plugin's front door, not its engineering record. Reorganize it so it says what
Praxis **is** and what it does for the reader, and move internal process — unproven status, ADR
references, instrument defects, per-change decisions — out to where it belongs.

## Problem Statement
The investigation-suite change pushed internal material into the README:
- A paragraph on the boundary gate's own defect and how it was fixed (`scripts/boundary-audit.mjs`,
  a ratchet over 54 boundaries). That is an internal instrument detail.
- A paragraph stating four shipped skills are **unproven**, with n=1 caveats and a follow-up plan.
  A presentation surface does not tell a prospective user that part of what they are installing has
  no evidence behind it.
- Method sourcing written as a justification trail ("the gap is real outside Praxis too", "so the
  method went in as cited text rather than paraphrase") rather than as a capability.

Separately, the section order grew by accretion. "What it does with code you don't own" landed
between "How it engineers" and "Why Praxis", splitting the engineering story in two.

## Scope
### In
- Remove every internal-process statement from `README.md`: unproven status, ADR language, the
  boundary-gate defect, n=1 caveats, follow-up plans.
- Rewrite the investigation section as a capability, not a justification.
- Reorder sections so the document reads as: what it is → what you see → how you control it → what
  it does → what's inside → how to check it.
- Keep the rigor claim and the measured results that support it; the specific negative findings move
  to the `measurement` branch and `evals/`, which the README links to.

### Out
- `specs/`, `evals/value/RESULTS.md`, `CHANGELOG.md`, ADRs. The engineering record stays complete and
  unedited — this change moves nothing out of it, it only stops duplicating it on the front door.
- Any claim that becomes false by removal. Nothing here is deleted to hide it; it is deleted because
  the README is the wrong surface for it, and it remains readable where it lives.

## Technical Design
One file, `README.md`. Section order:

```
Praxis + install                  what it is, in three lines
What it looks like                the Run Card
You set the intensity             the dial
Every change leaves a folder      the spec contract
How it engineers                  the six phases
What it assesses                  /praxis:investigate, as a capability
Why Praxis                        the bullets
What's inside                     the counts
Team memory · The autonomous loop
What the measurements say         the rigor claim + the results that support it
Development · Cross-platform · License
```

## Acceptance
- [ ] `rg -i 'unproven|ADR-|n=1|follow-up eval' README.md` → empty
- [ ] `node --test tests/*.test.mjs` → 0 fail (the inventory tests read this file)
- [ ] `node scripts/validate-resources.mjs` → 0 failed
- [ ] Every count in "What's inside" still matches disk
- [ ] No claim removed here becomes unfindable: the negatives remain in `evals/value/RESULTS.md`
      and on the `measurement` branch
