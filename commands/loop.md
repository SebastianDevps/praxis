---
description: Run an autonomous build loop on a task until done or a guardrail trips — opt-in, with hard stop-limits outside the model.
---

# /praxis:loop — guarded autonomous build

Runs the `autonomous-loop` discipline under a bash driver whose stop-limits live OUTSIDE the model.
This is OPT-IN. Most tasks should NOT loop — a single visible build with verification is better. Reach
for the loop only when the work is genuinely iterative (large mechanical migration, fix-until-green on a
known-good test suite, repetitive scaffolding) and a fresh context per iteration helps more than it hurts.

## What the agent does

1. **Confirm or create the ledger.** Ensure `PROGRESS.md` exists with a bite-sized, independently-testable
   plan per the `writing-plans` skill. No ledger, no loop — the loop's only memory is that file. If it's
   missing or vague (four hand-wavy bullets), write a real one first.
2. **Run the loop** via `scripts/loop.sh`. The script re-invokes `claude -p` each iteration, feeding the
   prompt + ledger, and enforces every guardrail in bash:
   ```
   bash scripts/loop.sh --task "<one-line goal>" [--max-iterations N] [--max-duration 2h] [--done-streak 3]
   ```
3. **Honor the `autonomous-loop` discipline inside each iteration**: read ledger → ONE highest-priority
   item → search before implementing → real code (no stubs) → NEVER touch test files → update ledger.

## The guardrails live in the script, not the model

The numeric stop-limits (max iterations, wall-clock cap, best-effort cost cap, no-progress detection,
done-streak confirmation, and the verifier-integrity guard that halts if a test file was modified) are
enforced by `scripts/loop.sh` in bash, OUTSIDE the interactive model. This is a runner safety limit on an
opt-in automated process — not a gate on your normal interactive session. Praxis never blocks your manual
work; it only bounds a loop you explicitly started. See `scripts/loop.sh --help` for every flag and default.
