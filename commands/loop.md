---
description: Run an autonomous build loop on a task until done or a guardrail trips — opt-in, with hard stop-limits outside the model.
---

# /praxis:loop — guarded autonomous build

Runs the `autonomous-loop` discipline under a bash driver whose stop-limits live OUTSIDE the model.
This is OPT-IN. Most tasks should NOT loop — a single visible build with verification is better. Reach
for the loop only when the work is genuinely iterative (large mechanical migration, fix-until-green on a
known-good test suite, repetitive scaffolding) and a fresh context per iteration helps more than it hurts.

## What the agent does

1. **Confirm or create the ledger.** Ensure `specs/<change>/implementation.md` exists (task line
   shape, phases and states: `docs/task-model.md`; the folder: `spec-lifecycle`) with a bite-sized,
   independently-testable plan per the `writing-plans` skill. No ledger, no loop — the loop's only
   memory is that file and its own commits. If it's missing or vague (four hand-wavy bullets), write
   a real one first. The script picks the active change (`.praxis/active-change`, else the newest
   ledger) and falls back to a flat `PROGRESS.md` only in a repo that has not adopted spec folders —
   elsewhere that file is just the index of changes.
2. **Run the loop** via `scripts/loop.sh`. Each iteration is a new `claude -p` on a fresh context,
   handed the seven-section prompt the `autonomous-loop` skill describes — LEDGER (the file plus the
   last N `Praxis-Loop:` commits) → TASK BREAKDOWN → TASK SELECTION (critical bugfix → tracer bullet
   → polish → refactor) → EXPLORATION → EXECUTION → FEEDBACK LOOPS (typecheck and tests green before
   the commit) → COMMIT (task · decisions · files · blockers; ledger line in the same commit) — and
   the final rule, one task per iteration.
   ```
   bash scripts/loop.sh --task "<one-line goal>" [--max-iterations N] [--max-duration 2h] [--history 10]
   ```
3. **Read the exit code.** Three stop conditions, then the guardrails:

   | exit | meaning |
   |---|---|
   | 0 | `NO MORE TASKS` (or `COMPLETE`) — the ledger has nothing pending |
   | 1 | `ABORT` — the agent was blocked; or `claude` itself failed |
   | 2 | usage error |
   | 3 | a test file changed during an iteration — verifier integrity guard |
   | 4 | stopped without completion: iteration cap, wall-clock, cost cap, or no progress |

   `HANG ON A SECOND` is not a stop: the task was split and the smaller chunk done; the loop
   continues and the log says so. A signal is read only on its own line — a mention inside prose is
   prose.

## The guardrails live in the script, not the model

The iteration cap is the one stop condition that is entirely outside the model — a counter in bash.
The numeric stop-limits (max iterations, wall-clock cap, best-effort cost cap, no-progress detection,
completion confirmation, and the verifier-integrity guard that halts if a test file was modified) are
enforced by `scripts/loop.sh`, OUTSIDE the interactive model. This is a runner safety limit on an
opt-in automated process — not a gate on your normal interactive session. Praxis never blocks your manual
work; it only bounds a loop you explicitly started. See `scripts/loop.sh --help` for every flag and default.

Adapted from `afk-claude.sh` in mattpocock/ralph-workshop-repo-001, the backlog prompt in
total-typescript-monorepo, and `simple-loop` in mattpocock/sandcastle.
