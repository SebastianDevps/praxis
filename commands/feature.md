---
description: Run the feature cycle (spec → build → review → approve → ship) for new behaviour — one approval from you, a PR at the end.
---

# /praxis:feature — new behaviour through the cycle

Invoke the `factory` skill and open a change for the request the user typed. The skill carries
the cycle as the orchestrator runs it; `docs/cycle.md` carries the roles, the files and the hook
decisions. This same workflow also triggers from a natural-language prompt matching "new
feature", "add feature", or similar.

## The spec-writer's brief

Dispatch `spec-writer` with the request verbatim, then this:

- Kind: **feature** — behaviour the project does not have today.
- Acceptance: every line a runnable command with the output that means PASS; at least one
  exercises the new behaviour end to end through its public surface, not through internals.
- Scope Out: the adjacent behaviour this change must leave alone, named.

## Artifacts

`specs/<change>/` — `spec.md` (spec-writer; the person approves it), `implementation.md`
(orchestrator, the only writer), `review/round-N/<lens>.md` (one per lens), `decision.md`
(approver). Formats and hook rules: `docs/cycle.md`.

All workflow logic lives in the `factory` skill. This command is a thin trigger only.
