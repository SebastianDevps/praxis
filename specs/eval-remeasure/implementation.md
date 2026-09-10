---
title: Eval Remeasure
stage: implemented  # new → designed → planned → implemented → shipped
owner: Sebastian
---

# Eval Remeasure — Implementation

## Tasks
- [x] T01 · phase: build · state: done · Repair the T09 driver + a gate against the rot
      files:  evals/value/runs/t09-driver.mjs, evals/value/units.mjs, tests/
      verify: import gate proven both directions; every binding resolves
- [x] T02 · phase: verify · state: done · Re-measure ADR-007 under iteration, Bash permitted
      files:  evals/value/units.mjs, evals/value/RESULTS.md, evals/value/runs/**
      verify: node --test observed running; n≥3 per arm; counts and cost reported

Waves: {T01, T02} parallel — disjoint except `units.mjs`, which T01 touches only if the repair
belongs on that side. T01 reports first if it does, and T02 rebases onto it.

## Completed
- T01 · **The direction was units.mjs, and it is provable rather than chosen.** Two committed
  documents assert the fixture and task live in the unit — `units.mjs:464` ("the fixture, the task
  and the scoring live here with the other units") and `RESULTS.md:281` ("imports the fixture and
  scorers from `units.mjs`") — while `INVESTIGATION_SUITE` carried only `skills` and `extra`. Git
  says the shortfall was never a regression: `0ed1959` added the export in that shape and nothing
  since removed a field (`[git log -S investigationSuite]` → one hit, and only in prose). The driver
  was stale on the *name* — it already read `U.INVESTIGATION_SUITE` two lines below its
  `U.investigationSuite` — and the unit was short of the *data*.
- T01 · **The restored data is recovered, not invented.** Every field came out of the five preserved
  `runs/investigation-*.state.json` files and the five surviving fixture directories, and each one is
  checked against them: `[node scratchpad/t01-repro-proof.mjs]` → `ALL CHECKS PASS`, 5 cells × 7
  checks — prompt rebuilt from `U9.ask` byte-identical to the recorded prompt in all five arms,
  `target`/`mode`/ablation list identical, and both seeded files byte-identical to disk (411 B, 1059 B).
- T01 · **The repaired driver reproduces the published table.** `[node evals/value/runs/t09-driver.mjs
  rescore]` → treatment r1 `a=0/0 d=2 FAIL`, r2 `a=21/21 d=3 PASS`, skills-off r1 `a=19/20 d=0 FAIL`,
  r2 `a=27/30 d=2 PASS`, bare r1 `a=0/0 d=0 FAIL` — cell for cell what `RESULTS.md` §"Result" records,
  and `investigation-results.json` came back byte-identical (`[diff -q]` → no output). No grid was run;
  this task spent nothing.
- T01 · **The gate: `tests/eval-drivers.test.mjs`**, 6 tests, static like the rest of the suite —
  no eval harness is imported, because a gate that can start a run is not a gate. It reads every
  `.mjs` under `evals/*/runs/`, not only T09.
- T01 · **Proven in both directions, three mutations.** Rename the export → `not ok 4 … reads names
  its module does not export: INVESTIGATION_SUITE`. Reintroduce the original defect verbatim →
  `not ok 4 … investigationSuite`. Break a *different* driver (`t10`, named import) → `not ok 6 …
  runUnitt (named import from evals/value/run.mjs)`. Restore after each → `# pass 6 # fail 0`.
  `node --check` passed on all three, which is why it was never the gate.
- T01 · **The gate found a false positive on its first run and the mechanism was fixed, not the
  assertion.** `t05-scorer-proof.mjs` writes fixture source containing `import { now } from
  "./clock.js"` inside a template literal; the scan read it as a real import. Imports now count only
  at a statement start. The residual looseness is written into the file rather than hidden: a
  template literal whose own column 0 holds an `import` still reads as code — `units.mjs` has that
  shape at 139, 219, 300 and 776, and only drivers are scanned.
- Chosen over the ADR-008 follow-up because the craft's cost is recurring on every builder dispatch
  while the four investigation skills cost only when they activate, and because ADR-007's measurement
  flaw is precisely diagnosed rather than suspected.

- T02 · **The condition held, and it is read out of the streams rather than claimed.** The fix was
  the permission layer, not node: `node --version` was always allowed and `node --test` never was, so
  `--allowedTools "Bash(node:*)"` was added following `evals/floor/run.mjs:31`. Across the grid
  `[node evals/value/runs/t02-iter-driver.mjs rescore]` → **71 test runs executed, none refused the
  way ADR-007's nine cells were**, and the builder went red on its own work and fixed it in **4 of 6
  cells**. Every run is attributed to the agent that issued it via `parent_tool_use_id`.
- T02 · **The condition detector was proved in both directions before it was trusted.** Run backwards
  over ADR-007's saved streams it reports zero for every cell — `[node ... iteration
  comments-treatment-r1]` → `{"testCommands":9,"testRunsExecuted":0,"testRunsDenied":9,...}`,
  `builderIterated: false`. A detector that could only say "yes" would have been the same GAP one
  level up.
- T02 · **A probe cell was bought, read, and discarded — $3.39 — and it is the most transferable
  finding here.** It showed 26 test runs and 9 reds and looked like textbook iteration. Attribution
  said `praxis:engineer` — **1 run, 0 red**; every red belonged to the refuter agents mutating code in
  a scratch directory. The builder never failed. **A test suite the model can satisfy by reading it is
  a specification, not a failing test.** Kept at `runs/discarded-probe.*`, not deleted.
- T02 · **The fixture was rebuilt so the builder's own first pass fails, and the red is measured
  rather than hoped for.** A performance budget was added, benchmarked on this machine: pointer
  `12 ms` · prefix-walk `4,187 ms` · naive filter `28,317 ms`, budget `1,500 ms`. **The discarded
  probe's own emitted code fails it** — `[node --test tests/*.test.mjs]` → `not ok 32 … took 4474ms`,
  green on the other 31. Proven four directions: no modules → both imports unresolvable; first-match
  policy → 5/11 red; the probe's code → red on the budget only; correct modules → `# pass 32 # fail 0`.
- T02 · **Result: another GAP, and the craft did not beat its control.** 652 emitted code lines and
  34 comments; **0 restatements · 0 banners · 0 CoT · 0.00 redundant per 100 in every cell of both
  arms**. Treatment 324 lines / 16 comments, control 328 / 18. Green verified by the driver re-running
  the suite itself on the emitted files, not by the model's report. Written up unsoftened as
  `RESULTS.md` § Unit 10.
- T02 · **The scorers were re-proved before spending and were not touched.**
  `[node evals/value/runs/t05-scorer-proof.mjs]` → `19/19 proof checks pass`. Repo suite
  `[node --test tests/*.test.mjs]` → `# pass 291 # fail 0`, including T01's driver gate, which picked
  up the new driver on its own (6 → 7 tests).
- T02 · **The ablation reproduces ADR-007 exactly**: `[node ... injection]` → treatment 14,237 bytes
  `craftSection: true`, control 9,552 `false`. The craft's standing cost is unchanged at **4,685 bytes
  per builder dispatch**, and this run found nothing bought with it either.

## Blocked
- none

## Session Notes
- T02 · **The condition held in 4 of 6 cells, not 6** — control r2 and r3 got both modules right first
  time. Treatment sampled it 3/3, control 1/3, and at n=3 that asymmetry is not something the run
  averages away. Named in RESULTS.md rather than smoothed.
- T02 · **The corpus is thin — 652 lines / 34 comments against ADR-007's 2,102 / 125.** This run
  improves the channel and loses volume; it does not dominate the first run on both axes, and a zero
  over 34 comments is weaker per-observation evidence than a zero over 125.
- T02 · **`constraintNoted` reversed direction**: 9/9 in ADR-007, **1/6 here, and the one cell is a
  control cell**. The planted `originEpochMs` rebase went uncommented in all three treatment cells.
  One cell of difference at n=3, nothing rests on it, but it points against the craft and is recorded.
- T02 · **10 of 81 test commands were still denied** — a shell `for` loop the analyser cannot read
  statically, and two refuter attempts to work under `/tmp`, outside the session's working directory.
  None was `node` being refused, and the builder's own loop ran in every cell.
- T02 · **DECISION OWED TO THE OWNER, not taken here.** ADR-007 recorded the craft as "unmeasured, not
  proven" and named the eval that would settle it. That eval has now run at n≥3 per arm under the
  condition it named, and the answer is 0.00 against 0.00 at 4,685 bytes per builder dispatch. This
  task measures; it does not revise the craft, the hook, or ADR-007's disposition — `design.md` § Out
  puts that outside scope, and the ADR is the owner's to amend.
- T01 · **GAP, stated rather than ticked: the gate is local-only.** `.gitignore` excludes
  `evals/*/runs/`, so a fresh clone — CI included — has no driver for it to check. Rather than let
  the loop generate zero tests silently, the absence is a named skip: in a checkout without the
  directory, `[node --test]` → `ok 1 - eval drivers are present to check # SKIP no evals/*/runs/*.mjs
  in this checkout — the directory is gitignored, so this gate is local-only`, `# skipped 1`. It runs
  for real only on a machine that holds the run workspaces. Committing the drivers would change that,
  and that is a call for the owner, not for this task.
- T01 · **`evals/value/units.mjs` was touched** (T02's file). The change is purely additive to
  `INVESTIGATION_SUITE` — five fields and two module-private consts above it; no existing export,
  scorer or signature was altered, and the full suite is green either side of it.
- The previous run's own words are the brief: a GAP is not a tie, and the reason it was a GAP is that
  `node --test` was denied in all nine cells.
- T03 · the craft removed, the hook kept. The dispatched agent was interrupted mid-task after the
  agents and the generator; the orchestrator finished the recited surfaces (`hooks/context/contract.md`,
  `skills/using-praxis/references/claude-code-tools.md`, `AGENTS.md`), the README crafts count, the
  CHANGELOG `[Unreleased]` entry, and the two craft assertions in `tests/hooks.test.mjs`.
  Those assertions behaved exactly as T04 of the previous change reshaped them to: one failure,
  reading `design's craft count moved — confirm the number`, which is a true statement about the
  change rather than "the wiring is broken". Updating them was confirming a number, not repairing a
  break.
  ADR-001 confirmation, run literally:
  `fd -t d comment-discipline crafts` → 0 · `rg -c 'comment-discipline' agents/ hooks/context/ skills/using-praxis/` → 0
  `fd -t d -d 1 . crafts` → 6 · README reads `**6** crafts` — PASS
  What was kept, verified rather than assumed: `hooks/pre-tool-use` and `hooks/lib.sh` still carry the
  tier-1 gate (`comment_gate`, `praxis_scan_comments`), `skills/codebase-design/references/COMMENTS.md`
  is present, `agents/reviewer.md` still carries the Uninformative Doc Comment bullet, and
  `RESULTS.md` still holds Units 9 and 10 — PASS.
  Gates: `node --test tests/*.test.mjs` → `tests 291 · pass 291 · fail 0`; `tests/hooks.test.mjs`
  alone → `74 pass, 0 fail`, so the removal did not take the proven part with it;
  `validate-resources` → `67 passed, 0 failed` (68 → 67, the removed craft);
  `build-cursor-crafts.mjs` regenerated, no drift beyond the deleted rule — PASS.
