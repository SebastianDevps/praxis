---
name: autonomous-loop
description: Use when running an agent in a repeating self-driven loop ("ralph", run until done, keep iterating, autonomous build) — re-run on a fresh context each iteration with progress in files and git, doing ONE thing per loop.
kind: skill
od:
  triggers: ["ralph loop", "run until done", "keep iterating", "autonomous loop", "loop until"]
---

# Autonomous Loop — the ralph discipline

Origin: Geoffrey Huntley's "ralph". One agent, re-run on a FRESH context each iteration, doing exactly
ONE thing per loop. Progress lives in files + git — NEVER in the context window, because the window
resets every iteration. The loop's memory is the filesystem.

For the AUTOMATED version with hard numeric stop-limits enforced outside the model, use `/praxis:loop`
(it wraps `scripts/loop.sh`). This skill is the discipline whether you run it by hand or via the script.

## Per-iteration contract

1. **Read the ledger** (`PROGRESS.md`). Reconstruct state from it — never assume you remember the last
   iteration. You don't; it was a different context.
2. **Pick ONE item** — the single highest-priority incomplete task. Not two. One.
3. **Search before implementing.** Grep the codebase first — the feature you're about to "add" may
   already exist. Assuming it's missing creates duplicates and conflicts.
4. **Implement it for real.** Then **update the ledger** at the end of the iteration.

## Hard rules (these are where loops fail)

- **NO placeholders or stubs.** A fresh model chases the compile/green reward and will stub a function
  to make the build pass. A stub is not progress — it's debt the next iteration can't see.
- **NEVER modify or delete test files to make tests pass.** Documented reward-hacking: strong models did
  exactly this in ≥30% of runs. The tests are the VERIFIER. Tampering with the verifier invalidates the
  entire loop — every green after that is a lie. If a test seems wrong, surface it; do not edit it.
- **Declarative spec over imperative steps.** Describe the desired end state, not a script of moves. If
  the spec is bad, the results are meh — the loop only amplifies what you gave it.

## Stop discipline (even by hand)

A loop with no stop condition burns budget on thrashing. Stop on ANY of:

- **Completion signal confirmed N times** (default 3). One "DONE" is noise — a model says done then keeps
  editing. Require the done-marker N consecutive iterations.
- **No progress** — no new git commit this iteration, OR the failing-test signature is identical to last
  iteration. Same failure twice = stuck, not converging. Halt and diagnose.
- **Iteration cap reached.** The cap is the cost ceiling; respect it.

On a stall or error ceiling, write diagnostics to the ledger and STOP for a human — do not keep thrashing
against the same wall.
