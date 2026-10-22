---
description: Run the cycle unattended on one change until it ships or a guardrail trips — opt-in, with hard stop-limits outside the model.
---

# /praxis:loop — the cycle, unattended

Runs the `factory` cycle under a bash driver whose stop-limits live OUTSIDE the model. Each
iteration is a fresh `claude -p` told to continue ONE change through the `factory` skill and do
exactly one step of it: spec → approve → build → review → approve → ship. This is OPT-IN. Most
changes should run interactively — one visible cycle with the person answering the one question
and the one approval. Reach for the loop when nobody will be at the keyboard and the change is
well enough specified that the spec-writer should have no open question.

## What the agent does

1. **Confirm the change.** `scripts/loop.sh` picks the active change (`.praxis/active-change`,
   else the newest ledger) and drives `specs/<change>/implementation.md` (task line shape, phases
   and states: `docs/task-model.md`). It falls back to a flat `PROGRESS.md` only in a repo that
   has not adopted spec folders — elsewhere that file is the index of changes. If the change has
   no ledger yet, open it first through the `factory` skill so the first iteration finds the
   cycle at `stage: new`, not a seeded placeholder.
2. **Decide the approval.** An unattended run cannot answer the floor's ask. Either the person
   approves before the run (`/praxis:approve <change>`), or starts the loop with `--approve`,
   which runs `scripts/approve.sh <change>` before the first iteration. Without either, the first
   source edit is refused and the run stops, as designed.
3. **Run the loop** via `scripts/loop.sh`:
   ```
   bash scripts/loop.sh [--task "<goal>"] [--approve] [--max-iterations N] [--max-duration 2h] [--history 10]
   ```
   `--task` defaults to `continue <change>`. Every iteration gets the LEDGER (the file plus the
   last N `Praxis-Loop:` commits) → ONE STEP (the step the `factory` skill names for this
   `stage:` and `round:`) → EXECUTION (roles dispatched with paths, never content; the two
   markers off limits) → FEEDBACK LOOPS (the step's gate green before the commit) → COMMIT (one
   commit, ledger in it, trailer) → FINAL RULES.
4. **Read the exit code.** The cycle's two end states are read from files after every
   iteration, before any signal the model emitted:

   | exit | meaning |
   |---|---|
   | 0 | the ledger says `stage: shipped` — or `NO MORE TASKS` / `COMPLETE` confirmed |
   | 1 | `ABORT` — the agent was blocked; or `claude` itself failed |
   | 2 | usage error; also `--approve` with no spec to approve |
   | 3 | a test file changed during an iteration — verifier integrity guard, legacy mode only (in the cycle the builder writes tests by design, on its own branch; the tests lens and the approver judge them) |
   | 4 | stopped without completion: iteration cap, wall-clock, cost cap, or no progress |
   | 5 | `.praxis/needs-human/<change>` exists — the hook-written record of the approver's ESCALATE; a ledger `stage: needs-human` alone does not stop the loop |

   On 5 the script prints the two ways on, both the person's: `/praxis:rework <change> "<note>"`
   sends it back to the builder with the round counter reset; `/praxis:approve <change>` ships
   it as is — or the person reruns the loop with `--approve`, which does the same and then
   continues. Do not run either yourself.

   `HANG ON A SECOND` is not a stop: the step was split and the smaller chunk done; the loop
   continues and the log says so. A signal is read only on its own line — a mention inside prose
   is prose.

## The guardrails live in the script, not the model

The iteration cap is the one stop condition that is entirely outside the model — a counter in
bash. The numeric stop-limits (max iterations, wall-clock cap, best-effort cost cap, no-progress
detection, completion confirmation, the verifier-integrity guard that halts if a test file was
modified) and the two file-read end states are enforced by `scripts/loop.sh`, OUTSIDE the
interactive model. The cycle's own limits — one approval, the review barrier, the round cap, the
ship gate — are the hooks' and hold inside every iteration (`docs/cycle.md`). This is a runner
safety limit on an opt-in automated process, not a gate on your normal interactive session.
Praxis never blocks your manual work; it only bounds a loop you explicitly started. See
`scripts/loop.sh --help` for every flag and default.

Adapted from `afk-claude.sh` in mattpocock/ralph-workshop-repo-001, the backlog prompt in
total-typescript-monorepo, and `simple-loop` in mattpocock/sandcastle.
