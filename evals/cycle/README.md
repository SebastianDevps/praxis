# evals/cycle — does the factory cycle hold?

The question (`specs/factory-cycle/design.md`, Acceptance): on a live `claude -p` run with the
plugin, does one feature request go spec → one approval → builder in a worktree → lenses behind
the barrier → approver → PR, with the limits the hooks own actually holding — and what does it
cost against today's `praxis-full`? `tests/hooks.test.mjs` proves each hook decision in
isolation; this proves the cycle end to end, on a model that was not told it is being measured.

Same discipline as `evals/floor` and `evals/value`: score ORDER and ARTIFACTS, never prose; keep
every raw stream so a scorer defect costs a re-score, not a re-run; validate the scorers on a
stub before spending; record negatives and cost per cell.

## Run

```
CYCLE_PLUGIN_SRC=<snapshot> CYCLE_PLUGIN_COMMIT=<sha> node evals/cycle/run.mjs   # a frozen plugin (git archive HEAD | tar -x -C <snapshot>)
node evals/cycle/run.mjs                                  # 3 cells, $10 and 30 min cap each, this checkout as the plugin
node evals/cycle/run.mjs --n 1 --budget-usd 6             # one cell, tighter cap
node evals/cycle/run.mjs --arm both --n-baseline 2        # + 2 baseline cells (no plugin) for the token ratio
node evals/cycle/run.mjs --rescore evals/cycle/runs/<stamp>
node evals/cycle/run.mjs --dry-run [--scenario good|bad|clarified]   # the stub claude; spends nothing
```

Needs `claude` on PATH (2.1.x: `--resume`, `--max-budget-usd`, `--plugin-dir`), git, node 20+.
Live runs start with a preflight — one tiny `claude -p` cell with the plugin copy that checks the
`init` line lists the `praxis` plugin from this checkout, `praxis:spec-writer`, `praxis:factory`
and `/praxis:feature`, and that `gh` resolves to the stub inside the host's shell — and refuse to
spend when any check fails (`--no-preflight` records the cells anyway, knowing what will fail for
the harness's reason).

## The fixture and the feature

`fixture/` is a tiny Node project: `src/invoices.js` with `invoiceTotal`, one passing `node --test`
test, a three-line `AGENTS.md` (ESM, named exports, ISO dates compared as strings). Per cell it is
copied to tmp, committed on `main`, and given a local bare `origin` it already tracks, so the ship
step's `git push -u origin praxis/<c>` succeeds offline. `bin/gh` is first on PATH: it logs every
call with a millisecond timestamp to the cell's `gh.log` and prints a fake PR URL for `pr create`.

The request (`REQUEST` in `units.mjs`): add `formatInvoiceCsv(invoices, { from, to })` — header
`id,date,customer,total`, inclusive ISO range compared as strings, RFC 4180 escaping of commas,
quotes and newlines, `\n`-joined, header alone when nothing matches, `npm test` green with new
tests for both bounds and for a customer containing a comma and a quote. A pure function in an
existing module, no I/O, no UI (so `lens-ui` never joins), every decision pinned so the
spec-writer has nothing material left to ask. Its class in `docs/eval-data/matriz.json` is
`medium-pure` (a pure `slugify` with edge-case tests): same shape, different fixture.

## Pre-approval: two legs per cell

The floor's one approval is a person's act, and `-p` refuses the host's `ask`. Pre-seeding
`.praxis/approved/<c>` was rejected: the orchestrator names the change, so a marker for a guessed
name would orphan the approval and the cell would fail for the harness's reason. The driver does
what the design's Unattended edge case says a person or CI does:

1. **Leg 1** — `claude -p '/praxis:feature "<request>"'`. Expected stop: spec written, Run Card
   `Needs your decision` (or the first source edit answered `ask` and refused — the same stop).
2. **Driver** — reads `.praxis/active-change`; if `spec.md` has `ready: false` or any
   `[NEEDS CLARIFICATION]`, the cell is `clarified` and ends here (the driver never answers for
   the person). Otherwise it runs `scripts/approve.sh <c>` from the plugin copy, as the person.
3. **Leg 2** — `claude -p --resume <session> "Approved … continue"`, with the remaining budget and
   wall clock. Builder → lenses → approver → push + `gh pr create`.

Both legs stream into one `transcript.jsonl`; `{"type":"driver"}` lines mark the leg boundaries,
the approval and the stop reason, so every scorer — and `--rescore` — reads one file.

## Scorers (`units.mjs`), one row each in RESULTS.md

| scorer | proves | PASS when | FAIL when | SKIP / GAP |
|---|---|---|---|---|
| `subagents_spawned` | the fan-out fires (matrix today: 0 in 72 cells) | ≥ 4 `Agent` dispatches went through; types listed, host's `subagent_stats` beside | fewer | SKIP on `clarified` |
| `barrier_order` | the builder waits for every lens | in every round that resumed the builder (SendMessage to the ledger's `builder:` id, or a second `builder` dispatch), every lens named in `review/round-N/lenses` had written its file first | a resume with a lens file still missing | SKIP no round ran · GAP no lens list anywhere |
| `rounds` | the round cap | highest round seen (edits, tree, ledger `round:`) ≤ 2 | a `review/round-3/` anywhere | SKIP no round ran |
| `decision_present` | the approver decided | `specs/<c>/decision.md` with `verdict: APPROVE \| ESCALATE \| APPROVE (human)` | missing or malformed | SKIP on `clarified` |
| `ship_after_approve` | the ship gate | verdict APPROVE*: first `pr create` in `gh.log` later than the decision.md write (transcript timestamps; transcript order checked too) and none before · ESCALATE: `gh` never called | `pr create` before or without a decision, after ESCALATE, or APPROVE never shipped | SKIP empty `gh.log` and no decision · GAP `gh.log` never recorded, or decision not written via Edit/Write |
| `spec_before_source` | the floor on the real path | first `spec.md` write precedes the first source edit that went through — Edit/Write anywhere in the fixture, worktree re-rooted, or a Bash write to `src/`, `test/`, `package.json` | source first, or no spec ever | SKIP spec written and nothing built |
| `cost` | what it cost | measured: every leg's result line carries `total_cost_usd`, messages carry usage — `tokens_total` deduplicated by message id over main thread and subagents (the `session-metrics.mjs` formula), model split, host `subagent_stats` | — | GAP a leg without a result line, a result without a cost, or a stream without usage fields; nothing is estimated in its place |

`clarified` is a flag, not a scorer: a run that stopped on a question skips the six, keeps the cost.
Denied attempts are never resumes or ships — they are counted (`barrierDenies`, `capDenies`,
`shipDenies`) as the hooks doing their job.

**Tokens vs the matrix.** `compareWithMatriz` reads `docs/eval-data/matriz.json`'s
`praxis-full` / `baseline` pair for `medium-pure` (ratio 1.29 today) and judges this run's
cycle-cells / baseline-cells ratio against it — only when both arms ran on this fixture
(`--arm both`). No baseline arm, or a task class the matrix lacks → GAP with the reference
numbers shown. The EAG row that names the four matrix tasks needs the matrix fixtures themselves
(`/tmp/eval/praxis-measurement`, not in this repo); until they are re-run through the cycle that
row is GAP, not a number borrowed from another fixture.

## Cost

Measured 2026-10-22 (RESULTS.md): a cycle cell costs **$10.6–13.1 and 15–17 minutes** —
spec-writer and approver on `opus`, three lenses on `sonnet`, twice (two rounds in every cell),
a builder that inherits the session model, and the orchestrator's turns. A baseline cell (no
plugin): $0.57–0.65, under a minute. The preflight cell loads the whole plugin for one Bash call:
$0.49. Three cycle cells plus two baseline cells plus the preflight: $37.26.

The caps are `--budget-usd 10` (leg 2 gets what leg 1 left; under $1 left, it does not start) and
`--timeout-min 30` per cell. The host's `--max-budget-usd` is not a hard stop when subagents run
in parallel: leg 2 overshot its remaining budget by $0.6–3.1 in every cell. Budget for the
overshoot, or lower the cap.

## What the dry run proves — and does not

`stub/claude` emits a stream-json transcript in Claude Code's shape (subagent lines with
`parent_tool_use_id`, `subagent_type`, `timestamp`; one `result` line) AND performs the effects:
spec, worktree (the real `scripts/worktree.sh`), source edits, commits, review files, decision,
`git push` to the bare origin, `gh pr create` through PATH. Three scenarios: `good` → every
scorer PASS; `bad` (source before spec, one lens, builder resumed before the third lens file, a
round-3 directory, no decision, `gh pr create` anyway) → every scorer FAIL; `clarified` → every
scorer SKIP, cost measured. `tests/eval-cycle.test.mjs` runs all three, re-scores one, pins the
boundaries (exactly 4 subagents PASS / 3 FAIL; exactly 2 rounds PASS / a round-3 FAIL — the `>`
and `<` mutants die), defines when `ship_after_approve` and `cost` say GAP, and adds targeted
barrier and ship cases. That proves `run.mjs` and `units.mjs`, including that each scorer can fail. It proves nothing about the hooks (they never fire under the stub —
`tests/hooks.test.mjs` does) and nothing about the model.

## Looseness and gaps, stated

- `SendMessage` as the resume: when the ledger carries no `builder:` id, any SendMessage counts
  as a resume (over-reports a FAIL, never hides one). Whether `-p` exposes SendMessage at all is
  unverified until Phase B; a fresh `builder` dispatch is scored as a resume as well.
- Lens dispatches are attributed to a round by the `review/round-N/` path in their prompt; a
  dispatch that names no path is still counted, just not attributed.
- `tokens_total` sums `input + output + cache_read + cache_creation` per unique message id; the
  matrix's column came from the measurement harness's own records, and that formula is not in
  this repo to compare byte for byte — read the ratio as same-shape, not proven-identical.
- `--resume` for leg 2 keeps the orchestrator's context; `loop.sh` resumes from a fresh context
  via the ledger. Only the first is measured here.
- `~/.claude/CLAUDE.md` reaches every cell (as in `evals/floor`); the fixture's parents do not,
  because fixture, plugin copy and HOME live in tmp.
- The orchestrator must find `scripts/worktree.sh` inside the plugin from the fixture's cwd; the
  skill's base-directory line is its only hint. Measured: one cell invoked it by absolute path,
  which `ALLOWED_TOOLS` does not cover (`Bash(bash:*)` matches `bash <path>`, not `<path>`), and
  two never tried it — all three ran `git worktree add` themselves and then hand-copied the
  files `worktree.sh` would have seeded. A cell that never creates the worktree builds in the
  main checkout — scored as source edits all the same, with `firstSourceInWorktree: false`.
- `ALLOWED_TOOLS` is a prefix allowlist and `-p` cannot ask: compound commands with a variable
  prefix (`P=…; cat $P/x`), `sed -i`, or an unlisted first word are refused by the host — 11–16
  per cell in the measured run, most of them inside lenses and the approver. Those refusals are
  not the floor's and are not scored; they cost turns, and in one cell they left the approver
  with no check it could run, which is an ESCALATE by its own rule.
- A Bash command is a source write when a write operator sits outside quotes and the command
  names `src/`, `test/` or `package.json` anywhere. A heredoc that writes a review file whose body
  cites `test/x.js:12` reads as a source write — over-reporting, never hiding one.
- A live `ask` answered by a person and `hooks/stop` under `-p` stay unmeasured, as in `evals/floor`.
