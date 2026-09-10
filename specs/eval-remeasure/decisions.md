---
title: Eval Remeasure
---

# Eval Remeasure — Decisions

## ADR-001 — The comment-discipline craft is removed; the hook stays

**Status:** accepted — approved by the owner. **Supersedes `specs/comment-discipline/` ADR-007.**

**Context.** The craft was measured twice.

```
Unit 9  (single-shot)   treatment 0.00 · control 0.00 · bare 0.00   2,102 lines, 125 comments, $13.98
Unit 10 (under iteration) treatment 0.00 · control 0.00              652 lines, 34 comments, $21.91
```

ADR-007 kept it on one argument: the first run could not have detected an effect, because
`node --test` was denied in all nine cells and no arm ever iterated against a failing test — the
channel [claude-code#65961](https://github.com/anthropics/claude-code/issues/65961) names. That
argument was correct and it has now been spent. Unit 10 ran under exactly that condition: **71 test
runs executed, and the builder fixed its own red in 3/3 treatment cells.** The emitted code was
clean in both arms anyway.

One signal moved in the wrong direction and is the reason this is not merely "unproven". The craft's
first purpose is Ousterhout's Mistake #2 — the non-obvious left undescribed — and `constraintNoted`
fell from 9/9 to 1/6, with that single cell being a **control** cell. On the comment it most wants to
increase, the craft is not measurably increasing it.

**The cost is certain and recurring:** 4,685 bytes injected into every dispatch that writes code,
forever, against a benefit measured at zero twice.

**Decision.** Remove `crafts/comment-discipline/` and its wiring. Keep everything that was proven or
is nearly free:
- **`hooks/pre-tool-use`'s tier-1 gate stays.** T02 proved it per pattern in both directions, with
  22 legitimate comments allowed and 0 false positives across 71 real source files. That evidence is
  independent of the craft and is untouched by this.
- **`skills/codebase-design/references/COMMENTS.md` stays.** It loads only when that skill activates,
  so it carries no standing cost, and it closes a real gap: the skill imported Ousterhout's module
  vocabulary and skipped the chapters he wrote about comments.
- **The `reviewer` tier-2 bullet stays.** One line, in a read-only agent, on the review turn.

**Consequences.** Praxis's comment discipline is now mechanical and narrow rather than mechanical and
advisory. Four patterns never reach a file; the judgment layer is gone from the build turns and
survives only where it is read on purpose. If the defect the owner reported is real in interactive
sessions — the one channel neither run sampled — this removes the only thing that addressed it there,
and the honest way to bring it back is a measurement, not an argument.

**Why not shrink it instead.** Considered and rejected: a shorter craft would cost less and is still
untested, which trades a known-zero benefit for a smaller unknown one. The minimalism craft's own
rule applies to itself — prefer the change that removes more lines.

**Confirmation.** `fd -t d comment-discipline crafts` → empty; `rg -n 'comment-discipline' agents/
hooks/context/ skills/using-praxis/` → no craft requirement or recited-list entry; the crafts count
on every surface reads 6; the tier-1 hook tests still pass unchanged.

---

## ADR-002 — Two measurements that returned zero are kept, not deleted

**Status:** accepted

**Context.** Units 9 and 10 cost $35.89 between them and established that a shipped feature bought
nothing. The tempting cleanup is to delete the unit and the write-ups along with the craft.

**Decision.** Both units, both drivers and both `RESULTS.md` sections stay exactly as written,
including Unit 10's two named weaknesses — the thin corpus, and `constraintNoted` reversing.

**Why.** They are the evidence for the removal. A repository that deletes the measurement once it has
acted on it cannot be checked by anyone, which is the whole reason this project publishes them.
Unit 10 is also the only worked example in the repo of catching a run that could not sample its own
condition: a $3.39 probe showed 26 test runs and 9 reds, and attribution by `parent_tool_use_id`
proved every red belonged to the refuter agents rather than the builder. That method is worth more
than the result it produced here.

**Confirmation.** `rg -n 'Unit 9|Unit 10' evals/value/RESULTS.md` resolves after the removal ships.
