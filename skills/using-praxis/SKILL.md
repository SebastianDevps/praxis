---
name: using-praxis
description: Use when starting any non-trivial task — establishes how Praxis orchestrates work and routes to its skills, agents, and crafts. NOT any single discipline — this is the router that dispatches to them.
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

**Kernel and router.** The operating contract (`hooks/context/contract.md`) is injected on every
turn and into every dispatched subagent; this file loads only when the skill activates, which a
dispatched subagent may never do. So the kernel carries what must hold at turn 40 and inside every
subagent, this file carries what needs explaining once, and where both need a rule the kernel owns
it and this file points at it.

## Classify first

- **Answer** — a question, with no request to change files → answer it. Research only what you do
  not already know. There is no ceremony to scale, so no dial applies.
- **Trivial** — one file, no new behavior, no design surface → just edit + verify. Skip the loop.
- **Substantial** — build / replicate / redesign / feature / debug / multi-file / unclear scope →
  run the visible loop below. Unresolved ambiguity escalates to step 3, never to more process:
  guessing bigger is not the same as knowing more.

## The visible loop (run it OUT LOUD for substantial work)

Each step is shown to the user, never implicit. This visibility IS the product. The `/praxis:mode`
dial governs how much of it appears: in `fast` mode the Run Card and the ledger are dropped — the
ceremony, never the crafts, the research, or the verification.

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
   phase:    <define | plan | build | verify | review | ship — `Needs your decision` when stopped and waiting on you>
   approach: <inline | delegate → design / engineer / backend / security / platform / researcher>
   research: <what you checked>
   verify:   <the acceptance gate — how you will prove it is right>
   ```
   Phases, task states, and the ledger's shape are defined once in `docs/task-model.md` — read it
   there rather than inventing a vocabulary here.
5. **Delegate; add a ledger only for a plan you accepted** — **do NOT write all the files inline in
   the main thread**, and two+ disjoint tasks fan out in one parallel wave. Work whose shape is
   already clear goes straight to delegation, however many files. Work whose shape is NOT clear
   gets the plan first: state it, set the Run Card phase to `Needs your decision`, and STOP. Once
   the user accepts, break it into bite-sized independently-testable tasks in a ledger
   (`writing-plans`) — never a vague 4-bullet plan — and execute task-by-task via
   `subagent-driven-development`: one implementer subagent per task, review between, progress in
   the ledger. A file count is not an acceptance; a ledger nobody agreed to is ceremony charged to
   the wrong person. For an unattended iterate-until-done run, use `/praxis:loop`
   (`autonomous-loop` discipline, guardrails outside the model).
6. **Verify** — run the acceptance gate. For web output that is the `frontend-design` Ship Gate
   (font ≠ Inter, mandatory Baseline table, a11y, motion). Red → fix → re-verify. Never "should work."
   A check that ran and had nothing to fail on is a GAP, not a PASS — the kernel carries the four
   result states and the words to report them in.
7. **Synthesize** — state what changed and why; if a reusable pattern emerged, suggest `/learn`.
   This step is the orchestrator's alone: a subagent reports its result and never proposes `/learn`,
   which is why the kernel does not carry it.

## Route by task

| Task | Specialist agent | Discipline skill |
|---|---|---|
| Build / replicate / redesign a UI, page, dashboard, landing, component | `design` | `frontend-design` |
| Charts, graphs, data viz | `design` | `data-visualization` |
| Review / audit / polish existing UI | `reviewer` | `design-review` |
| Code / logic | `engineer` | — |
| Bug or failing test | `engineer` | `systematic-debugging` |
| Approach unclear (2+ options) | — | `strategy-compare` (decide before building) |
| A consequential decision needs attacking before commitment | — | `decision-challenge` |
| Substantial change is green and about to be called done | `refuter-correctness` + `refuter-security` + `refuter-tests` (one wave) | — |
| CI, containers, test infrastructure | `platform` | `web-testing` |
| No written quality bar; "define our standards" | `platform` | `quality-bar` |

## How activation works

Skills activate by their `description` — invoke the matching one rather than working from training
memory; it carries the non-obvious delta, which is the whole point of Praxis. **Crafts**
(`anti-slop`, `a11y-baseline`, `motion-discipline`, `minimalism`, `orchestration`,
`evidence-discipline`) are always-on for the work each governs
taste disciplines every output honors, whether or not the user names them.
