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
see `references/<host>-tools.md` (`claude-code`, `codex`, `cursor`, `gemini`, `copilot`). Always
express intent as an action; let the reference resolve it.

This environment has **Praxis** — a clarity-first agent framework. Its value is HOW work runs:
visibly, in phases, with research and verification — not one silent inline blob. A vague prompt is
not a license to skip the method; it is when the method matters most.

**Kernel, router, cycle.** The operating contract (`hooks/context/contract.md`, ≤40 lines) is
injected every turn; a dispatched role receives its role kernel (`hooks/context/roles/`) and paths
instead. This file explains once; `factory` carries the cycle and loads when a change opens. Where
two surfaces need a rule, the kernel owns it and the others point at it.

## Classify first

- **Answer** — a question, no request to change files → answer it; research only what you do not
  already know. No ceremony to scale, so no dial applies.
- **Trivial** — one file, no new behavior, no design surface → the fast path. Skip the cycle.
- **Substantial** — build / replicate / redesign / feature / debug / multi-file / unclear scope →
  invoke `factory` and open a change. Unresolved ambiguity escalates to one question, never to
  more process: guessing bigger is not the same as knowing more.
- **Research first**, on either path — read the reference or screenshot closely, invoke `scout` for
  prior art in this repo, invoke `docs-seeker` for an unfamiliar API. Never decide on stale assumptions.
- **Clarify** — material ambiguity still open after looking → invoke `brainstorming`: ask ONE
  question and STOP before building; never guess silently on substantial work.

## The fast path

- Edit + verify, inline or through one specialist from the table below. Work leaves a folder in
  every mode; in `fast` a change writes `specs/<change>/implementation.md` — Status, Completed,
  verify evidence — before you stop.
- Verify: run the acceptance gate; Red → fix → re-verify; never "should work". For web output,
  invoke `frontend-design` and run its Ship Gate (font ≠ Inter, Baseline table, a11y, motion). A
  check that ran and had nothing to fail on is a GAP, not a PASS — the kernel carries the four states.
- Work that turns out substantial reclassifies: say so, then invoke `factory`.

## The cycle (substantial work, `full`)

`factory` runs it: `spec-writer` writes `specs/<change>/spec.md` → one approval → `builder` in a
worktree → the lenses in one wave behind a barrier → `approver` re-runs the checks → a PR. The
limits are hooks: `hooks/pre-tool-use` denies source edits until `specs/<change>/spec.md`
exists and asks until `.praxis/approved/<change>` exists — a record the model cannot write — and
`hooks/stop` blocks once until `implementation.md` records the work; `PRAXIS_FLOOR=off` is the only
override. Once `specs/<change>/spec.md` is written, set the Run Card to `Needs your decision`; the
first source edit will ask — the host's permission prompt is the one approval per change. The
approval is a record the model cannot write: `.praxis/approved/<change>`, written by
`hooks/post-tool-use` when the approved edit ran, or by the person with `/praxis:approve <change>`.
After approval set `stage: planned` in `implementation.md` — the human-readable record, it unlocks
nothing. Do NOT build inline in the main thread: dispatch a role and pass it paths, never content.
Files and stages: `spec-lifecycle`; the cycle for a reader: `docs/cycle.md`.

## The Run Card

Rendered at every phase change and on every `Needs your decision` — one shape on every host:

```
RUN CARD — <task>
spec:     specs/<change>/   (stage: <stage>)
phase:    <define | plan | build | verify | review | ship — `Needs your decision` when stopped and waiting on you>
approach: <inline | delegate → spec-writer / builder / design / engineer / backend / security / platform / researcher>
research: <what you checked>
verify:   <the acceptance gate — how you will prove it is right>
```

Phases, task states, and the ledger's shape are defined once in `docs/task-model.md` — read it there
rather than inventing a vocabulary here. The `spec:` line names the change the card is about
(`.praxis/active-change`); on "continue <change>", read `specs/<change>/implementation.md` first.

## Route by task

`factory` dispatches the cycle's roles; these specialists serve the fast path and research:

| Task | Specialist agent | Discipline skill |
|---|---|---|
| Build / replicate / redesign a UI, page, dashboard, landing, component | `design` | `frontend-design` |
| Charts, graphs, data viz | `design` | `data-visualization` |
| Review / audit / polish existing UI | `reviewer` | `design-review` |
| Code / logic | `engineer` | — |
| Bug or failing test | `engineer` | `systematic-debugging` |
| Approach unclear (2+ options) | — | `strategy-compare` (decide before building) |
| A consequential decision needs attacking before commitment | — | `decision-challenge` |
| A change built outside the cycle is green and about to be called done | `refuter-correctness` + `refuter-security` + `refuter-tests` (one wave) | — |
| Take apart a codebase someone else owns | `analyst` | `project-teardown` |
| Whether to take on a package, Action or plugin | `analyst` | `dependency-adoption` |
| Will this architecture hold under its quality requirements | `analyst` | `architecture-evaluation` |
| Build it in-house or source it | `analyst` | `buy-vs-build` |
| CI, containers, test infrastructure | `platform` | `web-testing` |
| No written quality bar; "define our standards" | `platform` | `quality-bar` |

## How activation works

Skills activate by their `description` — invoke the matching one rather than working from training
memory; it carries the non-obvious delta. **Crafts** (`anti-slop`, `a11y-baseline`,
`motion-discipline`, `minimalism`, `orchestration`, `evidence-discipline`) are always-on for the work
each governs — honored whether or not the user names them, reaching only the roles that declare them.
