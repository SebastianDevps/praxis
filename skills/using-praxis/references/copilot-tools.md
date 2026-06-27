# Copilot CLI Tool Mapping

Praxis skills speak in ACTIONS ("dispatch the `design` subagent", "invoke a skill", "read the reference", "scout the repo", "emit a Run Card"). On Copilot CLI those actions resolve to the tools below.

| Action a Praxis skill requests | Copilot CLI equivalent |
|--------------------------------|------------------------|
| Read a file / the reference | `view` |
| Create / edit / delete a file | `apply_patch` (Copilot CLI has no separate create/edit/write tools) |
| Run a shell command | `bash` |
| Search the repo (file contents) | `rg` (ripgrep; Copilot CLI does not expose a `grep` tool) |
| Find files by name | `glob` |
| Fetch a URL (`docs-seeker`, reference image) | `web_fetch` |
| Search the web | `web_search` |
| Invoke a skill (`frontend-design`, `brainstorming`, …) | `skill` |
| Dispatch a specialist subagent (`design`, `engineer`, `backend`, …) | `task` with `agent_type: "general-purpose"` (other accepted types: `explore`, `task`, `code-review`, `research`) |
| Fan out a parallel wave (2+ disjoint tasks) | Multiple `task` calls in one response |
| Read subagent status/output, control a subagent | `read_agent`, `list_agents`, `write_agent` |
| Create a Run Card / todo, mark a task complete | `update_todo` |

## Priming

Copilot CLI sets `COPILOT_CLI=1`. The Praxis `session-start` script detects this and emits the SDK-standard top-level `additionalContext` field, injecting the `using-praxis` router and `.praxis/memory/index.md`. Wire Copilot's SessionStart to `hooks/run-hook.cmd session-start` (it consumes the same script as Claude/Cursor — the script branches on `COPILOT_CLI`).

## Specialist subagents

Praxis specialists live in `agents/*.md`. Dispatch with `task` and `agent_type: "general-purpose"`, passing the specialist's role/instructions (from `agents/<name>.md`) plus the task as the prompt.

## Instructions file

When a skill mentions "your instructions file", on Copilot CLI this is **`AGENTS.md`** at the repository root (Praxis ships one). If both `AGENTS.md` and `.github/copilot-instructions.md` are present, Copilot reads both.

## Quirks

- File edits go through `apply_patch` only.
- No native `grep` — use `rg`.
- Crafts are always-on taste disciplines, honored by every output, never "invoked".
