# Codex Tool Mapping

Praxis skills speak in ACTIONS ("dispatch the `design` subagent", "invoke a skill", "read the reference", "scout the repo", "emit a Run Card"). On Codex those actions resolve to the tools below.

| Action a Praxis skill requests | Codex equivalent |
|--------------------------------|------------------|
| Read a file / the reference | `shell` (e.g., `cat`, `head`, `tail`) — Codex reads files via shell |
| Create / edit / delete a file | `apply_patch` (structured diff for create, update, delete) |
| Run a shell command | `shell` |
| Search the repo (file contents) | `shell` (e.g., `rg`, `grep`) |
| Find files by name | `shell` (e.g., `fd`, `find`, `ls`) |
| Fetch a URL (`docs-seeker`, reference image) | `shell` with `curl` / `wget` — Codex has no native fetch tool |
| Search the web | `web_search` (enabled by default; configurable in `config.toml` via the top-level `web_search` setting — `live`, `cached`, or `disabled`) |
| Invoke a skill (`frontend-design`, `brainstorming`, …) | Skills load natively — just follow the instructions |
| Dispatch a specialist subagent (`design`, `engineer`, `backend`, …) | `spawn_agent` (see [Subagent dispatch requires multi-agent support](#subagent-dispatch-requires-multi-agent-support)) |
| Fan out a parallel wave (2+ disjoint tasks) | Multiple `spawn_agent` calls in one response |
| Wait for a subagent result | `wait_agent` |
| Free up a subagent slot when done | `close_agent` |
| Create a Run Card / todo, mark a task complete | `update_plan` |

## Subagent dispatch requires multi-agent support

Praxis's orchestration (`subagent-driven-development`, `dispatching-parallel-agents`, the `orchestrator` agent) needs spawned subagents. Enable them in `~/.codex/config.toml`:

```toml
[features]
multi_agent = true
```

This enables `spawn_agent`, `wait_agent`, and `close_agent`. Without it, Codex cannot fan out a wave — fall back to running tasks sequentially in the main thread, which loses Praxis's context-isolation benefit.

Legacy note: Codex builds before `rust-v0.115.0` exposed spawned-agent waiting as `wait`. Current Codex uses `wait_agent`; the bare `wait` now belongs to code-mode `exec/wait` and is not the spawned-agent result tool.

## Specialist subagents

Praxis specialists live in `agents/*.md`. On Codex there is no per-name agent registry like Claude's `subagent_type`; dispatch a generic `spawn_agent` and pass the specialist's role/instructions (read the matching `agents/<name>.md`) as the spawned agent's prompt, plus the task.

## Instructions file

When a skill mentions "your instructions file", on Codex this is **`AGENTS.md`** at the project root (Praxis ships one). Codex also reads `~/.codex/AGENTS.md`; an `AGENTS.override.md` takes precedence when present. Codex concatenates `AGENTS.md` files from project root down to the cwd, up to `project_doc_max_bytes` (32 KiB default).

## Priming

Codex primes via `hooks/hooks-codex.json` → `hooks/run-hook.cmd session-start-codex`, which injects the `using-praxis` router and `.praxis/memory/index.md` as `hookSpecificOutput.additionalContext` (the same nested dialect Claude consumes).

## Quirks

- Codex reads files through `shell`, so prefer `rg`/`fd` if available, otherwise `grep`/`find`.
- File edits go through `apply_patch` only — there is no separate write/edit tool.
- Crafts are always-on taste disciplines, honored by every output, never "invoked".
