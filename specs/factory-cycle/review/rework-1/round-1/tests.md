---
lens: tests
round: 1
verdict: CHANGES
---
## Findings
- `hooks/pre-tool-use:246-251` (+ `hooks/lib.sh:664`) — APPROVE at ledger round >= 1 with an empty lens list is untested. Mutant "drop the non-empty guard in `praxis_round_all_pass`" survives 100% of `tests/*.test.mjs` except `eval-cycle`, yet diverges: ledger `round: 1`, `lenses:` empty, no `round-1/lenses`, `decision.md: APPROVE`, `gh pr create` → original denies ("lenses not all PASS … no lens listed"), mutant allows. So a ship with no review at all passes. The `builder_gate` hides the mutant (it denies on an empty list first); the ship gate has no test for the "no lens listed" branch. Add: APPROVE + round 1 + no lens list → deny — severity: important
- `specs/factory-cycle/design.md` Appendix ("a PASS without it is treated as SKIP") vs `hooks/lib.sh:650-657` — the rule has no mechanical owner and no test. `praxis_round_not_pass` reads only `verdict:`. Probe: round 1, `tests.md` with `verdict: PASS` and no `## What I tried to break`, `decision.md: APPROVE`, `gh pr create` → ALLOWED (empty output). The rule exists only as prose in `agents/approver.md:38` and `hooks/context/roles/approver.md:13`, so the one gate the design calls mechanical lets the no-evidence PASS ship if the approver misses it. Spec gap or missing hook rule; the human decides which, the builder does not self-amend — severity: important
- `evals/cycle/units.mjs:~290,~312` (`scoreRounds`, `scoreSubagents`) — boundaries pinned only through imported constants and one good (max 1, 6 dispatches) and one bad (max 3, 3 dispatches) fixture. Survivors: `max <= MAX_ROUNDS` → `<` (round 2 would FAIL), `>= MIN_SUBAGENTS` → `>` (exactly 4 dispatches would FAIL, which is the EAG threshold). Both diverge on a concrete cell (max 2 / count 4) and `tests/eval-cycle.test.mjs` has no such case — severity: important
- `evals/cycle/units.mjs` (`scoreDecision`, `scoreShip`, `measureCost`) and `tests/eval-cycle.test.mjs` — the GAP state is produced end to end only by the matrix comparison and by `barrier_order` on a synthetic cell. Never produced: `ship_after_approve` GAP ("decision.md not written through Edit/Write"; mutant `if (false)` survives) and `cost` GAP ("a leg ended without a result line"; mutant `state: "PASS"` survives). `decision_present` with ESCALATE or `APPROVE (human)` is never run (regex narrowed to `APPROVE` survives; the ESCALATE cases go through `scoreShip` only). `spec_before_source` SKIP "spec written, no source" → PASS survives; `orderOk` forced true survives. The claim "four states are produced" holds for PASS, FAIL, SKIP; GAP is half-covered — severity: important
- EAG rows 3, 4, 5 — row 3 (3 live cells), row 4 (tokens on the 4 matrix tasks) and row 5 (trap task, `[NEEDS CLARIFICATION]` ≥ 2/4) have no passing evidence. `evals/cycle` is dry-run only: the stub never fires the hooks (README says so), so scorers are validated against a transcript shape the stub invented. README states rows 3 and 4 as GAP; row 5 has no scorer, no fixture, and is not named a GAP anywhere in `evals/cycle/README.md`. GAP, not PASS — severity: minor
- `tests/hooks.test.mjs:634` — `decision()` maps empty stdout to "allow", and the harness only fails on a non-zero exit, while the hooks run `set -uo pipefail` without `-e`. Every allow-side assertion (ship allowed with APPROVE + all PASS, round 1 → 2 fix round, `design.md` accepted) is satisfied equally by a hook that silently fell through. The deny-side tests save it today (killed mutants M1, M3, M7, M8, M14), but no allow test checks the trace line or the reason it allowed — severity: minor
- `tests/hooks.test.mjs` — survivors with no test: `git|*/git)` → `git)` (`/usr/bin/git push praxis/x` is no longer gated); the `$0 !~ /\//` filter in `praxis_round_lenses` (lens name with `/`); frontmatter scoping in `praxis_frontmatter_read` (without `fm && /^---/ exit`, a body line `verdict: PASS` in a file whose block has no verdict reads as PASS); `post-tool-use` matching only `specs/<active>/decision.md` (any `decision.md` triggers the marker); `decision_record` running in `fast` (the header says "every mode") — severity: minor
- Baseline count — the suite is 360/360 in the working tree, not 349. `tests/eval-cycle.test.mjs` and `evals/cycle/` are untracked, so `git diff main...HEAD` and the committed HEAD do not contain the tests that cover the eval scorers — severity: minor

## What I tried to break
State: HEAD 632e642 plus the dirty working tree (other builders were editing `scripts/approve.sh`, `scripts/rework.sh`, `scripts/worktree.sh` during the run). Mutants were applied to a scratchpad copy (`…/scratchpad/m`), never to the repo. Hook-side mutants ran `tests/{hooks,approve,loop,scripts,invariants,references,manifest}` (+ `eval-cycle` for set 1); scorer mutants ran `tests/eval-cycle.test.mjs`.

Set 1, hook/script rules (rule → test):
- M1 round cap `-lt 2` → `-le 2` → killed (3 fail)
- M2 `praxis_round_all_pass` true on empty lens list → SURVIVED; divergence proven by hand (finding 1)
- M3 ship gate rejects `APPROVE (human)` → killed (2)
- M4 `approve.sh` skips the needs-human marker check → killed (3)
- M5 `worktree.sh` does not seed `spec.md` → killed (2)
- M6 `post-tool-use` creates needs-human on APPROVE → killed (1)
- M7 ship APPROVE ignores round 0 → killed (1)
- M8 barrier ignores missing lens file → killed (4)
- M9 `gh pr create` not recognised as a ship → killed (5)
- M10 main thread may write any review verdict → killed (1)
- M11 `approve.sh` writes `APPROVE` instead of `APPROVE (human)` → killed (2)
- M12 `rework.sh` does not reset `round` → killed (2)
- M13 `post-tool-use` does not remove the marker on APPROVE → killed (1)
- M14 SKIP/no-verdict counts as PASS (`!= CHANGES`) → killed (3)
- M15 barrier starts at round 2 (`-gt 1`) → killed (4)
- M16 ledger `lenses:` fallback removed → killed (2)
- M17 Edit/Write to `.praxis/needs-human/*` allowed → killed (1)
- M18 `rework.sh` leaves the marker → killed (1)
- M19 `approve.sh` leaves the marker → killed (2)
- M20 `approve.sh` skips `stage: implemented` → killed (1)
- M21 SendMessage to anyone is gated → killed (1)
- M22 `rework.sh` copies instead of moving `decision.md` → killed (1)
- M23 `worktree.sh` does not record `praxisBase` on creation → SURVIVED, equivalent: `recorded_base` records it on the next line when `$base` is set, and `base` is always set on that path. Not reported.
- M24 `worktree.sh` does not seed the approved marker → killed (2)
- M25 `worktree.sh` does not seed `active-change` → killed (2)

Set 2, eval scorers:
- S1 `max <= MAX_ROUNDS` → `<` → SURVIVED (finding 3)
- S2 `>= MIN_SUBAGENTS` → `>` → SURVIVED (finding 3)
- S3 decision regex narrowed to `APPROVE` → SURVIVED (finding 4)
- S4 `orderOk` forced true → SURVIVED (finding 4)
- S5 ship GAP branch removed → SURVIVED (finding 4)
- S6 cost always PASS (GAP unreachable) → SURVIVED (finding 4)
- S7 ESCALATE + `pr create` → PASS → killed (1)
- S8 spec_before_source SKIP → PASS → SURVIVED (finding 4)
- S9 token ratio `<=` → `<` → SURVIVED; trivial, equal-ratio edge, not reported on its own
- S10 `scoreRounds` ignores the ledger's `round:` → SURVIVED; redundant with the event/tree/dir signals in the bad scenario, minor
- S11 `scoreRounds` ignores `review/round-N` dirs → SURVIVED, same reason
- S12 `seq <` → `<=` → SURVIVED, equivalent (sequence numbers are distinct)
- S13 barrier GAP → PASS → killed (1)

Set 3:
- B1 builder also receives `contract.md` → killed (2)
- P9 `/usr/bin/git push` unrecognised → SURVIVED (finding 7)
- P12 lens name containing `/` accepted → SURVIVED (finding 7)
- P13 verdict read from the whole file → SURVIVED (finding 7)
- P15 any `decision.md` triggers the marker → SURVIVED (finding 7)
- P16 `approve.sh` accepts `../x` names → killed (1)
- P17 `decision_record` skipped in fast → SURVIVED (finding 7)
- P18 ESCALATE verdict allowed to ship → killed (1)
- P19 `worktree.sh` never reuses a registered worktree → killed (3)
- P20 `rework.sh` drops the note → killed (2)
- P21 `rework.sh` always uses k=1 → killed (1)
- P22 `rework.sh` sets stage `built` instead of `planned` → killed (2)
- P23 `approve.sh` writes round 0 → killed (1)
- P24 SendMessage resume ungated → killed (2)
- P25 legacy `design.md` not accepted → killed (19)

Totals: 53 mutants; 36 killed; 17 survived (4 equivalent or trivial: M23, S9, S12 and, as redundant, S10/S11). Real survivors: M2, S1, S2, S3, S4, S5, S6, S8, P9, P12, P13, P15, P17.

Probes:
- PASS without `## What I tried to break` → `gh pr create` allowed (finding 2).
- Tests with no assertion: scanned the 8 files for `test(` bodies with no assert; none found. No `skip`, `only` or `todo` marker in the suite.
- Hook-rule table, rule → test: builder dispatch/resume at round 0 (hooks 1302), barrier (1308, 1328), cap (1340), lens-list source (1363), ship gate with no decision, branch tokens, `-C`/`cd` (1378–1431), ESCALATE / `APPROVE (human)` / APPROVE needs PASS (1545), no-verdict file (1586), silent with no ledger, fast or FLOOR=off (1625), needs-human written and removed (1715), Edit/Write to the markers denied (1774), main-thread SKIP-only write (1784). Rule with no mechanical owner or test: "PASS without `What I tried to break` = SKIP" (finding 2). Edge: "builder cannot be resumed → fresh builder, round unchanged" — no hook rule and no test, prose only.
- EAG row → test: row 1 → the new cases above, `design.md` floor (hooks 1646), builder kernel (hooks 472; a denylist of 5 regexes plus the 15-line and 2-craft counts, B1 killed it); row 2 → hooks 52 (counts newlines ≤ 40; the file is exactly 40, no slack); rows 3–5 → GAP (finding 5).
- Test → rule: every cycle test traces to an appendix rule or EAG row. `eval-cycle` tests trace to the evals bullet in design.md Scope; no orphan test found.
- Four states: PASS, FAIL and SKIP are each produced by the good, bad and clarified dry runs. GAP is produced by `barrier_order` (synthetic cell) and the matrix comparison only; `ship_after_approve` and `cost` GAP paths exist in code and are never exercised (finding 4).
- Repo untouched by this review: no source edit, no git command that mutates; the only file written in the repo is this one.
