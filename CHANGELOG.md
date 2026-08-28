# Changelog

All notable changes to Praxis are documented here. Format follows [Keep a Changelog](https://keepachangelog.com); versions follow [SemVer](https://semver.org).

## [Unreleased]

### Added
- **Skills reach the specialist as Level-1 pointers.** Agents declared `skills:` in frontmatter and nothing read it — the same defect class `od.craft.requires` had. `SubagentStart` now resolves it and injects name and description, never the body. Researched rather than settled by taste (`docs/context-delivery.md`): Anthropic publishes ~100 tokens per skill for Level-1 metadata against under 5k for a body, and measured here the bodies cost 4–7× to collapse two levels the host already separates. Tokens are the smaller half of the argument — unassisted the model matches a task against all 34 skills, while a specialist matches against the 1–5 its role declares, already filtered by domain. Crafts keep arriving in full: a craft always applies, a skill applies sometimes, and that is exactly the Level-1/Level-2 split.
- **A vacuous gate, fixed.** The craft-requirement test parsed `requires:` blocks with a loop that broke on the empty string `split("\n")` leaves before the first item, so it read zero requirements and passed unconditionally. Mutating a declared craft to a nonexistent name now fails the suite.
- **Intensity dial (`/praxis:mode fast | full | deep`).** Praxis re-judged "trivial or substantial" on every turn, so a typo fix could cost a Run Card and an architectural change could be waved through for having a small diff. That call now belongs to the person driving. The level is held in a flag file rather than in the conversation — parsed by the `UserPromptSubmit` hook, not by a Markdown command, because a rule the model reads is followed most of the time and a file the hook reads is applied every time. It travels into dispatched specialists, and it governs ceremony only: the crafts, the ladder, and the safety carve-outs are byte-identical at every level. The contract is filtered by tag (`<!-- only:fast -->`, `<!-- only:deep -->`, `<!-- only:orchestrator-full,orchestrator-deep -->`) from the same single file.
- **`platform` agent.** CI, containers, build tooling, and test infrastructure — the systems that ship the code rather than the code itself. The orchestrator had routed to it all along without the file existing. Claims `web-testing` and `test-coverage-plan`, two skills no agent previously declared.
- **Crafts reach Cursor.** Cursor cannot carry the per-turn or per-subagent layers through hooks — `beforeSubmitPrompt` and `subagentStart` return `user_message`, which is display-only and never reaches the model; only `sessionStart` carries `additional_context`. So the crafts ship there as generated rule files (`.cursor/rules/craft-*.mdc`, glob-scoped for the visual ones, always-apply for `minimalism` and `orchestration`), built by `scripts/build-cursor-crafts.mjs` with a CI staleness gate. Adding a craft without deciding its Cursor scope fails the build rather than shipping unscoped.
- **Per-turn and per-subagent injection.** Praxis primed only at `SessionStart`, so the method decayed as a session grew and never reached a dispatched specialist at all — subagents inherit no parent context, so every delegated "senior" ran Praxis-unaware. Two hooks close that: `UserPromptSubmit` restates a compact operating contract each turn (anti-drift), and `SubagentStart` carries it into each dispatched agent, scopeable via the `PRAXIS_SUBAGENT_MATCHER` regex (fails open on a bad regex, a missing `agent_type`, or a stalled payload). The contract lives in one file, `hooks/context/contract.md`, filtered per target: orchestrator-only sections (Run Card, delegation) are stripped for subagents, so a specialist is never told to dispatch specialists of its own.
- **CI, and the drift it immediately found.** Three zero-dependency gates (`tests/*.test.mjs`, run by `node --test` in GitHub Actions alongside the resource validator): referential integrity, hook behavior across host dialects, and load-bearing phrase invariants. Every gate is mutation-tested — a deliberate break must fail it — after the first traversal test turned out to pass vacuously. Writing them surfaced four real defects: the orchestrator routed to `platform` and `incident-responder` (neither exists), `orchestration` was missing from the AGENTS.md craft table, the Run Card `approach:` line named a nonexistent agent in two files, and the hooks' own `PLUGIN_ROOT` local shadowed Codex's host signal so every host resolved to the Codex dialect.
- **Craft resolution on dispatch.** Every agent already declared its disciplines under `od.craft.requires`, and nothing read that frontmatter — so "always-on crafts" was a claim, not a mechanism. `SubagentStart` now resolves the declaration and injects those craft bodies alongside the contract: `design` arrives with anti-slop + a11y-baseline + motion-discipline, `orchestrator` with orchestration + minimalism. An undeclared agent, a stock agent, or a missing payload still gets the contract. `agent_type` is confined to a bare filename so a host-supplied value cannot traverse out of `agents/`.
- **`hooks/lib.sh`.** Shared JSON escaping, host-dialect detection, memory recall, and contract filtering. Each hook previously hand-rolled its own escaping, so a fix in one never reached the others. Host detection also gained a Codex branch — Codex exposes `PLUGIN_ROOT`/`PLUGIN_DATA` and no `CLAUDE_PLUGIN_ROOT`, and was falling through to the flat Copilot shape, which Codex drops silently.
- **`agentic-lifecycle` skill.** A doctrinal umbrella for spec-driven, near-autonomous development (decision → verifiable contract → task files with status → auto-loop → review → done). It unifies `spec-lifecycle` (planning phases) and `autonomous-loop` (the ralph loop) and adds the eval-driven pillar plus a research base (`references/research-ai-native-lifecycle-2026.md`). Ships 5 artifact templates plus an auto-loop rulebook under `assets/` (decision record, plan, verifiable `spec.json` contract, task, progress ledger, auto-loop rulebook). Referenced by the `orchestrator` agent. Resource validator now skips `assets/` (as it already did `references/`).

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
