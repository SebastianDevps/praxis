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

---

# Unit 8 — the investigation suite, 2026-09-09

Question: does the four-skill investigation suite produce a dossier the model does not produce
without it? Design §Acceptance names four criteria and ADR-006 makes the fourth load-bearing —
(a) a `path:line` that **resolves**, (b) a computed signal with the API call that produced it,
(c) a named verdict, (d) at least one `SKIP` where the target gave nothing. *A dossier with no
`SKIP` on a partial target is a failure, not a success.*

claude 2.1.267 · model `claude-opus-5[1m]` · `--permission-mode acceptEdits` · `PRAXIS_FLOOR` **on**
(a dossier lands under `specs/`, which the floor never gates — verified in `hooks/pre-tool-use:27`)
· n=1 per arm · **$43.61 all in, 5 cells.**

## The target, and why this one

`gajus/zod-compiler` — a Zod-schema-to-validator compiler, cloned at `32d255b`, 181 commits,
~22k lines of TypeScript, BSD-3-Clause, published to npm.

- **Outside my training and outside this corpus.** The GitHub repo was created 2026-06-10, after
  the model's cutoff. Zero mentions in this repository, checked two orthogonal ways (`rg -il` and
  `rg -uu -il`, the second ignoring `.gitignore`).
- **It discriminates.** 803 stars and 220k downloads against `maintainers: 1` and
  `dependent_repos_count: 0`. That is precisely the case `dependency-adoption` Layer 2 exists for —
  the gameable signal and the computed one pointing in opposite directions.
- **It is genuinely partial**, so (d) is a real criterion here and not a formality:
  `api.scorecard.dev` returns **HTTP 404** for it, there is no stated SLO, and a build-time
  compiler has no request lifecycle and no database. Three places a dossier must say `SKIP`.

Live values were snapshotted once (`runs/investigation-snapshot.json`, 21:04:59Z) so a re-score is
stable and a number in a dossier can be *wrong* rather than merely present.

## The arms, and why the control is split in two

`run.mjs`'s ablation is `withoutSkill(one)` and its treatment prompt is hard-coded to
`Invoke praxis:<skill> first`. This unit removes four skill directories and reaches the suite
through a command, so `runs/t09-driver.mjs` owns the arms and imports the fixture and scorers from
`units.mjs` — the same split T10 used, not a second harness. `evals/floor`'s `PRAXIS_FLOOR=off`
precedent does not apply: that is an env switch the product actually has, and there is no
equivalent for a skill.

| arm | plugin | prompt |
|---|---|---|
| `treatment` | full | `/praxis:investigate <ask>` |
| `skills-off` | minus the four new skills | `/praxis:investigate <ask>` — design §Acceptance's literal control |
| `bare` | minus the skills **and** `agents/analyst.md`, `pipelines/investigation.md`, `commands/investigate.md` | `<ask>` — the model's own priors |

`skills-off` keeps the command, so the prompt is identical to the treatment's. `bare` has no command
to invoke; that asymmetry is unavoidable and is the price of measuring priors at all.

## Result

Dossier files only — the artifact, not the narration.

| cell | cost | ended | (a) citations resolved | (b) signal + call | (c) named verdict | (d) SKIPs | all four |
|---|---|---|---|---|---|---|---|
| treatment r1 | $8.00 | **cut off, $8 cap** | 0/0 | yes | no | 2 | **FAIL** |
| treatment r2 | $20.07 | **cut off, $20 cap** | **21/21** | yes | yes | 3 | **PASS** |
| skills-off r1 | $8.14 | cut off, $8 cap | 19/20 | no | yes | **0** | **FAIL** |
| skills-off r2 | $6.14 | **completed** | **27/30** | yes | yes | 2 | **PASS** |
| bare r1 | $1.25 | completed | **0/0** | no | yes | **0** | **FAIL** |

**The suite did not beat its own control. It tied it, and lost on cost.**

`skills-off` — the pipeline, the `analyst` agent and the command, with all four skills deleted —
met every one of design §Acceptance's four criteria, in a single uninterrupted run, for **$6.14**.
The treatment met the same four criteria only on its second attempt, and only after the budget
ceiling was raised from $8 to $20 — which it then hit as well. Two treatment cells, two truncations.

The two arms even reached the same verdict by the same route. Both found that `zod-compiler`
declares `peerDependencies.zod: "^4.5.0"`, that zod 4.5 ships `z.compile()` natively, and that the
package you must install to use the dependency is the package that makes it largely unnecessary.
Treatment: *"VERDICT — do not adopt now. Use zod's own `z.compile()` first."* Control:
*"Do not adopt `zod-compiler`. Adopt zod's own `z.compile()` instead — but measure before doing
either."* Neither reached that through a skill; both reached it by reading `target/package.json`.

**Where the suite does win is against the bare model.** `bare` wrote no artifact at all, answered
in the transcript, and failed three of four criteria: **zero** `path:line` citations, **zero** calls
to any of the six package/security APIs, and **zero** `SKIP`s. Its prose is not bad — it caught the
bus factor and the `fix:`-commit density — but nothing in it is checkable, and it never found the
`z.compile()` fact that decides the question. So the measured value of this change lives in
`pipelines/investigation.md`, `agents/analyst.md` and `commands/investigate.md`. On this target,
against this control, the four skills are not where it lives.

### ADR-006's criterion did the work it was written to do

`skills-off` r1 produced an 18,911-character dossier with **zero** `SKIP`s — a complete-looking
report over an investigation that had been cut off mid-flight by the budget cap. Every other
criterion passed. Without (d) that cell reads as a success. That is the exact failure ADR-006
predicted, caught by the exact check ADR-006 specified, and it is the strongest evidence in this
run that the criterion earns its place.

## Negatives and setup facts, named

- **The treatment could not finish inside $20, twice.** The pipeline's `sweep` fans out to
  `praxis:analyst` subagents which fan out again; r2 burned $20 with `num_turns: 2` at the top
  level. The control does the same job for a third of that. Cost is not a tiebreaker here — it is
  the finding.
- **r1 of the treatment spent its entire $8 on the sweep and produced no dossier at all** — only
  `scope.md`. That artifact was good (it declared its GAPs, cited the literal `curl`, and flagged
  stars and downloads as *"gameable, not admissible as reasons"*), but a scope note is not the
  deliverable.
- **Bash was denied throughout, in every arm identically.** The fixture's
  `.claude/settings.local.json` allow rules do not cover a compound command that opens with a
  variable assignment (`T=/path; grep …`) or `cd target && …`, so a large share of the sweeps came
  back denied and the arms fell back to `Read`. Identical in both arms, so the comparison holds,
  but every arm investigated with one hand tied.
- **32 of the control's citations are bare-basename shorthand** (`transform.ts:6`, `index.ts:23`)
  that matches more than one file in the target tree. The scorer reports them unresolved and so
  would a reader. One more points at a blank line. 27/30 is the count after a suffix-matching
  resolver; the raw dossier is looser than that number suggests.
- **The treatment invoked exactly one of its own four skills at the top level** (`dependency-adoption`,
  in r1). r2 invoked none directly — the work went to subagents. Whether the skills reached those
  subagents is not observable in the parent stream.
- **Criterion (c) barely discriminates.** All three arms produced a named verdict, `bare` included.
  Any answer to "should we adopt X" contains a verdict token; the criterion is close to a GAP and
  should not be read as evidence of anything.

## Scorer defects, eight of them, each found by reading rather than by review

Two were caught by mutating the scorer *before* any money was spent; six by reading the streams and
the dossiers against the numbers.

1. **(b) accepted a host cited from a failure.** `api.scorecard.dev` appeared in the dossier only
   inside a 404 `SKIP` line, and that satisfied "the API call that produced it". The host must now
   be one a **successful** call in the stream reached.
2. **(d) let a reasonless `SKIP` borrow the next line's text** — which, in the mutation, was the
   line that merely quotes `PASS · FAIL · SKIP · GAP`. The next line now has to be prose.
3. **(a) resolved only `dir/rel` and `dir/target/rel`.** A dossier names a full path once and then
   shortens to `emitter.ts:109`; 95 of 168 real citations scored "no such file", and `README.md:102`
   resolved against the *fixture's* 10-line README rather than the target's, scoring in-range
   citations as out of range.
4. **(a) then keyed the fallback on basename**, so `register/index.ts:60` — unambiguous — came back
   "ambiguous basename" 45 times. Suffix matching fixed it; 135/168 became the honest number.
5. **(b) matched a number anywhere on a line carrying the label.** `maintainers = 1` scored
   **correct** off *"The contributor list is not one person"*, and `downloads` scored off a STATUS
   line reading *"3 denied (git, downloads, deps.dev)"*. It also stopped at the first labelled line,
   so a correct value further down never counted. The number must now sit within 40 characters of
   the label, and every line is scanned.
6. **(c) and (d) scored the contract instead of the content.** The ledger's own `verify:` line
   ("a citation, a `SKIP` with reason, or a `GAP`") counted as a `SKIP` in every arm, and the
   pipeline's phase list — *scope → sweep → assess → synthesize → **verdict*** — counted as a named
   verdict in the treatment.
7. **The transcript was folded into the dossier.** A truncated treatment cell that wrote 16 KB of
   artifact scored 602 citations and 16 `SKIP`s, nearly all of it sweep commentary. Files and
   narration are now scored separately; an arm that writes no file is scored on its transcript,
   because that is what it delivered.
8. **(c) failed on a heading.** `## Verdict` with the call on the next line scored as *no named
   verdict* — a false negative against the **control**, which would have handed the criterion to the
   treatment on a formatting difference.

And one defect in the proof itself: fixing (8) made the (c) mutation stop failing, because the
fixture carried two verdict labels and the look-ahead found the second. A check that cannot fail is
a GAP, so the mutation was rewritten to remove the verdict *token* rather than one label. After the
rewrite all nine mutations fail their own criterion and the restored baseline passes — both
directions, `runs/t09-scorer-proof.mjs`.

## What it says and does not say

It says: on one real, moderately sized, genuinely partial public repository, the investigation
suite's four skills added nothing measurable over the same pipeline and agent with those four
directories deleted — same four criteria met, same verdict reached, at a third of the cost and
without the budget truncation the treatment hit twice. It says the pipeline, the agent and the
command *do* add something large over the bare model: citations that resolve, computed signals tied
to their calls, and `SKIP`s where the target gave nothing, none of which the bare arm produced.

It does not say the four skills are worthless. n=1 per arm, one target, one task, one model,
non-interactive. The target was chosen to discriminate on `dependency-adoption`'s signal-gaming
claim, which is the one skill whose contribution the control could most easily reproduce from a
`curl` it would have run anyway; `architecture-evaluation` and `buy-vs-build` were never exercised
against a target with a stated quality requirement, which is the condition their own bodies say
they need. A tie at n=1 is weak evidence of no difference. It is strong enough to say the suite has
not yet shown its four skills earn their place, and to say where to look next: a target with a
stated SLO, and a budget ceiling the treatment can actually finish inside.

# Unit 9 — `comment-discipline`, 2026-09-09

Question: does the `comment-discipline` craft change what the model writes? Everything else in the
change was already built and green (285/285) — the craft, the tier-1 hook gate, the Ousterhout
reference, the reviewer line, the wiring into the four builder agents. This is the only part that
asks whether any of it moves the output.

**The instrument is not density, and ADR-003 is the reason.** The largest empirical study of
AI-generated code in real repositories measured comment density at **18.01% for AI against 17.96%
for human** ([arXiv 2603.27130v2](https://arxiv.org/html/2603.27130v2)). A density gate reports
clean on exactly the output this change exists to fix. So the unit counts **redundancy per
comment**, normalised per 100 lines of emitted **code** — comment lines are excluded from the
denominator on purpose, because putting them in lets a chatty arm dilute its own rate.

claude 2.1.267 · model `claude-opus-5[1m]` · `--permission-mode acceptEdits` · **n=3 per arm, three
arms, 9 cells** · **$12.12 for the grid, $13.98 all in** (one $1.86 cell was thrown away, below).

## The four criteria, each traced to a published rule

| # | criterion | source | scored by |
|---|---|---|---|
| 1 | the comment restates its own code | [`jsdoc/informative-docs`](https://github.com/gajus/eslint-plugin-jsdoc/blob/main/docs/rules/informative-docs.md) — no content word beyond the thing it documents, stop-words `a an i in of s the` stripped | this file, in JS |
| 2 | banner / divider comments | — | **the hook's own detector** |
| 3 | chain-of-thought leakage | the defect named in [claude-code#65961](https://github.com/anthropics/claude-code/issues/65961) | **the hook's own detector** |
| 4 | a docstring on a trivial private function | [Google pyguide §3.8](https://google.github.io/styleguide/pyguide.html) inverted: private AND small AND obvious | this file, in JS |

2 and 3 call `praxis_scan_comments` per line rather than reimplementing it, because
`hooks/pre-tool-use:158` says in as many words that a second copy of those rules would be a second
standard. The same call yields the would-have-denied count for free.

## The confound, and the decision — stated because picking silently is not defensible

The tier-1 hook gate denies banners and chain-of-thought leakage **regardless of arm**. Leaving it
on would clamp two of the four counted criteria to ~0 on both sides — blinding the instrument on
half its surface to measure the thing the other half is for.

**Both arms therefore ran with `PRAXIS_FLOOR=off`,** which lifts the spec floor and the tier-1
comment pass together. The craft is then the only difference between treatment and control, which
is the question asked. What it gives up is the user-facing number, and that is recovered as a
derived one: every emitted line is replayed through the hook's own detector and reported as
`wouldDeny`. **It came back 0 in all nine cells** — on this task the gate would have denied
nothing, in any arm. That is a would-have-denied count, not an outcome: a real deny makes the model
rewrite the line.

## Why the task is dispatched, and why that is load-bearing

A craft body reaches the model through exactly one path: `hooks/subagent-start` resolves
`od.craft.requires` from the agent file and concatenates the bodies (`hooks/lib.sh:175`). A
top-level `claude -p` turn gets `contract.md`, which **names** comment-discipline among the
always-on crafts and carries **none of its text**. A top-level cell would have measured a name-drop
and reported a guaranteed tie for a mechanical reason. The prompt dispatches `praxis:engineer`,
which is also how a person gets this craft.

Proved mechanically rather than assumed — `t05-driver.mjs injection` feeds a synthetic
`{"agent_type":"praxis:engineer"}` to each arm's own hook:

```
treatment {"bytes":14237,"craftSection":true,"governingRule":true,"mentions":2}
control   {"bytes":9552,"craftSection":false,"governingRule":false,"mentions":0}
```

## The arms

| arm | plugin | prompt |
|---|---|---|
| `treatment` | full | `Dispatch praxis:engineer to build …` |
| `control` | minus `crafts/comment-discipline/`, minus the name in `hooks/context/contract.md`, minus the `- comment-discipline` line in all four builder agents | identical |
| `bare` | **no plugin at all** | `Build …` |

The control drops the craft's **name** as well as its body. Leaving the name behind would make it
an arm of its own — told that comment-discipline is always-on and given none of it — which is
neither of the two arms the question asks about. `bare` was added after treatment and control both
scored zero, for the reason in the next section.

## The task, and why this one

A per-key sliding-window quota counter: `createCounter`, `record`, `used`, `remaining`, `allow`,
`resetsAt`, `limitOf`, `windowOf`, `prune`, with tests. Eight functions, two trivial accessors, and
**one genuinely non-obvious constraint planted in the fixture** — `src/clock.js` returns monotonic
milliseconds since process start, while `resetsAt` is specified to return a Unix epoch timestamp,
so a correct implementation must rebase through `originEpochMs`. That line is precisely the kind
the craft asks to be commented (units, and an invariant a reader cannot infer), which gives the
unit a way to see whether the craft suppresses the *right* comments rather than merely fewer.

**The prompt says nothing about comments, documentation, docstrings, readability or style.** If it
did, every arm would perform for the scorer and the measurement would be worthless.

## Result

| cell | cost | code lines | comments | c/100 | restates | banner | CoT | trivial doc | redundant/100 | noted the constraint |
|---|---|---|---|---|---|---|---|---|---|---|
| treatment r1 | $1.82 | 205 | 8 | 3.90 | 0 | 0 | 0 | 1 | **0.00** | yes |
| treatment r2 | $1.81 | 281 | 30 | 10.68 | 0 | 0 | 0 | 0 | **0.00** | yes |
| treatment r3 | $1.78 | 220 | 4 | 1.82 | 0 | 0 | 0 | 0 | **0.00** | yes |
| control r1 | $1.59 | 221 | 12 | 5.43 | 0 | 0 | 0 | 0 | **0.00** | yes |
| control r2 | $1.67 | 214 | 24 | 11.21 | 0 | 0 | 0 | 0 | **0.00** | yes |
| control r3 | $1.56 | 210 | 1 | 0.48 | 0 | 0 | 0 | 0 | **0.00** | yes |
| bare r1 | $0.62 | 278 | 17 | 6.12 | 0 | 0 | 0 | 1 | **0.00** | yes |
| bare r2 | $0.49 | 229 | 18 | 7.86 | 0 | 0 | 0 | 0 | **0.00** | yes |
| bare r3 | $0.78 | 244 | 11 | 4.51 | 0 | 0 | 0 | 0 | **0.00** | yes |

Pooled: treatment 706 code lines / 42 comments · control 645 / 37 · bare 751 / 46. Redundancy per
100 lines: **0.00 · 0.00 · 0.00**.

**This is a GAP, not a tie, and the distinction is the whole finding.** The craft did not beat its
control. Neither did the control beat the bare model. Across **2,102 lines of emitted code and 125
comments in nine cells**, all four criteria detected **zero** defects in **every** cell. The
instrument ran and had nothing to fail with, which is a GAP in this repo's own vocabulary — and a
GAP must never be reported as a clean PASS.

**The defect did not reproduce.** Not in the treatment, not in the control, and not in the bare
model with no plugin loaded at all. On this task, in this language, on this model, through the
non-interactive `-p` channel, `claude-opus-5[1m]` already writes the comments the craft asks for.
The bare arm is the one that settles it: without it, a double zero would have been ambiguous
between *the rest of Praxis already suppresses this* and *there was nothing to suppress*. It is the
second.

### What the arms actually wrote

Every arm found the planted constraint and commented it — 9/9, including the two sparsest cells in
the run. Control r3 wrote **one** comment in 210 lines of code, and it was this one:

> `// Timestamps are monotonic clock readings (ms since process start); resetsAt is`
> `// specified as Unix epoch ms, so add the origin offset to leave monotonic space.`

The bare model, no plugin: `// clock.now() is monotonic since process start, so shift onto the
epoch.` The treatment: `// Stamps are monotonic ms since process start; the contract is a Unix
epoch, so shift by the epoch that clock time 0 corresponds to.` Three arms, same judgement.

`limitOf` and `windowOf` — the two trivial accessors planted to bait a docstring — came back bare
in every cell of every arm.

### Density is noise here, measured in this repo rather than cited

Comment volume swung **1.82 to 10.68** per 100 lines inside the treatment arm and **0.48 to 11.21**
inside the control. The gap between arms is 5.95 vs 5.74 vs 6.13. **The within-arm spread is an
order of magnitude larger than the between-arm difference.** ADR-003 refused a density threshold on
the strength of an external study; this run is local corroboration, and it is worth more than the
citation because it is this corpus, this model and this channel.

## Negatives and setup facts, named

- **`node --test` was denied in all nine cells, 22–36 times each.** The suite never ran in any arm.
  The permission layer refuses node execution in this session — for the orchestrator and for the
  subagent, with and without `dangerouslyDisableSandbox`. Every cell's code is desk-checked, not
  verified, and the cells say so themselves. Identical across arms, so the comparison holds, but
  **no arm ever iterated against a failing test**, and iteration is where the reported defect
  (claude-code#65961) is described as accumulating.
- **One cell was bought and thrown away, $1.86.** A `set -- $spec` word-split in the run loop
  produced `arm="treatment 2"`, which `pluginFor` sent down the control branch — a control cell
  labelled treatment. It was discarded rather than relabelled: a reader should not have to trust a
  post-hoc correction of which arm a cell ran in.
- **The bare arm is not a clean ablation of Praxis**, only of the plugin. It also loses the
  dispatch, the contract and the other two crafts the engineer carries, and it costs a third as
  much ($1.89 vs $5.41). It answers "does the defect occur at all", which is what it was added for,
  and nothing narrower.
- **Criterion 4 is a GAP on its own terms.** Its structural form — private AND small AND obvious —
  fired twice in this run and was **wrong both times**: on `cutoffOf`, a one-liner whose comment
  states a half-open-window boundary rule that no reader could infer from `now() - windowMs`. That
  is the comment the craft exists to ask for. "Obvious" is not a property a mechanical check
  decides. The column is reported and deliberately left out of the redundancy total.
- **`constraintNoted` cannot fail either.** 9/9 is a column with no discrimination in it. It is
  reported as an observation and nothing rests on it.
- **The craft's cost is real and its measured benefit here is zero.** It adds 4,685 bytes to every
  builder dispatch — 14,237 against the control's 9,552 — on every build turn, which is the tax
  ADR-006 accepted in advance. This run did not find anything bought with it.
- **A pre-existing break in `units.mjs`, not touched.** `investigationSuite` is imported by
  `runs/t09-driver.mjs` and is not exported (`typeof m.investigationSuite` → `undefined`), so T09's
  `run` path cannot execute. Its recorded results and streams are unaffected. Reported, not fixed:
  it is another task's file.

## Scorer defects, three, found by reading rather than by review

The proof (`runs/t05-scorer-proof.mjs`) runs before any cell is bought and checks four things per
criterion: it fires on a known-bad sample, it stays silent on a known-good one, deleting only that
defect's lines drops that criterion to 0 while leaving the other three untouched, and — for the two
criteria this file owns — disabling the detector drops it to 0. **19/19.**

1. **Every banner was counted twice.** A divider has no content word after stop-word stripping, and
   the restatement rule's `cw.length === 0` clause called that a restatement — so criterion 1's
   column was inflated by exactly criterion 2's. Caught by the isolation check, not by review:
   removing the banner lines dropped `restatement` from 2 to 1. ADR-001 gives each defect one
   owner; a divider belongs to criterion 2.
2. **`const second = resetsAt(c, key)` was scored as a private trivial function.** The declaration
   regex ended in `\(?` — optional — so every `const x = f(y)` in a test body matched, and a timing
   comment above one counted as a docstring on a trivial private function. Found by reading the
   probe cell's evidence rather than its score. The initializer must now actually be a function.
3. **Criterion 4 double-counts by construction** once the informativeness condition is applied to
   it, because that subset is contained in criterion 1. It is now reported as its own column with
   the overlapping subset named, and excluded from the total.

Defects 1 and 2 were both found **before** the grid was bought — 1 by the proof, 2 by reading the
probe cell. The probe existed for that purpose, following the precedent Units 6 and 7 set.

## What it says and does not say

It says: on one build task in JavaScript, with a planted non-obvious constraint and two planted
trivial accessors, `claude-opus-5[1m]` produced **zero** restating comments, **zero** banners,
**zero** chain-of-thought leakage and **zero** boilerplate docstrings on trivial private functions
— in the treatment, in the control, and with no plugin loaded at all. The craft was not shown to
add anything, because there was nothing on this channel for it to remove. It also says the tier-1
gate would have denied nothing here, and that comment volume varies more between two runs of the
same arm than between the arms.

It does not say the craft is worthless, and it specifically does not say the hook is. **T02 proved
the hook mechanically, in both directions, per pattern** — that evidence stands and this run does
not touch it. What this run establishes is that the *behavioural* claim is unmeasured, and it names
where to look next rather than leaving it open: the defect in claude-code#65961 is reported against
**interactive sessions with repeated edits to the same file**, and this run sampled a single
non-interactive `-p` build in which the test suite never once ran and no arm ever iterated against
a failure. One task, one language, one model, one channel, n=3. A GAP at n=3 is not evidence of
absence — it is evidence that this task could not tell the difference, and a task that can must
put the model through the iteration loop where the defect was reported.
