---
description: Run the bug cycle (reproduce → spec → fix → review → approve → ship) — the repro is the first Acceptance line, red before any fix.
---

# /praxis:bug — a bug through the cycle, reproduced first

Invoke the `factory` skill and open a change for the bug the user described. The skill carries
the cycle; `docs/cycle.md` carries the roles, the files and the hook decisions. This same
workflow also triggers from a natural-language prompt matching "bug", "fix bug", "not working",
or similar.

## Reproduce before anything else

No spec, no fix, no theory before a command goes red on **this** bug (`systematic-debugging`).
The spec-writer's first job is that command; if it cannot build one, the spec's Open questions
say what access or artifact it needs, and the cycle stops there.

## The spec-writer's brief

Dispatch `spec-writer` with the report verbatim, then this:

- Kind: **bug** — behaviour the project has and should not.
- Acceptance MUST contain the failing test command, with the red output it gives today and the
  green output that means fixed: `` `<test command>` `` → `exit 0, N passed` (today: `1 failed —
  <assertion>`). The builder runs it red first, then writes the fix.
- Acceptance also names the regression test the builder adds at the seam where the bug lives,
  and the full suite command that must stay green.
- Scope Out: which nearby bug this is **not**, so a fix for the wrong one is caught by the lenses.

## Artifacts

`specs/<change>/` — `spec.md`, `implementation.md` (orchestrator only), `review/round-N/<lens>.md`,
`decision.md`. The deliverable is the PR: the repro as a test that was red and is green, the fix,
and why the bug escaped, in the commit message. Formats and hook rules: `docs/cycle.md`.

All workflow logic lives in the `factory` skill. This command is a thin trigger only.
