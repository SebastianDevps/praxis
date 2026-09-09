---
name: autonomous-loop
description: Use when running an agent in a repeating self-driven loop ("ralph", run until done, keep iterating, autonomous build) — re-run on a fresh context each iteration with progress in files and git, doing ONE thing per loop. NOT a planned multi-task run with review between tasks (that is `subagent-driven-development`), NOT the doctrine framing it (that is `agentic-lifecycle`).
kind: skill
od:
  triggers: ["ralph loop", "run until done", "keep iterating", "autonomous loop", "loop until"]
---

# Autonomous Loop — the ralph discipline

Origin: Geoffrey Huntley's "ralph". One agent, re-run on a FRESH context each iteration, doing exactly
ONE thing per loop. Progress lives in files + git — NEVER in the context window, because the window
resets every iteration. The loop's memory is the filesystem: the ledger and the loop's own commits.

For the AUTOMATED version with hard numeric stop-limits enforced outside the model, use `/praxis:loop`
(it wraps `scripts/loop.sh`, which builds the iteration prompt below). This skill is the discipline
whether you run it by hand or via the script.

## The iteration, in seven sections

The prompt each iteration receives has this shape; by hand, walk it in this order.

1. **LEDGER** — read `specs/<change>/implementation.md` (task lines, phases and states:
   `docs/task-model.md`) and the last N loop commits (`git log --grep='^Praxis-Loop:'`).
   Reconstruct state from them — never assume you remember the last iteration. You don't; it was a
   different context.
2. **TASK BREAKDOWN** — if the next pending task is larger than one iteration can finish and verify,
   split it in the ledger first. Smallest unit of work; do not outrun the headlights.
3. **TASK SELECTION** — ONE task in `state: pending`, never one in `blocked(user)` (it waits on a
   person, and an unattended run is not that person). Priority order: critical bugfix → tracer
   bullet (a thin end-to-end slice that proves the approach) → polish / quick win → refactor. No task
   left → emit `NO MORE TASKS`.
4. **EXPLORATION** — search the codebase before implementing. The feature you are about to "add" may
   already exist; the conventions it must match are in the files around it.
5. **EXECUTION** — complete the task, for real. Two signals: `ABORT` when blocked (the loop exits 1;
   a blocked task retried on a fresh context is blocked again); `HANG ON A SECOND` when the task is
   larger than expected — split it, do the smaller chunk, continue.
6. **FEEDBACK LOOPS** — typecheck and tests pass BEFORE the commit. A red gate is not committed:
   fix it, or `ABORT`.
7. **COMMIT** — one commit whose message carries: task · decisions · files · blockers for the next
   iteration, with the `Praxis-Loop: <task id>` trailer. The task's ledger line is updated in the
   same commit. Then the **final rule**: one task per iteration.

A signal counts only when it stands alone on its own line. Matt's `afk-claude.sh` matched
`*ABORT*` as a substring, so an agent narrating "I will not ABORT this" ended its run; the
own-line rule is the fix, and `tests/loop.test.mjs` pins it.

## Hard rules (these are where loops fail)

- **NO placeholders or stubs.** A fresh model chases the compile/green reward and will stub a function
  to make the build pass. A stub is not progress — it's debt the next iteration can't see.
- **NEVER modify or delete test files to make tests pass.** Documented reward-hacking: strong models did
  exactly this in ≥30% of runs. The tests are the VERIFIER. Tampering with the verifier invalidates the
  entire loop — every green after that is a lie. If a test seems wrong, surface it; do not edit it.
- **Declarative spec over imperative steps.** Describe the desired end state, not a script of moves. If
  the spec is bad, the results are meh — the loop only amplifies what you gave it.

## Stop discipline (even by hand)

Three stop conditions. One lives outside the model; two are the model's own signals, each on its
own line:

- Iteration cap — a counter in the runner (`--max-iterations`), never a judgement the model
  makes. The cap is the cost ceiling; reaching it without completion is exit 4, a human checkpoint.
- `NO MORE TASKS` (or `COMPLETE`) — the ledger has nothing pending → exit 0. It is a claim
  about a file, so one sighting is enough; `--done-streak` asks for more when the ledger is not
  trusted.
- `ABORT` — blocked → exit 1 after that iteration.

The runner adds guardrails that are not the model's to emit: wall-clock cap, no-progress halt
(no new commit twice in a row), and the verifier-integrity guard (exit 3 when a test file changed).
On a stall, diagnostics go to the ledger and the loop STOPS for a human — it does not keep
thrashing against the same wall.

## It's working if

- Every iteration ends in exactly one commit, or in a signal on its own line — never in both zero
  commits and no signal twice running.
- A commit message read alone tells the next iteration what was done, what was decided, and what
  blocked; the ledger line for that task changed in the same commit.
- `HANG ON A SECOND` leaves a smaller task in the ledger and a smaller commit in git.
- No test file changed across the whole run.

Adapted from `plans/prompt.md` and `afk-claude.sh` in mattpocock/ralph-workshop-repo-001, the
priority order and `HANG ON A SECOND` in total-typescript-monorepo `plans/backlog/prompt.md`, and
the distilled `simple-loop/prompt.md` in mattpocock/sandcastle.
