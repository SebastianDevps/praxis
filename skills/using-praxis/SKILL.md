---
name: using-praxis
description: Use when starting any non-trivial task — establishes how Praxis orchestrates work and routes to its skills, agents, and crafts.
kind: skill
od:
  triggers: ["using praxis", "how does praxis work"]
---

# Using Praxis

## On this platform

Praxis speaks in **actions**, not tool names: you *invoke a skill*, *dispatch a subagent*, *read a
file*, *search the repo*, *emit a Run Card / todo*. Each host wires those actions to its own tools —
see `references/<host>-tools.md` (`claude-code`, `codex`, `cursor`, `gemini`, `copilot`) for the exact
mapping and any host quirks. Always express intent as an action; let the reference resolve it.

This environment has **Praxis** — a clarity-first agent framework. Its value is HOW work runs:
visibly, in phases, with research and verification — not one silent inline blob. A vague prompt is
not a license to skip the method; it is exactly when the method matters most, because the model has
the least to go on.

## Classify first

- **Trivial** — one file, no new behavior, no design surface → just edit + verify. Skip the loop.
- **Substantial** — build / replicate / redesign / feature / debug / multi-file / unclear scope →
  run the visible loop below. When unsure, treat it as substantial.

## The visible loop (run it OUT LOUD for substantial work)

Each step is shown to the user, never implicit. This visibility IS the product.

1. **Determine** — restate the task and the plan in one or two lines.
2. **Research first** — look before building: read the reference/screenshot closely, `scout` the
   repo for prior art, `docs-seeker` for unfamiliar APIs. Never decide on stale assumptions.
3. **Clarify** — if anything material is still ambiguous after looking (scope, framework, data,
   key behavior), run `brainstorming`: ask the user ONE question at a time and STOP before building.
   Do not guess silently on substantial work — you would build what you imagined, not what they
   want. A faithful replica answers most of itself; ask only what the reference cannot tell you.
4. **Run Card** — BEFORE building, emit this block; update it at each phase:
   ```
   RUN CARD — <task>
   phase:    <current phase>
   approach: <inline | delegate → design / engineer / backend / security / platform / researcher>
   research: <what you checked>
   verify:   <the acceptance gate — how you will prove it is right>
   ```
5. **Plan, then delegate** — for substantial or multi-file work: first break it into bite-sized,
   independently-testable tasks in a ledger (`writing-plans`) — never a vague 4-bullet plan. Then
   execute task-by-task via `subagent-driven-development`: one implementer subagent per task, review
   between, progress in the ledger. **Do NOT write all the files inline in the main thread.** Two+
   disjoint tasks → fan out in one parallel wave. Trivial single-file work may stay inline. For an
   unattended iterate-until-done run, use `/praxis:loop` (`autonomous-loop` discipline, guardrails
   outside the model).
6. **Verify** — run the acceptance gate. For web output that is the `frontend-design` Ship Gate
   (font ≠ Inter, mandatory Baseline table, a11y, motion). Red → fix → re-verify. Never "should work."
7. **Synthesize** — state what changed and why; if a reusable pattern emerged, suggest `/learn`.

## Route by task

| Task | Specialist agent | Discipline skill |
|---|---|---|
| Build / replicate / redesign a UI, page, dashboard, landing, component | `design` | `frontend-design` |
| Charts, graphs, data viz | `design` | `data-visualization` |
| Review / audit / polish existing UI | `reviewer` | `design-review` |
| Code / logic | `engineer` | — |
| Bug or failing test | `engineer` | `systematic-debugging` |
| Approach unclear (2+ options) | — | `strategy-compare` (decide before building) |

## How activation works

Skills activate by their `description` — invoke the matching one rather than working from training
memory; it carries the non-obvious delta, which is the whole point of Praxis. **Crafts**
(`anti-slop`, `a11y-baseline`, `motion-discipline`, `minimalism`, `orchestration`) are always-on
taste disciplines every output honors, whether or not the user names them.
