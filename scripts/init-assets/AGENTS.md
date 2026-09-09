# {Project Name} — instructions for agents

Host-agnostic. `CLAUDE.md` is a symlink to this file; other hosts read it directly.

## Project Context

{One paragraph: what this project is, the stack, where the code lives. Fill it from the repo —
README, package manifest, top-level layout — not from memory.}

## Before Starting Work

1. Read `specs/<change>/design.md` — the source of truth for the change you are on.
   `specs/_templates/` is the shape of a new one.
2. Read `specs/<change>/implementation.md` — stage, tasks, what is done, what is blocked.
   On resume, read it first.
3. Look at existing patterns before adding a new one.

## Commands

See `agents/commands.md` — build, test, lint and dev commands. Use those; do not guess flags.

## Knowledge

See `agents/knowledge-base.md` — domain facts and product rules, not code style.

## Rules

`agents/rules/` — one file per rule, prefixed by section (`architecture-`, `quality-`, `data-`, …).
Index: `agents/README.md`. Claude Code loads them natively through `.claude/rules`.

## Don't

- Don't add behavior that is not in the change's `design.md`; capture it in `future-work.md`.
- Don't skip a task's `verify:` line.
- Don't commit secrets, API keys, or `.env` files.
- {Project-specific don'ts}
