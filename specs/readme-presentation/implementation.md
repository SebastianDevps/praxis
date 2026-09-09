---
title: README as a Presentation Card
stage: implemented  # new → designed → planned → implemented → shipped
owner: Sebastian
---

# README as a Presentation Card — Implementation

## Tasks
- [x] T01 · phase: build · state: done · Rewrite `README.md` per design
      files:  README.md
      verify: rg -i 'unproven|ADR-|n=1' README.md → empty; node --test tests/*.test.mjs → 0 fail

## Completed
- Owner's instruction: the README is the presentation card and must not carry internal state —
  "sin probar", decisions, defects. Recorded verbatim because it reverses part of what the previous
  change put there, and that reversal was mine to make wrong in the first place.
- T01 · `README.md` rewritten. Removed: the boundary-gate defect paragraph, the negative-control
  paragraph calling four shipped skills unproven, the n=1 caveats, and the follow-up plan. Also
  removed, for consistency rather than only policing my own additions: the enumerated failures that
  predate this session — the refuter panel's "the tasks were too easy", the first floor version's
  self-approval, and `tdd`'s seam stop holding 0/3. Applying the rule to my paragraphs only would
  have been arbitrary.
  Rewritten: "What it does with code you don't own" → "What it assesses", now a capability table
  (object → verdict) instead of a justification trail. "What the measurements say, including the
  ones that went against us" → "Measured, not asserted": the rigor claim plus four positive numbers,
  with the negatives pointed at rather than enumerated. The opening hook was rewritten because
  renaming that section broke its anchor.
  Nothing was deleted to hide it: every removed finding stays in `evals/value/RESULTS.md`, in
  `specs/*/decisions.md`, and on the `measurement` branch, all of which the README links to.
  Evidence: `rg -in 'unproven|ADR-|n=1|3.65|29.83|43.61|held 0/3|approved themselves'` → one hit,
  the sentence saying the write-ups include runs that went against us — PASS.
  `node scripts/validate-resources.mjs` → `67 passed, 0 failed` — PASS.
  `node --test tests/*.test.mjs` → `tests 271 · pass 271 · fail 0` — PASS (the inventory tests read
  this file, so the counts are confirmed against disk).
  `rg -n '\]\(#'` → the one internal anchor resolves to the renamed heading — PASS.

## Blocked
- none

## Session Notes
- Tension named to the owner before acting: the README's opening line, which predates this session,
  promises "the evals that came out against Praxis are published". Reading taken — what must go is
  the internal detail, not the rigor claim. The owner can still choose to drop the claim entirely.
