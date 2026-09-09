---
description: Scaffold the project side of the spec-driven workflow — AGENTS.md, agents/rules, knowledge base, commands, spec templates. Creates only what is missing; never overwrites.
---

# /praxis:init — project scaffold

Run the scaffold in the user's project directory:

```
bash "${CLAUDE_PLUGIN_ROOT}/scripts/init.sh"
```

`CLAUDE_PLUGIN_ROOT` is Claude Code's name for the installed plugin directory. Codex exports it
as `PLUGIN_ROOT`, Cursor as `CURSOR_PLUGIN_ROOT`; on Gemini and Copilot use the path the plugin
was installed to — the same resolution `hooks/lib.sh` performs. The script locates the plugin
from its own path, so any absolute path to it works, as does `bash scripts/init.sh` from the
plugin root the way `/praxis:loop` runs `scripts/loop.sh`.

It prints one line per entry, `create` or `keep`, and touches nothing that already exists.
A second run prints only `keep`. What it creates and why: `specs/spec-driven-workflow/design.md`
§5 and ADR-005 in `decisions.md`.

## Then fill what the script cannot know

The scaffold is skeleton; the facts come from the repo, not from memory.

1. Read the created `AGENTS.md`. Write **Project Context** from the README, the package
   manifest and the top-level layout — one paragraph.
2. `agents/commands.md` — the real build, test, lint and dev commands from `package.json`
   scripts, `Makefile`, `justfile`, `pyproject.toml`, `Cargo.toml`, or the CI workflow.
   Only commands that exist; run each once and keep the ones that work. Delete empty sections.
3. `agents/knowledge-base.md` — domain facts the code does not state: what the main entities
   are, where the schema lives, which files are generated, how local development is seeded.
4. If `.claude/rules` already existed as a real directory, it was left alone: say so, and
   offer to move its files into `agents/rules/` so there is one source.

Do not invent rules. `agents/rules/` starts with `_sections.md` and `_template.md` only; a rule
file is written when the codebase evidences the practice, prefixed by its section.
