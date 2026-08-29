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

That's it. Skills activate by description; three lifecycle hooks prime the session, every turn, and every dispatched specialist.

---

## Why Praxis

Other tools give you process *or* components. Praxis is the part nobody else wires together:

- **Taste, enforced.** A design Ship Gate refuses Inter/Roboto, AI-purple gradients, and zero-a11y output — every web deliverable gets a font check, a Baseline table, and an a11y/motion pass, even when you don't ask.
- **It asks before it guesses.** A clarify gate stops on a vague prompt and asks the one question that changes the outcome — instead of building what *it* imagined.
- **It stops for your approval, and the stop survives.** When the shape of the work isn't clear, Praxis states a plan, marks the Run Card `Needs your decision`, and waits. The halt is written to the ledger as `blocked(user)`, so a session resumed after a context wipe still knows it is waiting on a person instead of deciding on your behalf. A file count never triggers this — being unsure what to build does.
- **A question gets an answer, not a process.** Ask *"how does routing work here?"* and you get the answer. The intensity dial scales ceremony, and a question has none to scale.
- **A visible loop, not a black box.** Substantial work runs out loud: classify → research-first → plan into bite-sized tasks → one subagent per task → verify. You see how it decides and delegates.
- **It learns per project.** `/praxis:learn` captures recurring lessons and conventions into `.praxis/memory/` (git-committable). The agent reads them every session — so it doesn't re-research the known, and your whole team stays consistent.
- **No enforcement.** Praxis *primes*, it never blocks. The hook injects context; nothing gates your actions. Trust comes from transparency and measurement, not guardrails.

The differentiation is measured, not claimed — see [`evals/`](evals/): five harnesses and ten write-ups, including an A/B that quantifies what the memory buys, a seeded-defect eval that found the refuter panel costs 3.65× for identical detection, and a $3 smoke that stopped an $18 run from producing an invalid answer. The negative results are published beside the positive ones.

---

## What's inside

| | Count | What |
|---|---|---|
| **skills** | 36 | The taste layer (frontend-design, anti-slop design systems, data-viz, baseline-status…), the process spine (agentic-lifecycle doctrine, writing-plans, subagent-driven-development, spec-lifecycle, strategy-compare…), the adversarial layer (decision-challenge, prose-tells), the vibe-coder UX (brainstorming clarify gate, scout, docs-seeker), and per-project memory (praxis-memory, learn-graduate, learn-prune). |
| **agents** | 11 | design · engineer · backend · platform · security · reviewer · researcher · orchestrator · the refuter panel (refuter-correctness · refuter-security · refuter-tests), dispatched in one wave on a finished change with fresh context and a mandate to refute. |
| **crafts** | 5 | Always-on taste disciplines: anti-slop · a11y-baseline · motion-discipline · minimalism · orchestration. An agent `requires` them and the `SubagentStart` hook injects them on dispatch. |
| **pipelines** | 4 | Named phase sequences rendered as inspectable Run Cards. |
| **commands** | 7 | `/praxis:design`, `/praxis:feature`, `/praxis:bug`, `/praxis:refactor`, `/praxis:loop`, `/praxis:learn`, `/praxis:mode`. |

## How it works

- **Descriptions are the router.** Skills activate on their `description` — the trigger surface a user actually types lives there.
- **Three injection points, not one.** `SessionStart` primes the `using-praxis` router (and this project's learned memory, if any). `UserPromptSubmit` restates a compact operating contract every turn, so the method survives a long session instead of drifting back to inline-everything defaults. `SubagentStart` carries that contract into every dispatched specialist, plus the crafts that agent declares under `od.craft.requires` and Level-1 pointers to the skills it declares under `skills:` — session context is parent-thread only, so without it a delegated agent runs Praxis-unaware. All three only inject context; nothing blocks.
- **Skills reach the specialist that needs them.** A dispatched agent receives name-and-description pointers to the skills its role declares — never the bodies, which cost 4–7× and collapse two levels the host already separates ([the measurement and the sources](docs/context-delivery.md)). The point is not only tokens: unassisted, the model matches a task against all 36 skills; a specialist matches against the 1–5 chosen for its role. [The activation audit](evals/2026-08-28-activation-audit.md) measured why that matters — real debugging, test-strategy and auth prompts where the matching skill never fired.
- **You set the intensity, not the model.** `/praxis:mode fast | full | deep` — `fast` drops the Run Card and the ledger for a rename or a one-file fix, `deep` adds mandatory research, explicit approach comparison, and an adversarial review pass. The level lives in a flag file, so it holds every turn instead of being re-judged, and it travels into dispatched specialists. It changes the ceremony only: the crafts, the ladder, and the safety carve-outs are identical at every level.
- **One task model, and the dial decides how much of it runs.** Every task carries a `phase:` and a `state:` in one ledger, `PROGRESS.md` ([the shape](docs/task-model.md)). `fast` runs `build → verify`; `full` adds `plan` and `review`; `deep` runs all six phases. A skipped phase is skipped, never faked. Before this there were four ledger names and four phase vocabularies across five skills, and work handed from one to the next arrived in a shape the receiver did not recognise.
- **Scope the subagent injection** with `PRAXIS_SUBAGENT_MATCHER`, an extended regex tested against the subagent's `agent_type` (unanchored, case-insensitive: `design|engineer` matches either, `^engineer$` is exact). Unset injects into every subagent. An invalid regex, a missing `agent_type`, or a stalled payload all fail open — scoping never silently drops the method.
- **Crafts are inherited taste.** `frontend-design` pulls `anti-slop` + `a11y-baseline` + `motion-discipline` and runs the Ship Gate before delivering.
- **Execution is explicit.** For multi-file builds, ask for a plan + a subagent per task (or `/praxis:loop`) — that's how it stays out of inline-everything context rot.
- **The instruments are audited too.** Praxis measures itself, and five times in two days the defect turned out to be in the measurement rather than in what it measured — a collision metric inflated by the very clauses meant to reduce it, a rank-1 blending two languages one of the instruments cannot read, two scorers wrong in one direction only. [Instrument discipline](docs/instrument-discipline.md) is the standing rule set: **before you fix what the number says, prove the number can be wrong.**

## Per-project memory (learning)

The agent accumulates knowledge per project in `.praxis/memory/` — plain Markdown, committable to your repo so the team shares it via git. No backend, no DB.

- **`/praxis:learn`** captures ONE recurring, reusable delta from a session — a fact/convention into `lessons.md`, or a recurring procedure as a `candidate` skill.
- **Retrieval guarantee:** the hook injects the project's memory index every session, so the agent *reads* what it learned (defeating the #1 memory failure: writing lessons it never reads back).
- **Three safeguards:** capture only on **recurrence** (seen ≥2×, never one-offs); a **probation** gate (`learn-graduate`) pressure-tests a learned skill before it's trusted; **prune** (`learn-prune`) keeps it from rotting.

Measured value ([`evals/2026-06-26-learning-ab.md`](evals/2026-06-26-learning-ab.md)): not "a smarter agent," but ~12× fewer tokens on known facts, reliability under load, and consistency on arbitrary project decisions the agent can't otherwise guess.

> A cross-project / team aggregation backend (Layer 2) is designed but not built — the per-project Markdown stands alone.

## The autonomous loop (opt-in)

`/praxis:loop` runs a build to completion on a fresh context per iteration, with all guardrails **outside the model** (max-iterations, wall-clock, no-progress detection, completion-signal threshold, and a verifier-integrity guard that halts if a test file is touched). The discipline (`autonomous-loop` skill) is the [ralph technique](https://ghuntley.com/ralph/), researched — not ported.

## Development

Zero dependencies — no package manager, no build step:

```bash
node scripts/validate-resources.mjs   # frontmatter contract for every resource
node --test tests/*.test.mjs          # references, hook behavior, invariants
```

Both run in CI on every push and pull request. Three gates, each mutation-tested
so it cannot pass vacuously:

- **references** — every specialist named in a routing table, Run Card, or `od.craft.requires` resolves to a real file on disk. This is what caught the orchestrator routing to `platform` and `incident-responder`, neither of which ever existed.
- **hooks** — each hook emits valid JSON in each host's dialect, the subagent variant strips orchestrator-only sections, crafts resolve per agent, and a host-supplied `agent_type` cannot traverse out of `agents/`. This caught a shadowed `PLUGIN_ROOT` that made every host look like Codex.
- **cursor** — the generated `.cursor/rules/craft-*.mdc` files match `crafts/` and every craft has an explicit Cursor scope.
- **invariants** — the load-bearing phrases survive in every priming surface and every craft. Byte-equality is wrong here (the Cursor adapter legitimately names Cursor's tools), so the gate asserts the *guarantee*, not the text: reword the Inter ban or drop a safety carve-out and it fails.

## Cross-platform

One shared skill set, thin per-host adapters — the same skills run on **Claude Code, Codex, Cursor, Gemini CLI, and Copilot**. Skills speak in *actions* ("dispatch a subagent", "invoke a skill"); each host's `skills/using-praxis/references/<host>-tools.md` resolves them to that host's real tools. Priming is per-host: lifecycle hooks on Claude/Codex (all three events) and Cursor/Copilot (SessionStart), a `GEMINI.md` `@import` on Gemini, and an always-apply `.cursor/rules/praxis.mdc` fallback. Per-project memory injects on every hooked host.

> **Cursor is structurally limited to one injection point.** Its `beforeSubmitPrompt` and
> `subagentStart` hooks return `user_message`, which is display-only text shown when a prompt is
> blocked or a subagent denied — it never reaches the model. Only `sessionStart` carries
> `additional_context`. So on Cursor the per-turn and per-craft layers ship as rule files instead:
> `.cursor/rules/praxis.mdc` (always-apply router) plus one generated `craft-*.mdc` per craft,
> glob-scoped for the visual ones. Regenerate with `node scripts/build-cursor-crafts.mjs`; CI fails
> if they drift from `crafts/`.

> Each adapter is wired; smoke-test it on your host (a vague prompt should prime + activate). Codex needs `multi_agent = true` in `~/.codex/config.toml` for subagent dispatch.

## License

MIT © Sebastian Guerra
