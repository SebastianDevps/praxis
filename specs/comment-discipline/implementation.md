---
title: Comment Discipline
stage: shipped  # new → designed → planned → implemented → shipped
owner: Sebastian
---

# Comment Discipline — Implementation

## Tasks
- [x] T01 · phase: build · state: done · `crafts/comment-discipline/` — the craft, positive voice,
      Ousterhout/Fowler/Google/kernel imported as cited text; carve-outs named
      files:  crafts/comment-discipline/comment-discipline.md
      verify: node scripts/validate-resources.mjs; length ≤ the longest existing craft
- [x] T02 · phase: build · state: done · Tier-1 content pass in `hooks/pre-tool-use` + helpers
      files:  hooks/pre-tool-use, hooks/lib.sh, tests/hooks.test.mjs
      verify: per-pattern mutation both directions + the false-positive gate, all pasted
- [x] T03 · phase: build · state: done · `skills/codebase-design/references/COMMENTS.md`, the
      Ousterhout chapters the skill skipped; one `reviewer` line for the tier-2 check
      files:  skills/codebase-design/**, agents/reviewer.md
      verify: node --test tests/*.test.mjs; boundary-audit unchanged
- [x] T04 · phase: build · state: done · Wire the craft into the four builder agents
      files:  agents/{engineer,backend,platform,design}.md
      verify: node scripts/validate-resources.mjs; routing dilution measured out-and-back
- [x] T05 · phase: verify · state: done · Live cell + negative control on raw output
      files:  evals/value/units.mjs, evals/value/RESULTS.md
      verify: n≥3 per arm; restating comments, banners and CoT leakage per 100 emitted lines
- [x] T06 · phase: ship · state: done · Identity surfaces
      files:  README.md, AGENTS.md, CHANGELOG.md, .cursor/rules/, the four craft reciters
      verify: node --test tests/manifest.test.mjs

Waves: {T01, T03} parallel → T02 → T04 → T05 → T06.
T02 after T01 because the deny message quotes the craft's own wording.

## Completed
- T01 — `crafts/comment-discipline/comment-discipline.md`, 46 lines.
  `[node scripts/validate-resources.mjs]` → `68 passed, 0 failed` (includes
  `PASS crafts/comment-discipline/comment-discipline.md`).
  `[wc -l crafts/*/*.md]` → 46 vs the longest existing craft `a11y-baseline` at 52 — under the
  ADR-006 budget. First draft came in at 61 and was cut, not rewrapped.
  ADR-004 held: `[rg -n '^[-*>]?\s*\**(Don|don|Never|never|Avoid|avoid)' crafts/comment-discipline/comment-discipline.md]`
  → no match; the four anti-patterns sit in one named section below the rules.
- Research: internal inventory (the corpus says nothing about comments; `anti-slop` is visual-only,
  `minimalism` is structure-only, `codebase-design` skipped Ousterhout's comment chapters) and an
  external survey of citable guidance.
- Hook payload confirmed against the official documentation: `tool_input.content` (Write),
  `old_string`/`new_string` (Edit), `edits[]` (MultiEdit). Praxis has never read any of them.
- `design.md` and `decisions.md` (ADR-001..ADR-006) written.
- T03 — `skills/codebase-design/references/COMMENTS.md` (62 lines, inside the 56–62 band its two
  siblings set), one `Going deeper` pointer in `skills/codebase-design/SKILL.md`, one
  **Uninformative Doc Comment** bullet in `agents/reviewer.md` carrying the ADR-005 carve-out.
  `[node scripts/validate-resources.mjs]` → `68 passed, 0 failed`.
  `[node --test tests/*.test.mjs]` → `pass 265 / fail 7`, identical with the three files stashed —
  all 7 are the T01 craft awaiting T06's inventory surfaces, none touch these files.
  `[node scripts/boundary-audit.mjs]` → `boundary clashes: 7`, unchanged from baseline.
  `[wc -l skills/codebase-design/references/*.md]` → `62 COMMENTS · 56 DEEPENING · 62 DESIGN-IT-TWICE`.

- T02 — the tier-1 content pass. Four helpers in `hooks/lib.sh` (`praxis_json_strings`,
  `praxis_added_lines`, `praxis_comment_group`, `praxis_scan_comments`) and one `comment_gate`
  call site in `hooks/pre-tool-use`, placed after the target is resolved and before the mode
  case, because the content is true or false independently of what `specs/` holds.

  **`praxis_json_string` cannot carry a file body, and this was tested, not assumed.** Its sed
  body is `"key"…"\([^"]*\)"`: it stops at the first `\"` inside the value, so
  `const s = "a \"q\" string";` truncates the body at the literal's opening quote, and its
  leading greedy `.*` returns the LAST `new_string` on a MultiEdit rather than all of them.
  `praxis_json_strings` replaces it for content only; the short-value callers are untouched.
  The discriminating test is `the content extractor survives a body that praxis_json_string
  truncates` — a body whose banner sits two lines PAST an escaped quote.

  **Per-pattern mutation, both directions.** `[sd 'hit("<k>", raw)' 'mutant = 1' hooks/lib.sh]`
  then `[node --test tests/hooks.test.mjs]`, restore, re-run. No detector is vacuous:

  | detector removed | fail | the tests that went red |
  |---|---|---|
  | `code`   | `pass 73 / fail 1` | tier 1 denies commented-out code |
  | `banner` | `pass 69 / fail 5` | tier 1 denies banner and divider comments · the content extractor · a tier-1 pattern already in the file · the carve-outs are mechanical · PRAXIS_COMMENTS=off (the last three carry a banner as their deny-control) |
  | `cot`    | `pass 70 / fail 4` | tier 1 denies chain-of-thought leakage · MultiEdit pools every old_string · the Codex apply_patch pass · the decoded body is byte-exact |
  | `todo`   | `pass 73 / fail 1` | tier 1 denies a TODO with no owner and no tracker |

  restored → `[node --test tests/hooks.test.mjs]` → `tests 74 / pass 74 / fail 0`.

  **The false-positive gate, which outranks the above.** 22 legitimate comments, each allowed:
  a Go exported doc comment, a rustdoc example (`/// let sum = add(1, 2);` — its body IS code),
  two regex/algorithm what-comments, `TODO(alice)`, `TODO: crbug.com/192795 -`, `TODO: see
  #1234`, three "step" prose lines, two URLs carrying `//` and `--`, `baseUrl = the API root`,
  `private helper: used only by parse()`, `const is preferred here`, `n=1 per arm`, a numpy
  docstring underline, and the four lines that cut a detector branch (below).
  Empirically: `[praxis_scan_comments over 71 source files in this repo]` → 0 hits.

  **Four chain-of-thought branches were cut, by real false positives, not imagined ones.**
  `^(first|next|then|finally|lastly),` fired on `# FIRST, in one linear gsub each` — a sentence
  continuing across two comment lines in `hooks/lib.sh` itself. `^now[ \t]+we` fired on
  `// Now we hold the lock`. `^here.?s (the|what|how|why)` fired on `// Here is why the offset
  is 1-based`, which is the why-comment the craft exists to ask for. `i.?ve`/`we.?ve`/`i.?m`
  fired on `// We have seen this fail on ARM`. `step` now also requires punctuation after its
  number, so `// Step 2 of the handshake` survives and `// Step 1:` does not. **`// First,` was
  named as a tier-1 pattern in the task and is no longer denied** — flagged here rather than
  quietly kept, because ADR-001 admits to tier 1 only what needs no judgment, and a clause
  opening a continued sentence needs judgment. The other three named patterns are unchanged.

  **Constraint A, the pre-existing-comment gate.** An `Edit` whose `old_string` carries all four
  patterns and whose `new_string` adds none is allowed, and so is the same block re-indented;
  the same edit that ALSO adds a banner is denied, so the test is not vacuous. MultiEdit pools
  every `old_string` before deciding, deliberately permissive.

  **Two decoding defects found and fixed, both in restoring a parked backslash.** `gsub` doubled
  it (awks disagree on replacement escaping); `split`/join then joined the value's LINES with it
  — BWK awk 20200816 splits on a newline whatever separator it is handed
  (`[awk 'BEGIN{S=sprintf("%c",1)} END{print split("a" S "b\nc", p, S)}']` → `3`, not `2`).
  `index()` is the only construct all three awks agree on. The repro is now a test.

  Performance: `[time bash hooks/pre-tool-use < 190KB-4000-line-write]` → `0.24s user`. The first
  version was `1.0s` — quadratic, one rescan per escaped quote; parking `\\` and `\"` on two
  control characters first makes the closing-quote search a single `index()`.

  Gates: `[node --test tests/*.test.mjs]` → `tests 285 / pass 278 / fail 7`.
  `[node scripts/validate-resources.mjs]` → `68 passed, 0 failed`.
  `[node scripts/boundary-audit.mjs]` → `boundary clashes: 7`, unchanged.
  The 7 failures are T06's inventory surfaces, proved not mine by
  `[git stash push hooks/pre-tool-use hooks/lib.sh tests/hooks.test.mjs; node --test tests/*.test.mjs]`
  → `pass 265 / fail 7`, the same seven names: `.cursor/rules/craft-comment-discipline.mdc`,
  `every craft has an explicit Cursor scope`, the two README inventory tests, `every surface that
  recites the craft list`, `every craft on disk is documented in AGENTS.md`, `the README resource
  table matches what is on disk`.

- T06 — the identity surfaces. All seven inventory failures closed; every number written was
  counted from the filesystem, never from a document.
  `[fd -t f SKILL.md skills | wc -l]` → `44` · `[fd -t f -e md -d 1 . agents | wc -l]` → `12` ·
  `[fd -t d -d 1 . crafts | wc -l]` → `7` · `[fd -t f -e md -d 1 . pipelines | wc -l]` → `5` ·
  `[fd -t f -e md -d 1 . commands | wc -l]` → `10`. Only the crafts count moved (6 → 7); the other
  four were already true and were re-checked rather than trusted.

  **The `.cursor` rule is generated, not written.** `comment-discipline: { alwaysApply: true }`
  added to `SCOPE` in `scripts/build-cursor-crafts.mjs` — always-apply like `minimalism`,
  `orchestration` and `evidence-discipline`, because it governs any file that carries code, not
  the web globs the three visual crafts are scoped to. `[node scripts/build-cursor-crafts.mjs]`
  → wrote all 7; `[git status --short .cursor/]` → only `craft-comment-discipline.mdc` is new,
  the other six byte-identical. Re-ran a second time → no drift.

  **README.** One section, `Comments a senior would keep`, placed with the other capability
  sections and held to the page's own voice: what the builders do, the four patterns the hook
  refuses, added-lines-only, the Go and Rust carve-outs, the four cited sources, and
  `PRAXIS_COMMENTS=off` stated rather than hidden. No ADR reference, no defect confession, no
  n-of-1 caveat — and **no measurements claim**, because T05 has not run. Inventing a number here
  is the exact failure this change exists to prevent.

  **AGENTS.md** — one row in the always-on crafts table, matching the six around it.
  **CHANGELOG.md** — three bullets under `[Unreleased] › Added`, shaped like the entries above
  them, carrying the ADR numbers and the honest notes (the four cut chain-of-thought branches,
  `// First,` no longer denied, the three documented gaps). **No version bumped** — this repo
  moves all four manifests in a separate `chore(release)` commit and `manifest.test.mjs` asserts
  the three versions agree.

  **Scope note, flagged rather than silently taken.** Making `every surface that recites the
  craft list` green needed the four files the test names — `hooks/context/contract.md`,
  `skills/using-praxis/SKILL.md`, `skills/using-praxis/references/claude-code-tools.md`,
  `.cursor/rules/praxis.mdc` — plus the one-line `SCOPE` entry the Cursor test points at by name.
  None is in T06's `files:` line and none belongs to another task; the recital is an inventory
  surface, so it was fixed here. Reported so the boundary is a decision, not an accident.

  Gates: `[node --test tests/cursor.test.mjs tests/manifest.test.mjs tests/references.test.mjs]`
  → `tests 31 / pass 31 / fail 0`. `[node scripts/validate-resources.mjs]` → `68 passed, 0 failed`.
  `[node --test tests/*.test.mjs]` → `tests 285 / pass 283 / fail 2` — the seven are gone; the two
  remaining are T04's, which landed on `agents/{engineer,backend,platform,design}.md` mid-run:
  `subagent-start resolves the dispatched agent's declared crafts` and `a bad matcher regex fails
  open, quietly` both count `design`'s crafts and still expect three. Not touched, per the file
  boundary.

- T04 — `comment-discipline` appended to `od.craft.requires` in `agents/{engineer,backend,platform,
  design}.md`. The four lists were not identical: `design` carries the three design crafts
  (`anti-slop`, `a11y-baseline`, `motion-discipline`), the other three carry `minimalism` +
  `evidence-discipline`. One line added to each; no list reordered.

  **The mechanism was confirmed before the declaration was trusted.** `hooks/subagent-start:49`
  calls `praxis_agent_crafts` (`hooks/lib.sh:175-199`), which parses `od.craft.requires` from
  `agents/<name>.md` and injects the body of `crafts/<name>/<name>.md`. `od.craft.requires` is the
  real mechanism, not a documented-only one. Resolved through the hook's own function:
  `[for a in engineer backend platform design reviewer; do . hooks/lib.sh; praxis_agent_crafts "$(pwd)" "praxis:$a"; done]` →
  `engineer/backend/platform → minimalism evidence-discipline comment-discipline` ·
  `design → anti-slop a11y-baseline motion-discipline comment-discipline` ·
  `reviewer → minimalism evidence-discipline`. `reviewer` is the negative control on the same
  code path: undeclared, so absent.

  **Routing dilution: zero, measured out-and-back.**
  `[node scripts/routing-audit.mjs]` before → `rank-1 61.0% · top-3 77.2% · top-5 81.6%`,
  `EN 69.6% (n=181, GATED) · ES 27.7%`, `PASS`. After the four edits → byte-identical. Files
  stashed out → identical again. `56 resources` in all three runs. The zero is structural, not
  luck: `loadCorpus` (`scripts/routing-audit.mjs:150-158`) builds each entry from `id`,
  `description` and `triggers:` only, so frontmatter under `od:` never enters the ranked text.
  EN rank-1 69.6% ≥ the 65 floor, unmoved.

  `[node scripts/validate-resources.mjs]` → `68 passed, 0 failed`.
  `[node scripts/boundary-audit.mjs]` → `boundary clashes: 7`, unchanged before and after.

  **Decision — the other six agents do not require it.** `reviewer`: no. Its tier-2 bullet
  (`agents/reviewer.md:100-103`) is self-contained — it carries the algorithm (a content word
  beyond the identifier, stop-words stripped), the fix, and both ADR-005 carve-outs inline. It is
  interpretable without the craft, so the craft would restate 46 lines into every review dispatch;
  ADR-006 names length on an always-on craft as a direct tax. `analyst`, `security`,
  `refuter-correctness`, `refuter-security`, `refuter-tests`: no. None writes source, and the craft
  governs what gets written. The tier-1 hook guards the write path whoever is dispatched, so the
  discipline is not lost — only the prose is, on agents that would never act on it.

- T04 (follow-up, on the coordinator's instruction) — the two red tests are fixed at the trap, not
  at the symptom. `tests/hooks.test.mjs` was granted to this task; the task that last edited it is
  finished, so there was no conflict.

  **The shape.** `subagent-start resolves the dispatched agent's declared crafts` now runs a
  membership loop over the crafts each agent must carry, then pins the count in a separate
  `assert.equal`. `a bad matcher regex fails open, quietly` drops its count entirely and asserts
  membership of one craft — its subject is fail-open, not the craft list, and an empty array is all
  the discrimination it needs. The reason is written into the file above the test, in its voice,
  naming both previous half-fixes so the two assertions do not get "simplified" back into one
  `deepEqual`. A stale count in the traversal test's comment ("yields three crafts") was made
  count-free at the same time.

  **Mutation, both directions, twice.** `[cp` backup, not `git checkout` — the first attempt used
  `git checkout -- agents/engineer.md` on an *uncommitted* file and reverted this task's own edit;
  caught immediately by the restore run going red, re-applied, re-verified. Recorded because a
  silent version of that is how a task reports green on work it deleted.`]

  | mutant | `[node --test tests/hooks.test.mjs]` | the message |
  |---|---|---|
  | A — delete `comment-discipline` from `agents/engineer.md` | `pass 73 / fail 1` | `engineer lost the comment-discipline craft — got minimalism,evidence-discipline` |
  | A restored | `pass 74 / fail 0` | — |
  | B — add a 5th craft (`orchestration`) to `agents/design.md`, as tomorrow would | `pass 73 / fail 1` | `design's craft count moved — confirm the number: anti-slop,a11y-baseline,motion-discipline,comment-discipline,orchestration` |
  | B restored | `pass 74 / fail 0` | — |

  Mutant B is the one the reshape exists for. It fails **one** assertion, the count, and the red is
  a true statement about the change. Under the old shape the same mutant failed **two** tests with
  `Expected values to be strictly deep-equal` — which reads as broken wiring. `a bad matcher regex
  fails open` stayed green through both mutants; it is no longer coupled to `design`'s craft list.

  **The count is pinned in exactly one more place, and it is already dynamic.** Checked rather than
  assumed: `tests/manifest.test.mjs:39` computes `crafts: dirs("crafts").length` from disk, and
  `tests/cursor.test.mjs:10` imports `craftNames` from `scripts/build-cursor-crafts.mjs` — neither
  carries a literal. `tests/references.test.mjs:17` derives `CRAFTS` from `dirNames("crafts")`.
  `README.md:166` says "**7** crafts" but is checked against the manifest's disk count, not pinned
  independently. No third literal exists.

  Gates, whole suite: `[node --test tests/*.test.mjs]` → `tests 285 / pass 285 / fail 0`.
  `[node scripts/validate-resources.mjs]` → `68 passed, 0 failed`.
  `[node scripts/routing-audit.mjs]` → `rank-1 61.0% · EN 69.6% (n=181, GATED)` · `PASS`, unmoved.
  `[node scripts/boundary-audit.mjs]` → `boundary clashes: 7`, unmoved.

- T05 — the live cell. **Result: GAP, not a tie. The craft was not shown to change what the model
  writes, because the defect did not reproduce in any arm — including a bare model with no plugin.**
  Written up unsoftened in `evals/value/RESULTS.md` § Unit 9.

  `[node evals/value/runs/t05-driver.mjs rescore]` → 9 cells, 3 arms, **2,102 lines of emitted code,
  125 comments, 0 detections on all four criteria in every cell**. Pooled redundancy per 100 code
  lines: treatment `0.00` · control `0.00` · bare `0.00`. **$12.12 for the grid, $13.98 all in.**

  **The instrument follows ADR-003, not density.** Four criteria, each traced to a published rule:
  restatement (`jsdoc/informative-docs`, stop-words `a an i in of s the`), banner, chain-of-thought
  leakage, and a docstring on a trivial private function (pyguide §3.8 inverted). Banner and CoT call
  `praxis_scan_comments` per line instead of reimplementing it — `hooks/pre-tool-use:158` says a
  second copy of those rules would be a second standard.

  **The hook confound, decided out loud.** Both arms ran `PRAXIS_FLOOR=off`, lifting the spec floor
  and the tier-1 pass together, so the craft is the only difference. Leaving the gate on would have
  clamped two of the four criteria to ~0 in BOTH arms. The user-facing number is recovered as a
  derived one — every emitted line replayed through the hook — and `wouldDeny` came back **0 in all
  nine cells**: on this task the gate would have denied nothing, in any arm.

  **A top-level cell would have measured nothing, and that was caught before spending.** A craft body
  reaches the model only through `hooks/subagent-start` (`hooks/lib.sh:175`); `contract.md` NAMES
  comment-discipline and carries none of its text. The cells therefore dispatch `praxis:engineer`.
  Proved mechanically per arm rather than assumed:
  `[node evals/value/runs/t05-driver.mjs injection]` →
  `treatment {"bytes":14237,"craftSection":true,"governingRule":true,"mentions":2}` ·
  `control {"bytes":9552,"craftSection":false,"governingRule":false,"mentions":0}`.

  **The bare arm is what turns a double zero into an answer.** With only treatment and control, zero
  vs zero is ambiguous between "the rest of Praxis already suppresses this" and "there was nothing to
  suppress". Bare — no plugin at all — also scored 0/0/0/0. It is the second.

  **Scorer proof, both directions, before any cell was bought.**
  `[node evals/value/runs/t05-scorer-proof.mjs]` → `19/19 proof checks pass`. Per criterion: fires on
  a known-bad sample, silent on a known-good one, drops to 0 when only its own lines are deleted
  while the other three hold, and — for the two criteria the eval owns — drops to 0 when ablated.

  **Three scorer defects, each found by reading rather than by review.** (1) Every banner was counted
  twice: a divider has no content word, and the restatement rule's `cw.length === 0` clause called
  that a restatement, inflating criterion 1 by exactly criterion 2 — caught by the isolation check
  before the grid. (2) `const second = resetsAt(c, key)` scored as a private trivial function; the
  declaration regex ended in an optional `\(?`, so every `const x = f(y)` in a test matched — caught
  by reading the probe cell's evidence, not its score. (3) Criterion 4 double-counts by construction
  once informativeness is applied, so it is reported as its own column and excluded from the total.

  **Criterion 4 is itself a GAP and is reported as one.** Its structural form fired twice and was
  wrong both times — on `cutoffOf`, a one-liner whose comment states a half-open-window boundary rule
  no reader could infer from `now() - windowMs`. That is the comment the craft exists to ask for.
  "Obvious" is not a property a mechanical check decides.

  **Density is noise here, measured locally rather than cited.** Comment volume swung 1.82–10.68 per
  100 lines inside the treatment arm and 0.48–11.21 inside the control, against a between-arm spread
  of 5.95 / 5.74 / 6.13. The within-arm variation is an order of magnitude larger than the difference
  between arms — ADR-003 corroborated in this corpus, on this model.

  **Setup facts, named.** `node --test` was denied 22–36 times in every one of the nine cells, for the
  orchestrator and the subagent, with and without the sandbox override: **the suite never ran in any
  arm**, so all nine cells are desk-checked, not verified. Identical across arms, so the comparison
  holds, but no arm ever iterated against a failing test — and iteration is the channel
  claude-code#65961 describes the defect accumulating in. One cell was bought and **thrown away**
  ($1.86): a shell word-split made the arm string `treatment 2`, which `pluginFor` sent down the
  control branch. Discarded rather than relabelled.

  **Not fixed, not mine:** `evals/value/units.mjs` does not export `investigationSuite`, which T09's
  `runs/t09-driver.mjs` imports, so T09's `run` path cannot execute
  (`[node -e "import('./evals/value/units.mjs').then(m=>console.log(typeof m.investigationSuite))"]`
  → `undefined`). T09's recorded results and streams are unaffected. Reported, left alone.

  **What this does NOT touch.** T02 proved the hook mechanically, per pattern, in both directions.
  That evidence stands; this run does not weaken it. What is unmeasured is the craft's *behavioural*
  claim, and the next task that wants it must put the model through the iteration loop where the
  defect was reported, not a single non-interactive build.

  Gates: `[node --test tests/*.test.mjs]` → `tests 285 / pass 285 / fail 0`, unmoved.

## Blocked
- T04 (resolved — kept for the record) — `[node --test tests/*.test.mjs]` → `tests 285 / pass 280 / fail 5` at the time of the run;
  3 of those 5 were T06's README inventory tests, which went green while this task ran. With the
  four agent files stashed out the suite is `pass 285 / fail 0`, so the remaining 2 are this task's
  and nobody else's: `subagent-start resolves the dispatched agent's declared crafts` and
  `a bad matcher regex fails open, quietly`, both in `tests/hooks.test.mjs` — outside this task's
  declared files, so not edited.

  Neither is a defect in the wiring. Both pin an **exhaustive** craft list for `design` and
  `engineer`, so adding a craft fails them for the wrong reason:
  `deepEqual(craftsIn(design).sort(), ["a11y-baseline","anti-slop","motion-discipline"])` (line 57),
  `deepEqual(craftsIn(engineer).sort(), ["evidence-discipline","minimalism"])` (line 64), and
  `deepEqual(craftsIn(context(out)).length, 3)` (line 100). The fix is those three literals:
  add `"comment-discipline"` to each list (sorted, it goes second for `design`, first for
  `engineer`) and `3` → `4`.

  This trap was already hit once and only half-closed: the inline comment at lines 59-62 records a
  previous author fixing exactly this class by *sorting* the list — which removed the
  declaration-order dependency but left the exhaustive equality, so the next added craft fires the
  gate on correct work again. A membership assertion (`assert.ok(crafts.includes(...))`) plus a
  separate pinned count would close it; that is a call for whoever owns the file.

  Resolved by the follow-up recorded in Completed above: the coordinator granted the file and asked
  for the trap closed rather than the three literals bumped. Nothing in this change is still blocked.

## Session Notes
- T02 leaves three documented gaps, none of them silent. A **trailing** comment
  (`x = 1; // Step 1:`) is not read: finding one means deciding whether `//` sits inside a
  string literal, and getting that wrong denies a line of correct code — the trade constraint B
  settles. **Doc-comment markers** (`///`, `//!`, `/**`, `/*!`, `#'`) are skipped by tier 1
  entirely, which is ADR-005 read literally and is what lets a rustdoc example through.
  **`NotebookEdit`** carries `new_source` and is not scanned; `apply_patch` is, because a Codex
  patch marks its added lines explicitly. `FIXME` is not gated — the craft and ADR-001 name
  `TODO`, and widening the contract was not this task's to do.

- The framing changed under measurement, and the record keeps the wrong version: this was posed as a
  volume problem and it is not one. AI comment density is 18.01% against a human 17.96%. What differs
  is the raw output before a human deletes the slop — which is the deletion this change automates.
- The single most useful published artifact is a linter rule, `jsdoc/informative-docs`, and it is the
  only shipping implementation in any language. For every language except JS/TS the check has to be
  a hook or a reviewer, because no tool does it.
- ADR-004 confirmed by reading, not by the grep. The builder flagged that its `rg` proves only that
  no rule line *begins* with don't/never/avoid, and cannot prove no rule is negatively *framed* —
  and asked for a human read rather than letting the green check stand for a judgment it did not
  make. Read: the four rule sections (`What earns one`, `Where it sits`, `Refactor first`,
  `Carve-outs`) each state what to write. The two "do not" strings are inside verbatim source quotes
  — the kernel's boilerplate sentence and Ousterhout's interface sentence — each attached to a
  positively-stated rule, which is what ADR-004 permits. The anti-patterns are one named section,
  last. PASS, on a read.
- Build wave closed by the orchestrator. `node --test tests/*.test.mjs` → `tests 285 · pass 285 ·
  fail 0`; `validate-resources` → `68 passed, 0 failed`; `routing-audit` → PASS, EN rank-1 69.6%
  (floor 65), unmoved; `boundary-audit` → 7, unmoved. Only T05 remains.
- Two recurring tooling facts surfaced across tasks and are recorded so the next one does not pay
  them again: `sd` exits 0 without modifying the file in cases that look like a match (seen twice by
  T04, and earlier in this session on a FIND string beginning with `- `), and `git checkout --` on a
  file whose change is still uncommitted reverts the current task's own work — T04 hit that while
  restoring a mutation, caught it because the restore run went red, and switched to `cp` backups.
  The silent version of that mistake is a task reporting green on work it had just deleted.
- ADR-007 accepted by the owner: the craft ships unmeasured, the hook ships proven, and the README
  carries no number because there is none. The 4,685-byte-per-dispatch cost stays named in the ADR
  rather than fading after the ship.
- Shipped. `gh pr create` → PR #15; CI run 34419924774 → `conclusion: success`;
  `gh pr merge 15 --merge` → verified with `gh pr view 15` → `state MERGED`,
  `mergedAt 2026-09-10T00:08:05Z`, `mergeCommit fe9b5a1`. No version cut — the CHANGELOG entry
  stays under `[Unreleased]` per this repo convention, where the bump is a separate `chore(release)`
  commit across all four manifests.
