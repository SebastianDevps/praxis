---
description: Run the refactor cycle (spec → refactor → review → approve → ship) — behaviour-preserving, with the test count pinned before and after.
---

# /praxis:refactor — a behaviour-preserving change through the cycle

Invoke the `factory` skill and open a change for the restructuring the user asked for. The skill
carries the cycle; `docs/cycle.md` carries the roles, the files and the hook decisions. This same
workflow also triggers from a natural-language prompt matching "refactor", "restructure", "clean
up", or similar.

## The spec-writer's brief

Dispatch `spec-writer` with the request verbatim, then this:

- Kind: **refactor** — the shape changes, the behaviour does not. No new behaviour in Scope In;
  anything that would add one is a separate change.
- Acceptance includes **tests pass before and after with the same count**: `` `<test command>` ``
  → `N passed, 0 failed`, N recorded from a run on the base branch before the first edit, and the
  same N asserted on the refactored branch. A changed count is a changed behaviour or a deleted
  test, and either fails the line.
- Acceptance names the public surface that must not move (exports, routes, CLI flags, schema),
  with the command that proves it — a typecheck of the callers, a contract test, a snapshot.
- Approach names the seams and the order (expand → migrate → contract when the blast radius is
  wide; `docs/task-model.md`).

## Artifacts

`specs/<change>/` — `spec.md`, `implementation.md` (orchestrator only), `review/round-N/<lens>.md`,
`decision.md`. Formats and hook rules: `docs/cycle.md`.

All workflow logic lives in the `factory` skill. This command is a thin trigger only.
