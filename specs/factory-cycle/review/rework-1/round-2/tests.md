---
lens: tests
round: 2
verdict: CHANGES
---
## Findings
- `hooks/pre-tool-use` `marker_bash_gate` (~431-454) — the Bash marker gate has two holes and no test that would show either. (a) Probe on a clean copy: `find . -maxdepth 0 -exec touch .praxis/approved/x \;`, `fd . -x touch .praxis/approved/x` and `rg --pre touch foo .praxis/approved/x` are all ALLOWED (empty output), because `find`/`fd`/`rg` are on the "plain read" list and the marker path is only an argument. That forges the person's approval marker from Bash. (b) The only thing that denies `cat /dev/null > .praxis/approved/x` is the `hit="redirect"` branch; mutant N21 (branch neutralised) survives all 384 tests, yet diverges on exactly that command (original denies, mutant allows). Add: a deny case for a redirect from a read tool, and for `find -exec`/`fd -x`/`rg --pre`; the second needs a hook change, so the human decides whether it is a gap or a documented limit (security lens owns the fix) — severity: important
- Case-folding is pinned at 2 of 6 sites (`record_gate`, `praxis_is_spec_side` die; four survive). Survivors with a concrete divergence, each probed against the original: N9c `touch .Praxis/Approved/x` via Bash (original denies, mutant allows); N9d `scripts/Approve.sh x` with no token (original denies, mutant runs the script); N9e post-tool-use consumes the token only for the lower-case spelling, so `Approve.sh` leaves a replayable token; N9f `decision_record` misses `specs/x/DECISION.md`, so ESCALATE under that spelling writes no needs-human marker. Test 1946 (`records are classified case-insensitively`) covers the Edit/Write path only — severity: important
- `record_gate` per-tool coverage — the `decision.md` gate is exercised through Write and Edit only. N8a (MultiEdit), N8c (apply_patch), N8d (NotebookEdit) survive; probe: the main thread writing `specs/x/decision.md` with `verdict: APPROVE` through each of the three is denied by the original (`PRAXIS decision`) and allowed by the mutant. The same per-tool gap holds for the lens-file, lens-list and ledger gates (same `case` arms). Test 2109 pins the matcher, not the deny — severity: important
- Ship-gate branches with no test: N10a `--mirror` and N10c `--branches` (survive; `git push --mirror origin` from `main` is denied by the original, allowed by the mutant — only `--all` is pinned); N25 `gh pr create --head praxis/y` while the active change is `x` (original gates on y and denies, mutant gates on x); N24 `gh api … repos/o/r/merges` (the `*/merge*` arm); N44 the `praxis_valid_change_name` check on the pushed name (probe: a valid nested record `specs/a/b/` with `APPROVE (human)`, `git push origin praxis/a/b` → original denies "no change record", mutant allows). N4c, `praxis/x:praxis/y` (source and destination both change branches), also has no case: the source rule is pinned only against destination-only refspecs — severity: important
- `approve.sh`/`rework.sh` token gate — X7 survives: no test runs `scripts/rework.sh x "note"` WITHOUT a token (test 1958 only checks that the allowed run passes), so the deny for rework could be removed; probe: original denies. N3 survives: an `approve-x` token is accepted for `rework.sh x`, so the person's `/praxis:approve x` also licenses a model-run rework that archives the reviews and resets the round — severity: important
- `hooks/lib.sh` `praxis_round_number` (N35) — test 2017's comment says "02 is two, not an octal error", but `02` is valid octal. The mutant `$((r))` survives; with `round: 08` or `09` it returns empty, `[ "" -gt 0 ]` errors, and `builder_gate` runs `exit 0`: probe on the mutant → builder dispatch ALLOWED at round 08/09 (original denies with the barrier). The property the comment claims is not pinned. Use `08` — severity: important
- Lens-file and lens-list rules (small, each with a divergent input): N16b `security` is not required in the lens list (list `correctness`, `tests` → original denies "missing: security", mutant allows; correctness and tests are pinned, security is not); N19 `lens-ui` may write any lens's file (`lens-ui` writing `correctness.md`); N18 main-thread Edit of a lens file whose `new_string` carries `verdict: SKIP` (the Edit-vs-Write check is the only thing denying it); N34 an empty `review/round-9/` directory raises the effective round (the "holds a review" check); N32 the ship gate reads the ledger round instead of the disk round (a ledger reset to 0 with all-PASS round-1 files ships in the original, is denied in the mutant) — severity: minor
- `evals/cycle` scorer boundaries (pending: another agent is finishing `tests/eval-cycle.test.mjs`) — round-1 S1 and S2 are now killed. Still surviving at read time: S3 (`decision_present` regex narrowed to `APPROVE`), S4 (`orderOk` forced true), S5 (`ship_after_approve` GAP "decision.md not written through Edit/Write"; test 201 covers only the missing `gh.log` GAP), S8 (`spec_before_source` "spec written, no source" SKIP → PASS). PENDING, not reported as defects until that agent finishes — severity: minor
- EAG rows 3, 4, 5 — row 3 (3 live cells) and row 4 (4 matrix tasks) are named GAP in `evals/cycle/README.md`; row 5 (trap task, `[NEEDS CLARIFICATION]` ≥ 2/4) still has no scorer, no fixture and no mention as a GAP anywhere under `evals/cycle`. Not a PASS — severity: minor
- `tests/hooks.test.mjs:647` — `decision()` still maps empty stdout to "allow", and the hooks have no `-e`: a hook that crashes before deciding passes every allow-side test. Unchanged since round 1; the deny-side tests carry the weight — severity: minor
- Rules with no test or no mechanical owner (both directions below): `spec.md` `writer: spec-writer` and `ready:` (prose only, no hook, no test); "SKIP only by the orchestrator" (a lens may write `verdict: SKIP` into its own file, the hook allows it, no test); `round:` "set to N when round N's lenses are dispatched" and `builder:` "set when dispatched" (prose; the hook only reads them); "builder cannot be resumed → fresh builder, round unchanged" (prose). The human decides which are spec gaps — severity: minor

## What I tried to break
State: HEAD f3a0ec1 plus the dirty working tree (`tests/eval-cycle.test.mjs`, `evals/cycle/` untracked; another agent editing them). Baseline reproduced in a scratchpad copy: `node --test tests/*.test.mjs` → 384/384. Mutants were applied only to scratchpad copies (`…/scratchpad/m1…m8`), one at a time, each restored; hook-side mutants ran `tests/{hooks,approve,loop,scripts,invariants}`, script-side `{approve,scripts,loop,hooks}`, scorer-side `eval-cycle`. The repo has no edit or git mutation from this review other than this file.

Round-1 survivors, re-run against the hardened code:
- M2 `praxis_round_all_pass` true on an empty list → killed (hardening added the "no lens listed" case, test 2059)
- P9 `/usr/bin/git` unrecognised → killed
- P12 slash lens name kept → killed
- P13 verdict read from the whole file → killed
- P15 any `decision.md` triggers the marker → killed
- P17 `decision_record` skipped in fast → killed
- S1 `max <= MAX_ROUNDS` → `<` → killed (new boundary test 185)
- S2 `>= MIN_SUBAGENTS` → `>` → killed (new boundary test 170)
- S6 cost always PASS → killed (test 210)
- S10 `scoreRounds` ignores the ledger round → killed (test 185)
- S13 barrier GAP → PASS → killed
- S3 decision regex narrowed → SURVIVED (pending, finding 8)
- S4 `orderOk` forced true → SURVIVED (pending)
- S5 ship GAP branch removed → SURVIVED (pending)
- S8 spec SKIP → PASS → SURVIVED (pending)
- S9 token ratio `<=` → `<` → SURVIVED, equivalent in practice (needs a float equal to the matrix ratio)
- S11 `scoreRounds` ignores `round-N` dirs → SURVIVED, redundant with the tree/event signals
- S12 `seq <` → `<=` → SURVIVED, equivalent (sequence numbers distinct)
- M23 `worktree.sh` records no `praxisBase` on creation → not re-run (round 1: equivalent; the hardening touched `worktree.sh` but not that line)

New mutants aimed at the hardening (every one run on the 5-file hook/script suite or the scorer test):
- N1 intent token never consumed → killed
- N2 token accepted for any change name → killed
- N3 token of the other kind accepted → SURVIVED (finding 5)
- N4a refspec SOURCE rule ignored → killed
- N4b refspec DESTINATION rule ignored → killed
- N4c name taken from the destination when source and destination both name change branches → SURVIVED (finding 4; `praxis/x:praxis/y`: original gates x, mutant gates y)
- N5 `praxis_effective_round` ignores disk → killed
- N6 attack list always counted as present → killed
- N6b attack-list section without a bullet counts → killed
- N7 any `refuter-*` may write any lens file → killed
- N8a `decision.md` gate skipped for MultiEdit → SURVIVED (finding 3)
- N8b skipped for Edit → killed
- N8c skipped for apply_patch → SURVIVED
- N8d skipped for NotebookEdit → SURVIVED
- N9a case-folding removed in `record_gate` → killed
- N9b case-folding removed in `praxis_is_spec_side` → killed
- N9c case-folding removed in `marker_bash_gate` → SURVIVED (finding 2)
- N9d case-folding removed in `intent_gate` → SURVIVED
- N9e case-folding removed where post-tool-use consumes the token → SURVIVED
- N9f case-folding removed in `decision_record` → SURVIVED
- N10a `--mirror` allowed → SURVIVED (finding 4)
- N10b `--all` allowed → killed
- N10c `--branches` allowed → SURVIVED
- N11 body `APPROVE (human)` clause in `decision_gate` dropped → killed
- N13 ledger gate `round: -ge` → `-gt` → killed
- N14 (an identity edit by mistake, not a mutant; discarded) / N14b subagent may write the ledger → killed
- N15 lens list not pinned once a review exists → killed
- N16 only `correctness` required in the list → killed
- N16b `security` not required → SURVIVED (finding 7)
- N16c `tests` not required → killed
- N17 main thread writes any verdict into a lens file → killed
- N18 main thread may Edit a lens file → SURVIVED (finding 7)
- N19 `lens-ui` writes any lens file → SURVIVED; N19b `lens-ui` cannot write `ui.md` → killed
- N20 intent prompt regex anchor dropped → killed
- N21 redirect to a marker path not recognised → SURVIVED (finding 1)
- N24 `gh api` `*/merge*` arm dropped → SURVIVED (finding 4); N24b `*pulls*` arm dropped → killed
- N25 `gh --head` ignored → SURVIVED (finding 4); N25b `gh pr merge` not a ship → killed
- N27 nested `bash -c` depth 0 → killed; N28 `eval` unread → killed
- N29 `sudo` not unwrapped, N29b `env` not unwrapped → killed (both)
- N30 `cd` ignored; N31 `git -C` ignored; N31b `-c k=v` value not skipped → killed (all three)
- N32 ship gate reads the ledger round, not the disk round → SURVIVED (finding 7)
- N33 `platform` / N33b `engineer` dispatch not treated as a resume → killed (both)
- N34 empty `round-N/` directory counts → SURVIVED (finding 7)
- N35 octal: `$((r))` instead of `$((10#$r))` → SURVIVED (finding 6; `08` opens the builder gate)
- N36 CR not stripped by the frontmatter reader → killed
- N40 intent name unvalidated → killed
- N42 `..` allowed in the floor's `praxis_valid_change_name` → SURVIVED, equivalent (a `..` inside a name has no traversal; leading `.` and `/` are rejected by other arms)
- N43 `*/*` dropped from the same → SURVIVED, equivalent (the character-class arm rejects `/`)
- N44 the pushed name's `praxis_valid_change_name` check removed → SURVIVED (finding 4)
- N45 no-ledger ship allowed → killed
- N46 SendMessage with no recorded builder allowed → killed
- N47 empty lens list at a builder dispatch allowed → killed
- N48 cap at 3 → killed; N49 SKIP exempt from the cap → killed
- X1 write to `.praxis/intent/*` via Edit/Write allowed → killed
- X3 prompt mints no rework token → killed
- X5 ship APPROVE at round 0 allowed → killed
- X7 `rework.sh` not recognised by the intent gate → SURVIVED (finding 5)
- X8 `approve.sh` not recognised → killed
- X9 `gh -R <repo>` value not skipped → killed
- X10 `needs-human` not guarded from Bash → killed; X11 `intent` not guarded → killed
- X12 ledger round decrease allowed → killed
- A1 leading `-` in a change name, A1b leading `.`, A1d `_templates`, A1e a metacharacter → killed (all four)
- A1c `..` in the scripts' `praxis_valid_change_name` → SURVIVED, equivalent (same reason as N42)
- A2 leading `-`, A2b `..`, A2c `//`, A2d trailing `/`, A2e leading `/`, A2f a metacharacter in a ref → killed (all six)
- A3 `praxis_sq` does not escape a quote → killed
- A4/A5 `approve.sh` skips name/base validation, A6 `rework.sh`, A7/A8 `worktree.sh` → killed (all five)
- A9 `approve.sh` leaves `stage` untouched → killed
- A10 title, A11 base, A12 branch printed unquoted in the ship lines → killed (all three)
- Scorers: S14 cost GAP "leg without a result line" removed → killed; S15 ESCALATE + `pr create` passes → killed; S18 no-decision + ship attempt → PASS → killed; S16 `before === 0` dropped → SURVIVED, equivalent (the log is time-ordered, so `prCreates[0].t > write.t` already implies it); S17 barrier `<` → `<=` → SURVIVED, equivalent (a lens write and a resume never share a sequence number)

Totals: 18 round-1 mutants re-run (11 killed, 4 survived pending/real, 3 survived equivalent or redundant) and 97 new (N14 not counted as a mutant): 70 killed, 27 survived, 5 of those equivalent (N42, N43, A1c, S16, S17), 22 real, grouped into findings 1-7. Hook-rule survivors: 12 of 67 hook mutants are untested rules.

Appendix hook rules → test (and rules without one):
- Builder dispatch/resume: round 0 allow → hooks 1315; barrier → 1321, 1341; cap → 1353; fix round with CHANGES/SKIP at round 1 → 2094; lens-list source → 1376; write-capable roles → 2001; unrecorded builder → 2047.
- Ship: no decision → 1391; name from the branch → 1407; implicit/HEAD push → 1422; `-C`/`cd` → 1447; refspec/wrappers/nested shell → 1882; ESCALATE, APPROVE (human), APPROVE + PASS → 1560; PASS without attack list → 2032; empty list → 2059. No test: `--mirror`/`--branches`, `gh --head`, `gh api …/merges`, invalid or nested ship name, `src:dst` with two change names.
- ESCALATE/APPROVE markers → 1733, 2081 (the active change only). Edit/Write to the markers → 1792. No test: Bash markers via `find -exec`/redirect, the case-folded Bash and token spellings.
- Records: decision.md → 1841 (Write/Edit only); lens files → 1802, 1911; lens list and ledger → 1911 (all tool arms except Write/Edit untested); case folding → 1946 (Edit/Write only); token → 1958 (no rework deny, no wrong-kind token); NotebookEdit → 1990; effective round → 2017 (`02`, not `08`).
- Tests with no rule behind them: none found; every cycle test in `hooks`, `approve`, `scripts`, `loop` and `eval-cycle` traces to an appendix rule, a hardening item in `f3a0ec1`, or an EAG row. No `skip`/`only`/`todo`/`xfail` marker in `tests/*.test.mjs`.

EAG rows → test: row 1 builder at round 3 denied → 1353; builder resume denied with a lens missing → 1321/1341; `gh pr create` denied/allowed → 1391/1560; legacy `design.md` → 1664; SubagentStart builder kernel + change line + crafts only → 472 (and 412, 500). Row 2 `wc -l contract.md` ≤ 40 → hooks 52 (the file is exactly 40, no slack). Rows 3 and 4 → GAP, named in `evals/cycle/README.md`; row 5 → GAP, not named (finding 9); row 6 (live `ask`, `hooks/stop` under `-p`) → GAP, stays unmeasured as in `evals/floor`.

The four states, each from a real path:
- PASS: hooks allow paths (e.g. 1560 APPROVE + all PASS ships); `evals/cycle` good dry run (eval-cycle 42, every scorer PASS).
- FAIL: hooks deny paths (1321, 1353); `evals/cycle` bad dry run (eval-cycle 69, every scorer FAIL).
- SKIP: the lens verdict `SKIP` written by the main thread (hooks 1802, 2094 — counts as not PASS); `evals/cycle` clarified dry run (eval-cycle 87, six SKIP); `scoreRounds` with no round, `scoreShip` with an empty gh.log (eval-cycle 185/201).
- GAP: `scoreShip` with no `gh.log` (201), `measureCost` with no result/cost/usage (210), `scoreBarrier` with no lens list (234-256), and end to end through `run.mjs --arm both` printing "tokens vs matriz: GAP" (eval-cycle 66). Hooks produce no GAP state (their outcomes are allow/deny/ask); that is by design. Half-open: the `ship_after_approve` GAP for a decision not written through Edit/Write (S5) is never exercised — pending.
- Pending, not judged: `tests/eval-cycle.test.mjs` boundary items S3, S4, S5, S8 (finding 8).

Probes (clean scratchpad copy, hook driven by hand): `cat /dev/null > .praxis/approved/x` → deny (original); `find … -exec touch .praxis/approved/x \;`, `fd -x touch …`, `rg --pre touch …` → allowed; MultiEdit/NotebookEdit/apply_patch of `decision.md` by the main thread → deny (original); `touch .Praxis/Approved/x`, `scripts/Approve.sh x`, `git push --mirror origin`, `gh pr create --head praxis/y`, `gh api -X PUT repos/o/r/merges -f head=praxis/x`, `git push origin praxis/a/b` → all deny (original). `round: 08` with the octal mutant → builder dispatch allowed.
