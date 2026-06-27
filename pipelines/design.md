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

The orchestrator renders a **Run Card** per phase (phase · tools · artifacts · review gate · recovery · cost) — every run is inspectable.
