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
- **refactor** — `engineer`; executes steps incrementally, running tests between each to confirm no regression.
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
