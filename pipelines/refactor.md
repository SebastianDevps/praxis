---
name: refactor
description: Safe refactor lifecycle — assess before touching, verify after.
kind: pipeline
phases:
  - assess
  - plan
  - refactor
  - verify
od:
  triggers:
    - "refactor"
    - "restructure"
    - "clean up"
    - "improve code"
---

## Phases

- **assess** — `researcher`/`reviewer`; maps the full scope and identifies the smell, coupling, or pattern gap driving the change.
- **plan** — orchestrator defines ordered, behavior-preserving steps, each small enough to keep tests green.
- **refactor** — `engineer`; each step small enough that the program always works, with tests green and a commit between steps — and what to refactor comes from the `reviewer`'s Standards findings (ADR-003 in `specs/mattpocock-imports/decisions.md`: refactor is a review finding, applied as its own task).
- **verify** — `reviewer` + tests; confirms behavior is unchanged and coverage has not decreased.

## Artifacts

Every phase writes into `specs/<change>/`. The mode decides which files are mandatory (`spec-lifecycle`); the task line format is `docs/task-model.md`.

| Phase | Writes |
|---|---|
| assess | `design.md` — Problem Statement (the smell or coupling), Scope |
| plan | `design.md` — Technical Design, the ordered behavior-preserving steps; `implementation.md` — the task list; `decisions.md` if an approach was rejected |
| refactor | `implementation.md` — task `state:`, Completed with `[cmd] → [output]`, Blocked |
| verify | `implementation.md` — verify evidence: PASS · FAIL · SKIP · GAP |

The orchestrator renders a **Run Card** per phase (spec · phase · approach · research · verify; their meaning is in `docs/task-model.md`) — every run is inspectable.

> The step size is Fowler's ("make each refactoring step as small as possible, so that you can always see the program working"), via `request-refactor-plan` in mattpocock/ralph-workshop.
