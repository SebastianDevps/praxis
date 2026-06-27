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

The orchestrator renders a **Run Card** per phase (phase · tools · artifacts · review gate · recovery · cost) — every run is inspectable.
