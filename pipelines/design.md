---
name: design
description: Design lifecycle — from brief to reviewed implementation.
kind: pipeline
phases:
  - brief
  - explore
  - implement
  - review
od:
  triggers:
    - "design"
    - "ui design"
    - "design feature"
    - "design component"
---

## Phases

- **brief** — `design` agent with `creative-director` direction; defines the design problem, constraints, and success criteria.
- **explore** — `design` + `scout`; surfaces references and prior art before committing to a direction. *(research-first — runs before any implementation)*
- **implement** — `design`/`engineer` for frontend; applies `anti-slop` craft and `baseline-status` skill.
- **review** — `design-review` skill via `reviewer`; checks brief compliance, `a11y-baseline`, `motion-discipline`, and `anti-slop` craft criteria.

## Artifacts

Every phase writes into `specs/<change>/`. The mode decides which files are mandatory (`spec-lifecycle`); the task line format is `docs/task-model.md`.

| Phase | Writes |
|---|---|
| brief | `design.md` — Problem Statement, User Stories, Scope, success criteria as Acceptance |
| explore | `design.md` — references and the chosen direction in Technical Design; `decisions.md` — one ADR per direction rejected |
| implement | `implementation.md` — task `state:`, Completed with `[cmd] → [output]`, Blocked |
| review | `implementation.md` — verify evidence; `decisions.md` when a finding changes a decision |

The orchestrator renders a **Run Card** per phase (spec · phase · approach · research · verify; their meaning is in `docs/task-model.md`) — every run is inspectable.
