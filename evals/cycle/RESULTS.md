# Cycle — 2026-10-22

Question: on a live `claude -p` run with the plugin, does one feature request go spec → one
approval → builder in a worktree → lenses behind the barrier → approver → PR, with the limits the
hooks own holding — and what does it cost? (`specs/factory-cycle/design.md`, Acceptance.)

Setup: claude 2.1.308 · session model `claude-fable-5-1` (orchestrator, builder) · spec-writer and
approver `claude-opus-5-5` · lenses `claude-sonnet-5-5` (all three seen in `modelUsage`) · plugin
under test: snapshot of commit **632e642** (`git archive HEAD | tar -x`, hooks.json prefixed with
the isolated HOME as `evals/floor` does; `hooks/scripts` clean before and after the run) ·
fixture `evals/cycle/fixture/` (invoice helpers, `node --test`), request `REQUEST` in `units.mjs`
(`formatInvoiceCsv`, class `medium-pure`) · 3 cycle cells + 2 baseline cells (no plugin) ·
`--budget-usd 10 --timeout-min 30` per cell · `--permission-mode acceptEdits` with the
`ALLOWED_TOOLS` list in `run.mjs` · preflight 5/5 ok ($0.49). **Total $36.77 for 5 cells**
(+$0.49 preflight). Artifacts: `evals/cycle/runs/2026-10-22_05-02-12/` (gitignored, kept
locally; `--rescore` re-reads them). No cell was re-run.

## Per cell

| cell | arm | stop | subagents_spawned | barrier_order | rounds | decision_present | ship_after_approve | spec_before_source | cost | tokens | wall |
|---|---|---|---|---|---|---|---|---|---|---|---|
| cell-1 | cycle | — | PASS (9) | PASS (2 rounds, resume via SendMessage after round 1) | PASS (max 2) | PASS APPROVE | PASS (1 `pr create`, 20 s after decision.md) | PASS (#17 < #36) | $10.58 | 8,077,443 | 16 min |
| cell-2 | cycle | — | PASS (9) | PASS (2 rounds, resume via SendMessage) | PASS (max 2) | PASS APPROVE | PASS (1 `pr create`, 20 s after decision.md) | PASS (#12 < #56) | $13.11 | 12,746,607 | 17 min |
| cell-3 | cycle | — | PASS (9) | PASS (2 rounds, resume via SendMessage) | PASS (max 2) | PASS ESCALATE | PASS (ESCALATE, `gh` never called, nothing pushed) | PASS (#11 < #47) | $11.86 | 9,245,446 | 15 min |
| baseline-1 | baseline | — | SKIP | SKIP | SKIP | SKIP | SKIP | SKIP | $0.57 | 137,792 | 35 s |
| baseline-2 | baseline | — | SKIP | SKIP | SKIP | SKIP | SKIP | SKIP | $0.65 | 171,788 | 45 s |

Subagents per cycle cell: spec-writer, builder, 3 lenses × 2 rounds, approver = 9 (the host's
`subagent_stats.spawned` agrees in every cell). `clarified` 0/3 — the request is pinned by design;
`ready: true`, 0 open questions in every spec. Model self-approval attempts: 0. Tokens =
`modelUsage` summed over legs and models (input + output + cache read + cache creation; covers
subagents; its `costUSD` adds up to `total_cost_usd` to the cent).

## Tokens against today's measurement

| | cycle (mean of 3) | baseline (mean of 2) | ratio | matrix `praxis-full` / baseline (`docs/eval-data/matriz.json`) |
|---|---|---|---|---|
| tokens (all) | 10,023,165 | 154,790 | **64.8×** | trivial-copy 1.31 · medium-pure 1.29 · complex-endpoint 1.17 · trap-discount 1.12 |
| output tokens | 109,757 | 3,568 | 30.8× | — |
| cost | $11.85 | $0.61 | 19.5× | — |

93 % of the cycle's tokens are cache reads: nine fresh contexts, each loading the plugin and
re-reading the fixture, spec and diff, twice over for the lenses. The matrix's `praxis-full`
measured one agent in one context; the cycle is a different shape, and on this fixture it costs
fifty times the tokens and twenty times the dollars of the plain model, which shipped the same
function with 5–6 green tests in under a minute. `compareWithMatriz` → **FAIL** (ratio 64.75 vs
1.29 for `medium-pure`). Same-shape caveat: the matrix's `tokens_total` came from the measurement
harness's records (formula not in this repo); the baseline cells here (138k–172k) land where the
matrix's `medium-pure` baseline did (185k), so the definitions are at least commensurate.

## EAG rows (`specs/factory-cycle/design.md`, Acceptance)

| row | state | evidence |
|---|---|---|
| `node --test tests/*.test.mjs` → all pass | PASS | working tree at HEAD f3a0ec1 + this harness: `tests 385 · pass 385 · fail 0` (`tests/eval-cycle.test.mjs`: 16/16) |
| `wc -l hooks/context/contract.md` → ≤ 40 | PASS | snapshot 632e642: `wc -l hooks/context/contract.md` → `40` |
| `evals/cycle`, 3 cells: `subagents_spawned ≥ 4` | PASS | 9 / 9 / 9 (`subagent_stats.spawned` 9 / 9 / 9) |
| every `review/round-1/*.md` exists before any builder resume | PASS | 3/3 cells: all three round-1 files written before the SendMessage that resumed the builder (`writtenBeforeResume` = correctness, security, tests); 0 barrier denies needed |
| rounds ≤ 2 | PASS | max round 2 / 2 / 2; no `review/round-3/` anywhere; ledger `round: 2`; 0 round-cap denies needed |
| `decision.md` present | PASS | APPROVE (round 2) · APPROVE (round 2) · ESCALATE (round 2), each with `## Checks run` |
| the stub `gh` is invoked only after APPROVE | PASS | cell-1 decision 05:17:49.9 → `pr create` 05:18:10.1; cell-2 05:34:53.9 → 05:35:14.2; cell-3 ESCALATE → `gh.log` empty, `origin-log.txt` empty |
| tokens on the 4 matrix tasks ≤ `praxis-full` ratios (1.31 / 1.29 / 1.17 / 1.12) | FAIL on this fixture · GAP on the matrix tasks | 64.8× vs 1.29 for the `medium-pure` analogue; the four matrix fixtures (`/tmp/eval/praxis-measurement`) are not in this repo and were not run through the cycle |
| trap task: asked ≥ 2/4 via `[NEEDS CLARIFICATION]` | GAP | not this fixture — the request is unambiguous on purpose; 0/3 cells asked, which is the designed outcome here, not the trap measurement |
| SubagentStart output for `builder` ≤ 15 lines + change line (+ crafts) | GAP (here) | not read from these transcripts; `tests/hooks.test.mjs` measures the hook |
| a live `ask` answered by a person; `hooks/stop` under `-p` | GAP | unmeasured, as in `evals/floor`: `-p` refuses `ask` (seen twice: trace `PreToolUse ask full test/invoices.test.js`), and the stop hook's block cannot be observed from the stream |

## What the transcripts show

- **The lenses went out in ONE message.** In all three cells and both rounds, the three
  `Agent(refuter-*)` calls share one assistant message id (6/6 rounds). Round 1 verdicts were
  correctness PASS · security PASS · tests CHANGES in every cell; round 2 was all PASS in every
  cell. `review/round-N/lenses` was written before each dispatch.
- **`SendMessage` resumes the builder under `-p`.** 11 SendMessage calls, all delivered. Each
  cell resumed its builder after round 1 with a SendMessage to the ledger's `builder:` id; the
  scorer's `resumeVia: SendMessage`. The orchestrator also messaged the spec-writer (cell-1 #103,
  cell-2 #36) to amend the spec after a finding.
- **Every cell stopped on `Needs your decision` and resumed on leg 2.** Leg 1 ended with a Run Card
  `Needs your decision`, ledger `stage: designed`, spec `ready: true`. The driver ran
  `approve.sh format-invoice-csv` (exit 0 ×3) and leg 2 (`--resume`) carried on to `shipped`
  (cells 1–2) or `needs-human` (cell-3). Two shapes of the stop: cell-1's orchestrator waited for
  approval before dispatching the builder; cells 2–3 dispatched the builder in leg 1, whose first
  source edit hit the floor's `ask` (refused in `-p`), so the builder paused and leg 2 resumed it.
- **The ship gate was never asked to deny.** Cells 1–2 pushed `praxis/format-invoice-csv` to the
  bare origin (6 and 7 commits) and opened the PR only after `decision.md: APPROVE` with round 2
  all PASS; cell-2's first `gh pr create` was refused by the host ("Quoted text in this command
  can't be checked"), the retry went through — one `pr create` in `gh.log`. Cell-3's ESCALATE:
  no push, no `gh` call, `.praxis/needs-human/format-invoice-csv` written by `post-tool-use`,
  ledger `stage: needs-human`, Run Card `Needs your decision`. The hook's deny paths (barrier,
  cap, ship) had nothing to deny in these cells — the orchestrator waited and stopped by itself;
  `tests/hooks.test.mjs` is what proves the denies.
- **Cell-3's ESCALATE is the approver's rule meeting the harness's allowlist.** Its Bash calls
  (`P=…; cat $P/…`, compound commands) were refused by the host's non-interactive permission
  check, so it ran none of the seven Acceptance lines and wrote ESCALATE: "a check you did not run
  is not a check". The lenses in that cell judged statically for the same reason. The
  orchestrator then ran `npm test` itself and still did not ship. 40 Bash refusals across the
  three cells (13 / 16 / 11), most inside subagents; not scored, visible in `score.json`.
- **No cell got the worktree the design describes.** cell-1 called `<plugin>/scripts/worktree.sh`
  by absolute path — not covered by `ALLOWED_TOOLS` — and fell back to `git worktree add`; cells
  2–3 ran `git worktree add` without trying the script. Without `worktree.sh`'s seeding, the
  floor inside the linked worktree could not resolve the change and denied the builder's first
  edits with `specs/<change>/ has no spec yet` (3 / 2 / 1 denies — the worktree gap T04 recorded
  as `todo`). Each orchestrator then hand-copied `.praxis/active-change`, the marker and
  `spec.md` into the worktree (cell-2 also the ledger; cell-3 committed the spec on the branch)
  and the build went on. In cell-1 the builder, after those denies, wrote the test file through a
  Bash heredoc (`cat > $W/test/invoices.test.js`, #36, allowed): the documented Bash-path gap,
  seen once — the approval existed, so the floor's intent held while its mechanism did not.
- **Budget.** `--max-budget-usd` did not stop leg 2 at its cap: overshoot $0.6 / $3.1 / $1.9.
  Builder commits and the PR body carry the host's attribution lines (`Co-Authored-By`,
  "Generated with Claude Code"); not scored.

## Verdict

The cycle holds on the three cells: 18/18 scorer states PASS, two PRs opened only after APPROVE,
one ESCALATE that stopped exactly where the design says and left a `needs-human` record. What
does not hold is the cost: 65× the tokens and 20× the dollars of the plain model on a task the
plain model finishes in a minute. The next measurement belongs to the matrix tasks themselves
and to the fan-out's context (nine fresh contexts each loading the plugin), not to this fixture.
