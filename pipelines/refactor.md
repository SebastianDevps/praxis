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

The orchestrator renders a **Run Card** per phase (phase · tools · artifacts · review gate · recovery · cost) — every run is inspectable.
