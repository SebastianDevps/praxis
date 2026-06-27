# Claude Code Tool Mapping

Praxis skills speak in ACTIONS ("dispatch the `design` subagent", "invoke a skill", "read the reference", "scout the repo", "emit a Run Card"). On Claude Code those actions resolve to the tools below. Speak in actions; this table is the only place tool names live.

## Tools

| Action a Praxis skill requests | Claude Code tool |
|--------------------------------|------------------|
| Read a file / the reference | `Read` |
| Create a new file | `Write` |
| Edit a file | `Edit` |
| Run a shell command | `Bash` |
| Search the repo (file contents) | `Grep` |
| Find files by name | `Glob` |
| Fetch a URL (`docs-seeker`, reference image) | `WebFetch` |
| Search the web | `WebSearch` |
| Invoke a skill (`frontend-design`, `brainstorming`, `systematic-debugging`, …) | `Skill` |
| Dispatch a specialist subagent (`design`, `engineer`, `backend`, `security`, `reviewer`, `researcher`, `orchestrator`) | `Agent` with the matching `subagent_type` (older releases named this `Task`) |
| Fan out a parallel wave (2+ disjoint tasks) | Multiple `Agent` calls in one response |
| Create a Run Card / todo, mark a task complete | `TaskCreate`, `TaskUpdate`, `TaskList`, `TaskGet` (`TodoWrite` in `claude -p` / Agent SDK unless `CLAUDE_CODE_ENABLE_TASKS=1`) |
| Read subagent output / cancel a running task | `TaskOutput`, `TaskStop` |

## Specialist subagents

Praxis ships its specialists as plugin agents (`agents/*.md`). On Claude Code they are dispatched by name through the `Agent` tool's `subagent_type` (e.g. `design`, `engineer`, `backend`, `security`, `reviewer`, `researcher`, `orchestrator`). The orchestrator dispatches; it does not implement.

## Instructions file

When a skill mentions "your instructions file", on Claude Code this is **`CLAUDE.md`** (walked up the directory tree and concatenated). Praxis also ships `AGENTS.md`; Claude Code does not read `AGENTS.md` directly — import it from `CLAUDE.md` with `@AGENTS.md` if you want both runtimes to share instructions.

## Priming

Claude Code primes each session via the `SessionStart` hook (`hooks/hooks.json` → `hooks/session-start`), which injects the `using-praxis` router and, if present, `.praxis/memory/index.md`. No manual step needed.

## Quirks

- Claude Code reads BOTH `additional_context` and `hookSpecificOutput.additionalContext`; the Praxis hook emits only the nested field for this host to avoid duplicate injection.
- Crafts (`anti-slop`, `a11y-baseline`, `motion-discipline`, `minimalism`, `orchestration`) are always-on taste disciplines — they are not invoked, they are honored by every output.
