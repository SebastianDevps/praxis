# Praxis

**A clarity-first agent framework for Claude Code.** Praxis primes a visible engineering process — research → clarify → plan → subagent-driven execution → verify — wires it to an enforced design Ship Gate so output never ships generic AI slop, and **learns per project** so the agent stops re-deriving what your codebase already decided.

Built for developers and vibe-coders building systems from scratch at scale (or shipping a new version of something running) who want senior-grade process **and** taste — without having to be a senior to get it.

**Cross-platform: Claude Code · Codex · Cursor · Gemini CLI · Copilot. Install in seconds.**

---

## Install

```
/plugin marketplace add SebastianDevps/praxis
/plugin install praxis@praxis
/reload-plugins
```

That's it. Skills activate by description; a SessionStart hook primes each session.

---

## Why Praxis

Other tools give you process *or* components. Praxis is the part nobody else wires together:

- **Taste, enforced.** A design Ship Gate refuses Inter/Roboto, AI-purple gradients, and zero-a11y output — every web deliverable gets a font check, a Baseline table, and an a11y/motion pass, even when you don't ask.
- **It asks before it guesses.** A clarify gate stops on a vague prompt and asks the one question that changes the outcome — instead of building what *it* imagined.
- **A visible loop, not a black box.** Substantial work runs out loud: classify → research-first → plan into bite-sized tasks → one subagent per task → verify. You see how it decides and delegates.
- **It learns per project.** `/praxis:learn` captures recurring lessons and conventions into `.praxis/memory/` (git-committable). The agent reads them every session — so it doesn't re-research the known, and your whole team stays consistent.
- **No enforcement.** Praxis *primes*, it never blocks. The hook injects context; nothing gates your actions. Trust comes from transparency and measurement, not guardrails.

The differentiation is measured, not claimed — see [`evals/`](evals/) (6 fixtures, including an A/B that quantifies what the memory actually buys).

---

## What's inside

| | Count | What |
|---|---|---|
| **skills** | 33 | The taste layer (frontend-design, anti-slop design systems, data-viz, baseline-status…), the process spine (writing-plans, subagent-driven-development, spec-lifecycle, strategy-compare…), the vibe-coder UX (brainstorming clarify gate, scout, docs-seeker), and per-project memory (praxis-memory, learn-graduate, learn-prune). |
| **agents** | 7 | design · engineer · backend · security · reviewer · researcher · orchestrator. |
| **crafts** | 5 | Always-on taste disciplines: anti-slop · a11y-baseline · motion-discipline · minimalism · orchestration. Any skill `requires` them. |
| **pipelines** | 4 | Named phase sequences rendered as inspectable Run Cards. |
| **commands** | 6 | `/praxis:design`, `/praxis:feature`, `/praxis:bug`, `/praxis:refactor`, `/praxis:loop`, `/praxis:learn`. |

## How it works

- **Descriptions are the router.** Skills activate on their `description` — the trigger surface a user actually types lives there.
- **The SessionStart hook** injects the `using-praxis` router (and this project's learned memory, if any) every session. It only injects context; it blocks nothing.
- **Crafts are inherited taste.** `frontend-design` pulls `anti-slop` + `a11y-baseline` + `motion-discipline` and runs the Ship Gate before delivering.
- **Execution is explicit.** For multi-file builds, ask for a plan + a subagent per task (or `/praxis:loop`) — that's how it stays out of inline-everything context rot.

## Per-project memory (learning)

The agent accumulates knowledge per project in `.praxis/memory/` — plain Markdown, committable to your repo so the team shares it via git. No backend, no DB.

- **`/praxis:learn`** captures ONE recurring, reusable delta from a session — a fact/convention into `lessons.md`, or a recurring procedure as a `candidate` skill.
- **Retrieval guarantee:** the hook injects the project's memory index every session, so the agent *reads* what it learned (defeating the #1 memory failure: writing lessons it never reads back).
- **Three safeguards:** capture only on **recurrence** (seen ≥2×, never one-offs); a **probation** gate (`learn-graduate`) pressure-tests a learned skill before it's trusted; **prune** (`learn-prune`) keeps it from rotting.

Measured value ([`evals/2026-06-26-learning-ab.md`](evals/2026-06-26-learning-ab.md)): not "a smarter agent," but ~12× fewer tokens on known facts, reliability under load, and consistency on arbitrary project decisions the agent can't otherwise guess.

> A cross-project / team aggregation backend (Layer 2) is designed but not built — the per-project Markdown stands alone.

## The autonomous loop (opt-in)

`/praxis:loop` runs a build to completion on a fresh context per iteration, with all guardrails **outside the model** (max-iterations, wall-clock, no-progress detection, completion-signal threshold, and a verifier-integrity guard that halts if a test file is touched). The discipline (`autonomous-loop` skill) is the [ralph technique](https://ghuntley.com/ralph/), researched — not ported.

## Cross-platform

One shared skill set, thin per-host adapters — the same skills run on **Claude Code, Codex, Cursor, Gemini CLI, and Copilot**. Skills speak in *actions* ("dispatch a subagent", "invoke a skill"); each host's `skills/using-praxis/references/<host>-tools.md` resolves them to that host's real tools. Priming is per-host: a SessionStart hook on Claude/Codex/Cursor/Copilot, a `GEMINI.md` `@import` on Gemini, and an always-apply `.cursor/rules/praxis.mdc` fallback. Per-project memory injects on every hooked host.

> Each adapter is wired; smoke-test it on your host (a vague prompt should prime + activate). Codex needs `multi_agent = true` in `~/.codex/config.toml` for subagent dispatch.

## License

MIT © Sebastian Guerra
