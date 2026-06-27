# Changelog

All notable changes to Praxis are documented here. Format follows [Keep a Changelog](https://keepachangelog.com); versions follow [SemVer](https://semver.org).

## [0.3.0] — 2026-06-27

### Added
- **Cross-platform.** Praxis now runs on **Codex, Cursor, Gemini CLI, and Copilot** in addition to Claude Code — one shared Markdown body, thin per-host adapters (the superpowers pattern). Added per-host manifests (`.codex-plugin/`, `.cursor-plugin/`), per-host hook configs (`hooks-codex.json`, `hooks-cursor.json`, a Codex-dialect `session-start-codex`, and a polyglot `run-hook.cmd` for Windows), a `GEMINI.md` bootstrap (Gemini primes via `@import`, no hook), a `.cursor/rules/praxis.mdc` always-apply fallback, and per-host action→tool maps under `skills/using-praxis/references/`. Skills speak in **actions** ("dispatch a subagent", "invoke a skill"); each host's reference resolves them to its real tools.
- Per-project memory injection works on every hooked host (Claude/Codex/Cursor/Copilot); on Gemini the memory is read via the documented path.

### Notes
- Per-host adapters are **wired; prove each with a smoke test** (vague prompt → does it prime + activate?) before trusting it on that host. Codex needs `multi_agent = true` in `~/.codex/config.toml` for subagent dispatch.

## [0.2.0] — 2026-06-26

### Added
- **Per-project learning (Layer 1).** The agent accumulates knowledge per project in `.praxis/memory/` (git-committable — teams share via git, no infra). `/praxis:learn` captures a *recurring* reusable delta (never one-offs) as a lesson or a `candidate` skill; `learn-graduate` pressure-tests a candidate before trusting it; `learn-prune` curates. The SessionStart hook injects the project's memory index every session — a **retrieval guarantee** that defeats write-only memory. Research-grounded (`hermes-agent`'s documented GEPA gate + the practitioner consensus that version-controlled Markdown beats memory tools).

### Changed
- **Dropped the build tooling.** Removed pnpm/TypeScript (`packages/`, workspace, lockfile, tsconfig, `package.json`); the resource validator is now a zero-dependency Node script.
- **AGENTS.md honesty.** Replaced the `/learn` + "Praxis MCP server" claims (which were never built) with the real per-project memory design; the cross-project/team backend is documented as a future, optional Layer 2.

## [0.1.0] — 2026-06-26

First public release.

### Added
- **Taste layer** — `frontend-design` hub + a design Ship Gate (font check, mandatory Baseline table, a11y/motion), the `anti-slop` / `a11y-baseline` / `motion-discipline` crafts, and opinionated design systems (swiss, brutalist, clean, bento).
- **Vibe-coder UX** — `using-praxis` SessionStart router (primes, never blocks) and a `brainstorming` clarify gate that asks one material question before building.
- **Process spine** — `writing-plans`, `subagent-driven-development`, `spec-lifecycle`, `strategy-compare`, plus design/feature pipelines rendered as Run Cards.
- **Autonomous loop** — `autonomous-loop` skill + `/praxis:loop` command with guardrails enforced outside the model (max-iterations, wall-clock, no-progress detection, completion-signal threshold, verifier-integrity guard).
- **Activation** — skill descriptions use the `Use when …` convention so the host routes on them; portable fallback documented in `AGENTS.md`.
- **Eval suite** — 5 measured fixtures proving the moat (replica fidelity, autonomous activation, from-scratch taste, vibe-coder clarify, and a live end-to-end build).

### Notes
- No enforcement: Praxis primes the session and puts loop limits in a runner; it never gates your actions.
- 30 skills · 7 agents · 5 crafts · 4 pipelines · 5 commands.
