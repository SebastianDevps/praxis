# Cursor Tool Mapping

Praxis skills speak in ACTIONS ("dispatch the `design` subagent", "invoke a skill", "read the reference", "scout the repo", "emit a Run Card"). On Cursor those actions resolve to the tools below.

| Action a Praxis skill requests | Cursor equivalent |
|--------------------------------|-------------------|
| Read a file / the reference | `view` |
| Create / edit a file | `apply_patch` (structured diff for create and update) |
| Run a shell command | `bash` |
| Search the repo (file contents) | `rg` (ripgrep) |
| Find files by name | `glob` |
| Fetch a URL (`docs-seeker`, reference image) | `web_fetch` |
| Search the web | `web_search` |
| Invoke a skill (`frontend-design`, `brainstorming`, …) | `skill` |
| Dispatch a specialist subagent (`design`, `engineer`, `backend`, …) | `task` with the matching `agent_type` (`general-purpose` when no specialist type exists) |
| Fan out a parallel wave (2+ disjoint tasks) | Multiple `task` calls in one response |
| Create a Run Card / todo, mark a task complete | `update_todo` |

## Priming

Cursor primes via `hooks/hooks-cursor.json` → `hooks/run-hook.cmd session-start`. The Praxis `session-start` script detects `CURSOR_PLUGIN_ROOT` and emits the Cursor dialect (`additional_context`, snake_case), injecting the `using-praxis` router and `.praxis/memory/index.md`.

If the SessionStart hook does not fire in your Cursor build, the plugin ships a fallback: `.cursor/rules/praxis.mdc` (`alwaysApply: true`) inlines a short version of the router so Praxis still orients the session.

## Specialist subagents

Praxis specialists live in `agents/*.md`. Dispatch them with `task`; if Cursor exposes no matching `agent_type`, use `general-purpose` and pass the specialist's role/instructions (from `agents/<name>.md`) plus the task as the prompt.

## Instructions file

When a skill mentions "your instructions file", on Cursor the project rules live under **`.cursor/rules/`** (`.mdc` files with `description` + `alwaysApply` frontmatter). Cursor also reads `AGENTS.md` at the repo root, which Praxis ships.

## Quirks

- The SessionStart hook is best-effort across Cursor builds; the `.cursor/rules/praxis.mdc` always-apply rule is the safety net.
- File edits go through `apply_patch` only — there is no separate write/edit tool.
- Crafts are always-on taste disciplines, honored by every output, never "invoked".
