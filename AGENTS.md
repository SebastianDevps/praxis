# Praxis — Agent Source of Truth

Praxis is a portable, self-learning, clarity-first framework for authoring inspectable agent workflows.
It is a **kit**, not a bundle: authors define skills in Markdown, pipelines compose them, and the
framework learns from experience by authoring new skills. It runs on any host
(Claude Code, Codex, Cursor, Gemini, Copilot) through thin per-host adapters.

---

## Core Principles

- **Clarity over machinery.** Skills and guides carry only the non-obvious delta beyond what the
  model already knows. If the model knows it, cut it. ("Redundancy Mirror")
- **No enforcement.** No gates; nothing blocks an action. Trust comes from transparency and
  measurement, not guardrails. Three lifecycle hooks *prime* the run (see Activation) — they
  inject context only; they never block. Priming is orientation, not a gate.
- **Brevity as a constraint.** Terse beats thorough. Default to short; expand only when the task
  genuinely requires it.
- **Learning by authoring.** The framework grows by producing new skills from real experience — no
  separate learning engine.

---

## How It Works

### Discovery

Skills activate by their **`description`** — the host reads it and decides whether the skill
applies. That is the only field that drives activation, so the trigger surface (the words a user
actually types) must live INSIDE the description, phrased `Use when <triggers> — <what it does>`.
The `od:` taxonomy (mode · surface · category · craft) is organizational metadata for humans and
tooling; hosts do NOT route on it. Because description-matching alone is unreliable, a thin
**SessionStart router** (`using-praxis`) primes each session so the model reaches for the right
skill — see Activation.

### Pipelines → Run Cards

A pipeline is a sequence of phases. At runtime each pipeline renders as an inspectable **Run Card**:

| Field | What it holds |
|---|---|
| `phase` | one of `define · plan · build · verify · review · ship`, or `Needs your decision` when stopped and waiting on you |
| `approach` | `inline`, or `delegate → <specialist>` |
| `research` | what you actually checked before deciding |
| `verify` | the acceptance gate — how you will prove it is right |

The phase vocabulary is defined once in `docs/task-model.md`. A surface that renders a Run Card
with different fields than this is drift, and `tests/invariants.test.mjs` fails on it.

Run Cards are the primary transparency mechanism — not logs, not dashboards.

### Crafts

Crafts are always-on disciplines. An agent declares them under `od.craft.requires`, and the
`SubagentStart` hook resolves that declaration and injects the craft bodies when the agent is
dispatched. Skills go the other way: an agent declares them under `skills:` and the same hook injects
only name and description, because a craft always applies and a skill applies sometimes. That split
is progressive disclosure — see `docs/context-delivery.md` — inherited taste, delivered mechanically rather than hoped for. Still not enforcement:
the craft arrives as context, nothing gates the agent's actions. See `crafts/` for full definitions.

---

## Crafts (Always-On Taste Layer)

| Craft | Contract |
|---|---|
| `minimalism` | Laziest solution that works. YAGNI. No speculative abstractions. |
| `evidence-discipline` | The tells of a bar lowered to reach green. Mutate a new gate until it fails, then until it passes. |
| `anti-slop` | Avoid generic AI design fingerprints: boilerplate structure, hollow summaries, filler phrases. |
| `a11y-baseline` | Semantic HTML, keyboard nav, ARIA roles, contrast ≥ 4.5:1 where applicable. |
| `motion-discipline` | Motion serves meaning. Respect `prefers-reduced-motion`. No decorative animation. |
| `orchestration` | Delegate substantial work, fan out disjoint tasks, keep orchestrator context thin, render Run Cards. |

---

## Intensity

`fast | full | deep`, default `full`, set with `/praxis:mode` and held in a flag file so it holds
every turn rather than being re-judged. `fast` drops the Run Card and the ledger; `deep` adds
mandatory research, explicit approach comparison, and an adversarial review pass. The dial governs
ceremony only — crafts, the ladder, and the safety carve-outs are identical at every level. The
active level travels into dispatched specialists.

---

## Activation

Praxis only lands if the host actually reaches for it. Passive Markdown does not reliably activate:
description-matching alone fires roughly a third of the time, and a host's own always-on rules
(e.g. a global "read X before writing code") win the rest. So Praxis primes the session — the way
every world-class tool does (Cursor `alwaysApply`, Cline `.clinerules`, Copilot/Codex `AGENTS.md`,
first-party SessionStart hooks).

### A — Lifecycle hooks (default, Claude Code and Codex)

Three events, all pure context injection, all consistent with No Enforcement:

| Hook | Injects | Why |
|---|---|---|
| `session-start` | the thin `using-praxis` router + this project's learned memory | orientation, once |
| `user-prompt-submit` | the compact operating contract (`hooks/context/contract.md`) | anti-drift — a router read at turn 1 is buried by turn 40 |
| `subagent-start` | the contract + the dispatched agent's required crafts | session context is parent-thread only; without it a delegated agent runs Praxis-unaware |

Heavy content stays lazy-loaded. Scope the subagent injection with the `PRAXIS_SUBAGENT_MATCHER`
regex; it fails open on a bad pattern, a missing `agent_type`, or a stalled payload.

### B — Rule files (Cursor)

Cursor cannot receive the per-turn or per-subagent layers through hooks: `beforeSubmitPrompt` and
`subagentStart` return `user_message`, which is display-only text shown when a prompt is blocked or
a subagent denied — it never reaches the model. Only `sessionStart` carries `additional_context`.
On Cursor the rule files are therefore the mechanism: `.cursor/rules/praxis.mdc` (always-apply
router) plus one generated `craft-*.mdc` per craft. They are generated from `crafts/` by
`scripts/build-cursor-crafts.mjs` and CI fails when they drift.

### C — Portable fallback (any host)

The hooks run on Claude Code and Codex. On other hosts — or to force priming everywhere — add this line
to your always-on rules file (`~/.claude/CLAUDE.md`, `AGENTS.md`, `.cursorrules`, `.clinerules`):

> This environment uses Praxis. For substantial work, orchestrate via the `orchestrator` agent
> (Determine → Research → Delegate → Run Card → Verify → Synthesize). For UI/design/build, route
> through the `frontend-design` skill and its crafts. Skills activate by description — invoke the
> relevant one instead of working inline.

---

## Workflow

The lean spec lifecycle:

```
new → research → design → plan → implement
```

Supporting constructs:

- **DFU (Deferred Follow-Ups)** — out-of-scope ideas captured during a session; not lost, not
  acted on immediately.
- **Compound** — at session close, distill session knowledge into reusable skill deltas.
- **EAG (Executable Acceptance Gate)** — acceptance criteria expressed as runnable checks, not
  prose. The gate is green or red; not "should work."

Lifecycle files live under `skills/` (`agentic-lifecycle`, `spec-lifecycle`, `autonomous-loop`). Pointers only here.

---

## Learning (`/praxis:learn`)

**Layer 1 — per-project Markdown memory.** The agent LEARNS per project, accumulating knowledge in
`.praxis/memory/` inside the user's project (git-committable, so a team shares it via git). No separate
learning engine and no backend: the same agent runtime that executes skills also writes them.

- `/praxis:learn` captures ONE recurring, reusable delta from the session — a fact/correction appended
  to `lessons.md`, or a recurring procedure authored as a `candidate` skill under `.praxis/memory/skills/`.
- `praxis-memory` defines the store: `index.md` (tiny, always-loaded), `lessons.md` (detail), and
  learned `skills/<name>/SKILL.md`.
- `learn-graduate` is the probation gate — a candidate skill is pressure-tested before it is trusted
  (promoted `candidate → active`).
- `learn-prune` curates — demotes stale/unused entries, resolves contradictions, keeps the index small.

Three non-negotiables hold it together: **retrieval guarantee** (the index is the read path — never
write a lesson without indexing it), **recurrence** (capture only what was seen ≥2×, never one-offs),
and **probation** (a learned skill is `candidate` until graduated).

**Layer 2 — cross-project / team aggregation** (a shared backend that pools memory across projects) is
a FUTURE, optional add-on. It is NOT built; Layer 1 stands alone.

---

## Portability

- **`AGENTS.md`** (this file) is the host-agnostic source of truth. Every host reads it.
- **Host adapter files** (`CLAUDE.md`, `.cursorrules`, etc.) are thin shims — they import or
  reference this file; they do not duplicate it.
- **Learning is host-agnostic Markdown.** Per-project memory lives in `.praxis/memory/` as plain
  Markdown (see Learning) — any host that can read files participates; no MCP server required.

Adding a new host: write one adapter file that points here. No framework changes required.

---

## Verification

Praxis has no enforcement at runtime, but it does have gates at author time — the
claims in this file are tested, not asserted:

```bash
node scripts/validate-resources.mjs   # frontmatter contract
node --test tests/*.test.mjs          # references · hooks · invariants
```

A routing table that names a nonexistent agent, a craft that loses its
load-bearing rule, or a hook that stops emitting a host's dialect all fail CI.

---

## Output Conventions

These apply to every agent and skill in Praxis:

- Match the user's language. Do not switch unless the user does.
- Default to short answers. Expand only when the task genuinely requires it.
- One question at a time. Ask it, then stop.
- Evidence, not assurances: show `[command] → [output]`, not "this should work."
- No AI attribution in commits. Conventional commits only.
