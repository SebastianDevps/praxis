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
  measurement, not guardrails. One SessionStart hook *primes* the session (see Activation) — it
  injects context only; it never blocks. Priming is orientation, not a gate.
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
| `phase` | current step name |
| `tools` | tools available in this phase |
| `artifacts` | inputs and outputs |
| `review_gate` | human-review checkpoint (if any) |
| `recovery` | what to do if the phase fails |
| `cost` | estimated token / API cost |

Run Cards are the primary transparency mechanism — not logs, not dashboards.

### Crafts

Crafts are always-on disciplines. Any skill or agent can declare `requires: [craft]` to opt in.
They are not enforced; they are inherited taste. See `crafts/` for full definitions.

---

## Crafts (Always-On Taste Layer)

| Craft | Contract |
|---|---|
| `minimalism` | Laziest solution that works. YAGNI. No speculative abstractions. |
| `anti-slop` | Avoid generic AI design fingerprints: boilerplate structure, hollow summaries, filler phrases. |
| `a11y-baseline` | Semantic HTML, keyboard nav, ARIA roles, contrast ≥ 4.5:1 where applicable. |
| `motion-discipline` | Motion serves meaning. Respect `prefers-reduced-motion`. No decorative animation. |

---

## Activation

Praxis only lands if the host actually reaches for it. Passive Markdown does not reliably activate:
description-matching alone fires roughly a third of the time, and a host's own always-on rules
(e.g. a global "read X before writing code") win the rest. So Praxis primes the session — the way
every world-class tool does (Cursor `alwaysApply`, Cline `.clinerules`, Copilot/Codex `AGENTS.md`,
first-party SessionStart hooks).

### A — SessionStart router (default, Claude Code)

`hooks/session-start` injects the thin `using-praxis` router at session start. It **primes, never
blocks** — pure context injection, fully consistent with No Enforcement. Heavy content stays
lazy-loaded; the router only points the model at the right skill, agent, or craft.

### C — Portable fallback (any host)

The hook runs only in Claude Code. On other hosts — or to force priming everywhere — add this line
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

Lifecycle files live under `skills/workflow/`. Pointers only here.

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

## Output Conventions

These apply to every agent and skill in Praxis:

- Match the user's language. Do not switch unless the user does.
- Default to short answers. Expand only when the task genuinely requires it.
- One question at a time. Ask it, then stop.
- Evidence, not assurances: show `[command] → [output]`, not "this should work."
- No AI attribution in commits. Conventional commits only.
