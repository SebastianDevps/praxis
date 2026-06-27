# Gemini CLI Tool Mapping

Praxis skills speak in ACTIONS ("dispatch the `design` subagent", "invoke a skill", "read the reference", "scout the repo", "emit a Run Card"). On Gemini CLI those actions resolve to the tools below.

| Action a Praxis skill requests | Gemini CLI equivalent |
|--------------------------------|----------------------|
| Read a file / the reference | `read_file` |
| Read several files at once | `read_many_files` |
| Create a new file | `write_file` |
| Edit a file | `replace` |
| Run a shell command | `run_shell_command` |
| Search the repo (file contents) | `grep_search` |
| Find files by name | `glob` |
| List a directory | `list_directory` |
| Fetch a URL (`docs-seeker`, reference image) | `web_fetch` |
| Search the web | `google_web_search` |
| Invoke a skill (`frontend-design`, `brainstorming`, …) | `activate_skill` |
| Dispatch a specialist subagent (`design`, `engineer`, `backend`, …) | `invoke_agent` with `agent_name: "generalist"` (also reachable via `@generalist <prompt>`) |
| Fan out a parallel wave (2+ disjoint tasks) | Multiple `invoke_agent` calls in one response |
| Create a Run Card / todo, mark a task complete | `write_todos` (statuses: pending, in_progress, completed, cancelled, blocked) |

## Priming — Gemini's ONLY priming path

Gemini CLI does **not** fire a SessionStart hook for this plugin, so there is no automatic injection. Priming happens through **`GEMINI.md`** at the plugin root, which `@import`s the router and this map:

```markdown
@./skills/using-praxis/SKILL.md
@./skills/using-praxis/references/gemini-tools.md
```

Per-project Praxis memory is NOT auto-injected here. If a project has `.praxis/memory/index.md`, read it explicitly at the start of substantial work (`read_file` on `.praxis/memory/index.md`) so you apply what the project has already learned.

## Specialist subagents

Praxis specialists live in `agents/*.md`. Gemini has no per-name registry for them; dispatch `invoke_agent` with `agent_name: "generalist"` and pass the specialist's role/instructions (from `agents/<name>.md`) plus the task as the prompt. Fill any prompt-template placeholders before dispatch — the template carries the agent's role and output contract.

## Instructions file

When a skill mentions "your instructions file", on Gemini CLI this is **`GEMINI.md`** (loaded hierarchically: `~/.gemini/GEMINI.md`, then workspace/ancestor files, then sub-directory files on demand).

## Quirks

- No hook fires — if `GEMINI.md` is not loaded, the model is not primed. Confirm it is present at the workspace root.
- Memory retrieval is manual (see Priming). This is the one host where the "read what you learned" guarantee is not automated.
- Crafts are always-on taste disciplines, honored by every output, never "invoked".
