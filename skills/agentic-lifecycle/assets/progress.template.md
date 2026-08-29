# PROGRESS.md — <change name>

> The agent reads this + `git log` at the start of each iteration. Source of truth for state.
> Task line shape, phases and states: `docs/task-model.md`. Do not invent a variant here.

## Contract status

- Total items: N | passes=true: 0 | failing: N

## Tasks

- [ ] T01 · phase: build · state: pending · <what it does>
      files:  <paths>
      verify: <the command that proves it>
- [ ] T02 · phase: build · state: blocked(user) · <what it does>
      files:  <paths>
      verify: <the command that proves it>
      note:   <the decision being waited on, and who owns it>

## Log (most recent on top)

- YYYY-MM-DD HH:MM — T-012 → review — <what it did> — commit <sha>
- YYYY-MM-DD HH:MM — T-008 → done — <what it did> — commit <sha>

## Blocked

- T-002 · blocked(user) — <the decision, stated so a person can answer it without re-reading the code>
- T-005 · blocked(technical) — <what failed, how many attempts, what it needs>
