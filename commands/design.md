---
description: Run the design cycle (spec → build → review → approve → ship) for a UI change — the ui lens always joins the review round.
---

# /praxis:design — a UI change through the cycle

Invoke the `factory` skill and open a change for the interface work the user asked for. The skill
carries the cycle; `docs/cycle.md` carries the roles, the files and the hook decisions. This same
workflow also triggers from a natural-language prompt matching "design", "ui design", "design
component", or similar.

## The ui lens is not optional here

In other kinds `lens-ui` joins a round only when the diff touches UI paths. For this kind the
request itself is the UI, so the orchestrator writes `ui` into the ledger's `lenses:` and into
every `review/round-N/lenses` from round 1, whatever paths the diff ends up touching. The
barrier then waits for `review/round-N/ui.md` like any other lens file.

## The spec-writer's brief

Dispatch `spec-writer` with the request verbatim, then this:

- Kind: **design** — a visual or interaction change people will see.
- Acceptance includes the accessibility check as a command (`a11y-baseline`: axe or the project's
  equivalent) → `0 violations`, and a visual check the approver can run — a screenshot
  comparison, a Storybook or Playwright target, or the dev server URL plus what to look at.
- Approach names the design system or brand tokens in the repo that the change must use, and
  the component boundary (`frontend-design`, `design-review` for the lens).
- Scope Out: the surfaces that must look the same afterwards.

## Artifacts

`specs/<change>/` — `spec.md`, `implementation.md` (orchestrator only), `review/round-N/<lens>.md`
including `ui.md`, `decision.md`. Formats and hook rules: `docs/cycle.md`.

All workflow logic lives in the `factory` skill. This command is a thin trigger only.
