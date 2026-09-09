# Value A/B — screening pass, 2026-09-02

Question: does a skill produce something the model does not produce without it? Same fixture, same
task, twice — once with the plugin intact and the skill invoked, once against a plugin copy with
that skill's directory removed. Scored by a criterion computed from the fixture.

claude 2.1.259 · `--plugin-dir` · plan mode · n=1 per arm · $1.83 for the four units.

| Unit | Treatment | Control | Delta |
|---|---|---|---|
| `prose-tells` | 11/12 planted tells | 11/12 | none |
| `color-expert` | 4/4 hexes pass AA, worst 5.22:1 | 4/4, worst 5.68:1 | none (control marginally better) |
| `baseline-status` | 5/5 support facts | 5/5 | none |
| `apple-hig` | 3/4 HIG constraints | 3/4 | none |

Cost per pair: treatment $0.34–$0.57, control $0.28–$0.66. The control was cheaper in three of four.

## The selection bias, named rather than discovered later

These four were chosen because their criterion is objective — WCAG arithmetic, published Baseline
status, HIG numbers, a countable list of planted tells. That property is not independent of the
result: **a criterion is objective when the answer is well documented, and a well-documented answer
is exactly the kind a frontier model already carries.** Picking measurable units selected for the
cases where a skill has the least room to contribute.

So this pass says something narrow and real: on well-documented ground, these four skills add
nothing measurable. It does NOT say skills add nothing. The units where a skill plausibly earns its
place — visual system choice, editorial layout, deck structure, brand derivation — are the ones
whose criterion is judgment, and they are unmeasured here for the same reason they might matter.

## Scorer defect, recorded

`prose-tells` counts a detection by the presence of the tell's surface string in the output. One
planted tell is the em dash, and almost any output contains one, so both arms score a free point.
Net of it the pass is 10/11 against 10/11 — still a tie, but the marker should be replaced with a
quoted-line check before this unit is re-run.

## Unit 5 — `design-system-brutalist`, the first non-tie

Chosen because its rules are the OPPOSITE of the default aesthetic: a model building a dashboard
unprompted produces rounded cards and soft shadows, which the skill forbids. BOTH arms were asked
for a brutalist dashboard — asking only the treatment would test whether naming a style changes the
output, which is trivially yes. Scored on the skill's own declarations (SKILL.md:24-28), against
real emitted CSS rather than a plan.

| Criterion | Treatment | Control |
|---|---|---|
| `border-radius` <= 2px | 0px | 0px |
| Blurred shadows (forbidden) | 0 | 0 |
| Border declarations | 10 | 14 |
| **System sans stacks** | **2 of 2** | **0 of 5** |

One clean difference out of four, and it is the rule the skill states literally. The model already
knows brutalism's obvious traits; what it does not do on its own is honour `system-ui` as an
intentional choice rather than reaching for a Helvetica stack.

Cost: $6.47 for the pair — five times the estimate from the plan-mode units. A unit that builds
costs far more than a unit that answers.

## Three scorer defects, and why the raw streams are kept

This unit's scorer was wrong three times, each caught by reading the artifacts rather than by
review:

1. An attempted invocation counted as a successful one. The control, seeing design-system-swiss /
   clean / bento in its list, inferred `brutalist` existed and called it; the call failed, and the
   parser reported the control as contaminated. Attempts are now correlated with their tool_result.
2. Font stacks were declared as `var(--sans)`, so a literal scan reported "no system font" for the
   arm that had set --sans to system-ui. Custom properties are now resolved before matching.
3. "Soft shadow" keyed on offset magnitude, so `4px 4px 0` was flagged as soft — a zero-blur hard
   offset is the canonical brutalist shadow, and the scorer was penalising the arm that obeyed the
   rule. Softness is blur, the third length.

Each of those would have cost $6.47 to discover by re-running. They cost nothing because the raw
streams and the fixture directories are kept. That is the reason runs/ exists.

## Not measured

n=1 per arm. Plan mode, one model. A tie at n=1 is weak evidence of no difference; it is strong
enough to stop spending on a unit and move to one with more room, which is what it was for.

---

# Units 6 and 7 — `tdd` and `red-first`, 2026-09-09

Question: do the two method skills imported from mattpocock/skills change the ORDER in which the
model works — seams confirmed before a test file exists; a red command before a hypothesis? Order
is not in the final prose, it is in the sequence of tool calls, so these two units score the
stream-json the harness keeps in `runs/` (`parseStream`, `scoreTddEvents`, `scoreRedFirstEvents`
in `units.mjs`). Same fixture, same task, n=3 per arm; control = plugin copy with the skill
directory removed.

claude 2.1.266 · model `claude-opus-5[1m]` (the CLI default; `run.mjs` passes no `--model`) ·
`--permission-mode acceptEdits` · `PRAXIS_FLOOR=off` · $11.33 all in (12 cells $10.10, one probe
cell $1.19, two permission checks $0.04).

## Setup facts that had to change before a cell could run

- **Plan mode would have made the tdd criterion a GAP.** "Stops before any test file is written"
  cannot fail when writing is impossible, so both units run in acceptEdits, and the red-first unit
  needs `Bash` to run tests at all.
- **The spec floor is newer than the last harness run.** `hooks/pre-tool-use` (`901bdb7`,
  2026-09-09) denies the first source write in a fixture without `specs/`, in both arms
  identically, which would have measured the floor rather than the skill. The driver sets
  `PRAXIS_FLOOR=off` for these cells; `evals/floor` owns that measurement. `hooks/stop` allows a
  non-git directory on its own.
- **`-p` auto-denies `Bash`, and project settings did not lift it.** The same allow rules
  (`Bash(node:*)`, `Bash(npm:*)`, `Bash(npx:*)`) in the fixture's `.claude/settings.json` left
  every test run denied (probe cell: 7 denials, 0 runs; a haiku check: 1 denial); in
  `.claude/settings.local.json` they worked (0 denials). The fixture seeds the local file.
- **The task is fully specified on purpose.** "Add applyDiscount with tests" lets both arms stop
  to ask what a discount is — the kernel says clarify, don't guess — and that stop would read as
  the skill's. The codes, the floor at 0 and the throw are all in the prompt; the seam is the only
  thing left to confirm, which is the claim under test.
- `run.mjs` exports `runUnit` only — no CLI, no `--rescore`, fixed `runs/<id>-<arm>.jsonl` names —
  so a driver outside the repo (copied to `runs/t10-driver.mjs`) calls `runUnit` three times,
  renames each pair to `<id>-r<n>-<arm>.jsonl`, and re-scores saved streams. The ledger's verify
  line `node evals/value/run.mjs` runs nothing as written.

Literal commands:

```
# probe, one cell, before spending on the grid
cd $FIXTURE && PRAXIS_FLOOR=off claude -p "Invoke praxis:tdd first, then: <task>" \
  --plugin-dir $ROOT --setting-sources project,local --permission-mode acceptEdits \
  --output-format stream-json --verbose > runs/tdd-probe-treatment.jsonl
node t10-driver.mjs run tdd 3        # runUnit(tdd) ×3, both arms each time
node t10-driver.mjs run red-first 3  # runUnit(redFirst) ×3
node t10-driver.mjs rescore          # scoreTddEvents / scoreRedFirstEvents over runs/*.jsonl
```

## `tdd` — "names the seam and stops for confirmation before any test file exists"

Fixture: `src/cart.js` (`createCart`/`addItem`/`total`), one green test, `node --test`. Task:
add `applyDiscount(cart, code)` with tests (SAVE10 = 10% off, FLAT5 = 5 off floored at 0,
unknown code throws).

| n | arm | stopped before a test file | seam named | tests added before first `src/` write | red cycles | refactor in loop | cost |
|---|---|---|---|---|---|---|---|
| 1 | treatment | no | no | 1 | 5 | no | $1.22 |
| 1 | control | no | no | 11 (one `Write`) | 1 | no | $1.00 |
| 2 | treatment | no | **yes** | 1 | 6 | no | $1.43 |
| 2 | control | no | no | 0 — `src/` first, then all tests | 0 | no | $0.89 |
| 3 | treatment | no | no | 1 | 5 | no | $1.56 |
| 3 | control | no | no | 8 (one `Edit`) | 1 | no | $1.13 |

"Red cycles" = test runs that went red whose nearest preceding write was a test file; a red that
follows a source write is a mutation check, which both arms ran unprompted, and is not counted.

- **Primary criterion: 0/3 vs 0/3.** No cell in either arm stopped. The treatment invoked the
  skill every time and then declared instead of asking: the probe wrote "one decision I'm making
  explicitly", r3 wrote `phase: Needs your decision → build` in its own Run Card and built. The
  skill's first "It's working if" bullet — *seams named and confirmed before any test file
  exists* — is contradicted in 3/3 cells plus the probe.
- **Slicing: 3/3 vs 0/3.** Every treatment cell added one test, ran it red, wrote just enough
  code, ran it green, and repeated (5–6 red cycles). Every control cell did the horizontal slice
  the skill names: two wrote the whole suite in one shot (11 and 8 tests) and saw one red — the
  missing export — then implemented everything; one implemented first and never saw red. This is
  the second "It's working if" bullet, and it is the measured difference.
- **Seam named: 1/3 vs 0/3.** Only r2 wrote "Seam under test: the public module surface of
  `src/cart.js`". The check is the word "seam" plus `applyDiscount` before the first test write;
  r1 and r3 described the same boundary without the vocabulary and score no.
- **Refactor inside the loop: 0/3 vs 0/3.** ADR-003's removal held; r2 said so in its report
  ("refactoring belongs to review, not inside the red→green loop").

## `red-first` — "a red command with its output before the first hypothesis"

Same fixture with `total()` reducing `sum + item.price` (quantity dropped). The one existing test
uses quantity 1, so the suite is green on arrival and the model has to build the red command.
Task: "Bug report: total() returns the wrong number when an item has quantity > 1. Fix it."
Control = plugin with `skills/systematic-debugging` removed.

| n | arm | red output before first hypothesis | first hypothesis (sentence, from the stream) | ranked hypotheses | regression test before fix | green after fix | cost |
|---|---|---|---|---|---|---|---|
| 1 | treatment | yes | "Reproduced: `total` returns 3 where 12 is correct — quantity is ignored entirely." | 0 | yes | yes | $0.49 |
| 1 | control | **no** | "Trivial, single-file bug: `total()` ignores `quantity`." — before any test run | 0 | yes | yes | $0.41 |
| 2 | treatment | yes | "…the number names the cause: `15 = 3+5+7` is the sum of *prices*, quantity never multiplied" | 0 | yes | yes | $0.67 |
| 2 | control | yes | "Red confirmed — 2 failures, both from `quantity` being ignored." | 0 | yes | yes | $0.40 |
| 3 | treatment | yes | "Root cause is direct: `total` reduces `sum + item.price`, never reading `item.quantity`." | 0 | yes | yes | $0.47 |
| 3 | control | yes | "Red, and the actuals confirm the diagnosis: `total` sums `item.price` and ignores `item.quantity`" | 0 | yes | yes | $0.41 |

- **3/3 vs 2/3.** One control cell read the source and wrote the cause down before its first
  test run; the other two went red first on their own. The control is the model's own red-first
  habit, and it is strong: the skill's gate adds one cell in three on a one-line bug.
- **Ranked hypotheses: 0/6.** Step 3 of the skill — 3–5 ranked, falsifiable hypotheses shown to
  the user before probing — appeared in no cell, treatment included. The bug is one reducer; the
  model went from red output to the cause in one sentence every time. The skill does not say
  "when the cause is not obvious"; it says before probing anything. Either the skill needs the
  qualifier or this fixture is too shallow to exercise the step — recorded, not resolved.
- **Read `src/cart.js` before the red command: 6/6.** The skill permits reading and forbids
  theorising before the loop exists; only r1-control crossed that line.
- Regression test before the fix 6/6, green after fix 6/6, `[DEBUG-xxxx]` probes 0/6 (nothing to
  probe). r2-treatment ran the cleanup grep the skill asks for; r1-treatment checked for leftover
  tags in its verify command.

## Negatives, named

- The tdd skill's headline claim did not happen once in four treatment cells. Naming the skill
  in the prompt and having it invoked is not enough to make the model end its turn on a question
  in `-p`; it prefers to state an assumption and continue, which the kernel's own "Clarify, don't
  guess" did not override either.
- Both arms in both units wrote `specs/<change>/design.md` and `.praxis/active-change` with the
  floor OFF — the kernel prose drives the ritual on its own — and both arms ran mutation checks on
  their green suites unprompted ("a check that cannot fail is a GAP"). Neither is the skill's
  contribution, and both cost tokens in every cell.
- The treatment arm was the expensive one in every tdd pair (+$0.22 to +$0.54) and every
  red-first pair (+$0.06 to +$0.27): more red cycles, more test runs.
- `systematic-debugging` has no `## It's working if` section to check against; the comparison
  above is against its numbered method.

## Scorer defects, found by reading the streams

Five, all on first contact, each caught by reading the raw stream against the number:

1. `fail\s*\d` matched `# fail 0`, so a green baseline run scored as the red command and every
   green-after-fix run scored as still red (6/6 cells). Red is now a failed assertion, a `not ok`,
   `# fail [1-9]`, or a load failure.
2. Bare `bug is` matched "Bug is small and self-contained" — a sizing remark — and failed two
   treatment cells that had gone red before any cause. A hypothesis now has to name a mechanism.
3. `ignores quantity` missed "ignores \`quantity\`" — one backtick — so the control cell that
   stated the cause before any run scored as a PASS. Word gaps allow up to three non-word characters.
4. `refactorInLoop` flagged "refactoring belongs to review, not inside the red→green loop" in a
   final report. It now looks only between the first test write and the last source write and
   skips negated sentences.
5. Tests were counted per write: one `Write` carrying eleven `test(` blocks — the horizontal
   slice the skill forbids — reported as 1. Tests are counted net of the `old_string`.

Two setup defects belong with them: allow rules in `.claude/settings.json` are not honoured under
`-p` (the probe cell lost all seven test runs to it), and `testRuns` counted denied attempts.
Each re-score cost nothing; a re-run of the grid costs $10.

## What it does and does not say

It says: with `tdd` invoked, the model works in vertical slices — one test, red, code, green —
where without it it writes the suite in one batch or the code first (3/3 vs 0/3, six red cycles
against one). It says the model does not stop to confirm seams in a non-interactive run, with or
without the skill, and that the tdd skill's first success criterion is unmet as written. It says
`systematic-debugging` moved one cell in three from cause-first to red-first on a one-line bug, and
that its ranked-hypotheses step never runs on a bug this shallow.

It does not say the seam-confirmation rule fails interactively, where a question ends a turn and a
person answers; `-p` has no person. It does not say the skills would change anything on a codebase
larger than one module, or on a model other than opus. n=3, one fixture per unit, one task each:
enough to tell a 3/3-vs-0/3 from a tie, not enough to size a 3/3-vs-2/3.
