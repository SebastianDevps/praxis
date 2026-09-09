---
name: feature
description: Lean spec lifecycle for new features — from intent to working code.
kind: pipeline
phases:
  - new
  - research
  - design
  - plan
  - implement
od:
  triggers:
    - "new feature"
    - "add feature"
    - "build feature"
    - "implement feature"
---

## Phases

- **new** — orchestrator clarifies intent and acceptance criteria (EAG); out-of-scope items captured as DFUs.
- **research** — `researcher` + `scout` (internal recon) + `docs-seeker` (live API docs); research-first — no stale assumptions enter the design.
- **design** — `design` agent produces the technical approach; orchestrator invokes `strategy-compare` when two or more viable paths exist.
- **plan** — orchestrator breaks the design into ordered tasks with explicit dependencies.
- **implement** — `engineer` executes tasks, fanning out to `backend`, `design`, or `security` for disjoint domains; verifies against EAG before closing.

## Artifacts

Every phase writes into `specs/<change>/`. The mode decides which files are mandatory (`spec-lifecycle`); the task line format is `docs/task-model.md`.

| Phase | Writes |
|---|---|
| new | `design.md` — Problem Statement, User Stories, Scope; DFUs in `future-work.md` |
| research | `design.md` — findings that constrain the Technical Design |
| design | `design.md` — Technical Design, Acceptance; `decisions.md` — one ADR per weighed alternative |
| plan | `implementation.md` — the task list |
| implement | `implementation.md` — task `state:`, Completed with `[cmd] → [output]`, Blocked |

The orchestrator renders a **Run Card** per phase (spec · phase · approach · research · verify; their meaning is in `docs/task-model.md`) — every run is inspectable.
