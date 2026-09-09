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

- **reproduce** — `engineer` via `systematic-debugging`; builds the one command that goes red on this bug and shows it red before any theory.
- **diagnose** — `engineer` via `systematic-debugging`; ranked hypotheses, one variable per probe, traces to root cause.
- **fix** — `engineer`; regression test at a correct seam first, then the smallest change at the root callsite — not patching each symptom path individually.
- **verify** — `reviewer` + tests; the original repro no longer fails, instrumentation is gone, and the report below is complete.

The method is the skill's; nothing here restates it.

## Output contract — the report

The pipeline's deliverable is the bug report a senior engineer would write, in `implementation.md` Session Notes and in the PR body when one is opened. Every item is present or marked GAP; a missing item is not a shorter report, it is an unfinished one.

- **Title is the thesis** — what is wrong, in one sentence, so a reader who stops there has the finding.
- **Deterministic repro** — one command, no credentials; secrets replaced with `<REDACTED>`, credentials read from the environment rather than shown.
- **Exact location** — file and lines, the offending code quoted.
- **Expected vs actual** — a table with concrete values, not adjectives.
- **Why it escaped** — what made it invisible to the existing checks (the single-step case is numerically identical; the happy path never hits the branch).
- **Which bug it is NOT** — the nearby, lookalike, or already-fixed issue, named, so the reader does not close this as a duplicate.
- **Exit code as the assertion** — the repro exits 1 while the bug exists and 0 once fixed; the regression test is that command at a correct seam, or the note that no correct seam exists.

## Artifacts

Every phase writes into `specs/<change>/`. The mode decides which files are mandatory (`spec-lifecycle`) — a `fast` bug has `implementation.md` only; the task line format is `docs/task-model.md`.

| Phase | Writes |
|---|---|
| reproduce | `implementation.md` — the red command as the task's `verify:` line, with its red output |
| diagnose | `implementation.md` — ranked hypotheses and root cause in Session Notes; `design.md` Problem Statement at `full`/`deep` |
| fix | `implementation.md` — task `state:`, Completed with `[cmd] → [output]`; `decisions.md` if a fix path was rejected |
| verify | `implementation.md` — verify evidence: PASS · FAIL · SKIP · GAP; the report above in Session Notes |

The orchestrator renders a **Run Card** per phase (spec · phase · approach · research · verify; their meaning is in `docs/task-model.md`) — every run is inspectable.

> Adapted from [mattpocock/skills](https://github.com/mattpocock/skills) diagnosing-bugs (the
> phase gates) and [harness-claude-code-usage-repro](https://github.com/mattpocock/harness-claude-code-usage-repro)
> (the report shape).
