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

## Domain Language

`CONTEXT.md` at the root is the glossary; `specs/<change>/decisions.md` holds the ADRs. Before
exploring an area, read the glossary and the ADRs that touch it. If a referenced doc is missing,
proceed silently: do not flag its absence, do not propose creating it.

When output names a domain concept — a task title, a test name, a hypothesis, a proposal — use
the glossary term, never a synonym it lists under `Avoid`.

When output contradicts an ADR, say so instead of overriding it in silence:

> Contradicts ADR-NNN (<title>), but worth reopening because …

## Capabilities

Before writing new glue, check whether one of these already covers it. One row per module that
other code is meant to call; the smoke command proves it still works.

| Module | What it exports | Smoke |
|---|---|---|
| `{path/to/module}` | `{functionA}`, `{functionB}` — {one clause} | `{cmd}` |
| `{path/to/module}` | `{TypeA}`, `{helperB}` — {one clause} | `{cmd}` |

## Rules

`agents/rules/` — one file per rule, prefixed by section (`architecture-`, `quality-`, `data-`, …).
Index: `agents/README.md`. Claude Code loads them natively through `.claude/rules`.

## Don't

- Don't add behavior that is not in the change's `design.md`; capture it in `future-work.md`.
- Don't skip a task's `verify:` line.
- Don't commit secrets, API keys, or `.env` files.
- {Project-specific don'ts}

Domain Language and Capabilities adapted from `setup-matt-pocock-skills/domain.md` in
[mattpocock/skills](https://github.com/mattpocock/skills) and the `CLAUDE.md` in
[mattpocock/mise-en-place](https://github.com/mattpocock/mise-en-place).
