# Eval Remeasure — Design

## Overview
Two things a published measurement needs and this repo currently lacks: a reproduction path that
runs, and a re-measurement of the one claim that shipped unmeasured at a standing cost.

## Problem Statement

**The T09 driver cannot execute.** `evals/value/runs/t09-driver.mjs:24` binds
`const U9 = U.investigationSuite`, and `evals/value/units.mjs` exports no such name — it exports
`INVESTIGATION_SUITE`, `scoreDossier`, `readDossier` and the rest. `U9` is `undefined` and is
dereferenced at lines 32, 47, 52, 59 and 68. The recorded Unit 8 results are unaffected; the path to
reproduce them is not. A published eval whose harness cannot re-run is an assertion, which is the
thing this repo publishes evals to avoid.

**The comment-discipline craft ships unmeasured at a recurring cost.** ADR-007 of
`specs/comment-discipline/` records the result: 9 cells, 3 arms, 2,102 lines, zero defects
everywhere — a GAP, not a tie. The cause was identified with evidence rather than guessed:
`node --test` was denied 22–36 times per cell in all nine, so **no arm ever iterated against a
failing test**, which is the channel [claude-code#65961](https://github.com/anthropics/claude-code/issues/65961)
reports the defect accumulating in. The craft costs **4,685 bytes on every builder dispatch** and
nothing was measured bought with it. That is the largest standing unpaid cost in the plugin.

## Scope
### In
- Repair the T09 driver so Unit 8 reproduces, and add whatever gate keeps it from silently rotting again.
- Re-run the ADR-007 measurement under the condition that produces the defect: `Bash` permitted, the
  model iterating against failing tests, over a session long enough for comments to accumulate.
### Out
- Changing the craft, the hook, or any shipped behaviour. This measures; it does not revise.
- Re-running Unit 8 itself. The driver must work; spending on that grid again is a separate call.

## Technical Design

**The repair.** Read `t09-driver.mjs` and `units.mjs` and reconcile the names against what Unit 8
actually scored. The fix is whichever direction is true to the recorded run — do not invent an
export to satisfy an import if the driver is the stale side. Then a gate: something that fails when
a driver imports a name its unit does not export. `node --check` passes today, so syntax is not it;
the cheapest honest check is importing every driver's module graph in a test.

**The re-measurement.** The previous run's two decisions stand and are re-used: both arms with
`PRAXIS_COMMENTS=off` so the craft is the only difference, and the task dispatched rather than asked
at top level, because a craft body reaches the model only through `hooks/subagent-start`
(`hooks/lib.sh:175`) and `contract.md` names the craft without carrying its text.

What changes is the condition:
- `Bash` permitted, so `node --test` runs.
- The task must **fail first and be fixed** — the model iterates, which is where #65961 says the
  comments pile up. A single-shot generation is what measured nothing last time.
- Long enough to accumulate: several fix-verify cycles, not one.

Scored on the same four criteria, per 100 emitted lines, per ADR-003 — never density: AI comment
density is 18.01% against a human 17.96%, so the metric would report clean on the defect.

n≥3 per arm. Scorer proved in both directions before spending, as the previous run did.

## Acceptance
- [ ] `node --test tests/*.test.mjs` → 0 fail, including the new import gate
- [ ] The import gate proven both directions: break an export → red; restore → green
- [ ] `node evals/value/runs/t09-driver.mjs --help` (or its equivalent entry) resolves every binding
- [ ] The re-measurement: `node --test` observed running in the treatment cells, not denied — if it
      is denied again the run measured nothing and says so rather than reporting a tie
- [ ] Per-criterion counts for both arms, n≥3, with the cost
- [ ] **If the craft still shows no effect under iteration, that is the answer.** It goes in
      `RESULTS.md` unsoftened, and ADR-007's disposition is revisited with a real number instead of
      an unsampled one.
