---
name: bug
description: Structured bug-fix lifecycle — reproduce first, fix last.
kind: pipeline
phases:
  - reproduce
  - diagnose
  - fix
  - verify
od:
  triggers:
    - "bug"
    - "fix bug"
    - "broken"
    - "not working"
    - "error"
---

## Phases

- **reproduce** — `engineer` via `systematic-debugging`; writes the exact failing case before touching any code.
- **diagnose** — `engineer` via `systematic-debugging`; greps all callers of the suspect function and traces to root cause.
- **fix** — `engineer`; smallest change at the root callsite — not patching each symptom path individually.
- **verify** — `reviewer` + tests; original repro no longer fails and a regression test is added.

The orchestrator renders a **Run Card** per phase (phase · tools · artifacts · review gate · recovery · cost) — every run is inspectable.
