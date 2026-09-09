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

## Artifacts

Every phase writes into `specs/<change>/`. The mode decides which files are mandatory (`spec-lifecycle`) — a `fast` bug has `implementation.md` only; the task line format is `docs/task-model.md`.

| Phase | Writes |
|---|---|
| reproduce | `implementation.md` — the failing case as the task's `verify:` line |
| diagnose | `implementation.md` — root cause in Session Notes; `design.md` Problem Statement at `full`/`deep` |
| fix | `implementation.md` — task `state:`, Completed with `[cmd] → [output]`; `decisions.md` if a fix path was rejected |
| verify | `implementation.md` — verify evidence: PASS · FAIL · SKIP · GAP |

The orchestrator renders a **Run Card** per phase (spec · phase · approach · research · verify; their meaning is in `docs/task-model.md`) — every run is inspectable.
