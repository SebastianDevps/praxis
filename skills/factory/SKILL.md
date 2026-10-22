---
name: factory
description: Use when a substantial change opens or resumes — the cycle the orchestrator runs: spec-writer → one approval → builder in a worktree → lenses in one wave behind a barrier → approver → PR; the Run Card, the ledger fields, the resume rule. NOT the per-change folder and its stage machine (that is `spec-lifecycle`), NOT an unattended run of one agent (that is `autonomous-loop`), NOT task-by-task execution with a reviewer between tasks (that is `subagent-driven-development`).
kind: skill
od:
  triggers: ["run the cycle", "factory cycle", "open a change", "continue the change", "dispatch the lenses", "ship the change", "open the PR"]
---

# Factory — the cycle the orchestrator runs

One change, five roles, files between them. You coordinate: you never build, never review, never
decide. Phases, states and the ledger shape are in `docs/task-model.md`; the per-change folder is
`spec-lifecycle`'s. The limits below — one approval, the barrier, the round cap, the ship gate —
are enforced by `hooks/pre-tool-use`; this file is how to run inside them.

## Rules that hold for the whole cycle

- You are the only writer of `specs/<change>/implementation.md`. Roles report in their handback;
  you record. Its frontmatter carries `stage:`, `round:`, `base:`, `builder:`, `lenses:`. The one
  other writer is the person: `scripts/approve.sh` and `scripts/rework.sh` write `stage:` and
  `round:` as the person's action.
- You pass paths, never content. A role reads `spec.md`, the diff and the reviews itself.
- You never write a review or a decision — the one exception is a lens file with `verdict: SKIP`
  for a lens that never returned. You never edit source during the cycle.
- One Run Card per phase change, and whenever you stop on `Needs your decision`.

## The Run Card

```
RUN CARD — <task>
spec:     specs/<change>/   (stage: <stage>)
phase:    <define | plan | build | verify | review | ship — `Needs your decision` when stopped and waiting on you>
approach: <inline | delegate → spec-writer / builder / refuter-correctness / refuter-security / refuter-tests / lens-ui / approver>
research: <what you checked — the spec-writer's handback, the verdict lines you read>
verify:   <the acceptance gate — the spec's Acceptance lines, re-run by the approver>
```

## The cycle

1. **Open.** Write the change name to `.praxis/active-change`; create `specs/<change>/implementation.md`
   from `specs/_templates/` with `stage: new`, `round: 0`, `lenses: correctness, security, tests`, and
   `base: <branch>` — the branch the change starts from (`git rev-parse --abbrev-ref HEAD`). Every
   diff below is `git diff <base>...praxis/<change>` with that value substituted; never assume a trunk name.
2. **Spec.** Dispatch `spec-writer` with the request and the paths it reads (`AGENTS.md`,
   `agents/rules/`); it writes `specs/<change>/spec.md`. Read its handback, not the file:
   - `trivial: true` → the fast path: edit + verify, record it in the ledger, no cycle files.
   - any `[NEEDS CLARIFICATION]` → ask the person ONE question and STOP. Send the answer to the
     spec-writer (`SendMessage`) so it updates the spec; repeat until `ready: true`.
   - `ready: true` → `stage: designed`; Run Card `Needs your decision`; STOP.
3. **Approval.** The person approves — `/praxis:approve <change>`, or by answering the ask the first
   source edit raises. Either writes `.praxis/approved/<change>`; when it exists, `stage: planned`.
4. **Build.** Run `scripts/worktree.sh <change> <base>` (`.praxis/worktrees/<change>`, branch
   `praxis/<change>` from the ledger's `base:`). Dispatch `builder` with the worktree path, the base
   branch and the spec path — never the spec's content. Record `builder: <agent id>` in the ledger.
   On its handback: `stage: implemented`.
5. **Round N.** Set `round: N`. Add `ui` to `lenses:` when `git diff --name-only <base>...praxis/<change>`
   touches `components/`, `*.tsx`, `*.vue`, `*.css` or `*.html`. Write `specs/<change>/review/round-N/lenses`
   (one lens name per line) BEFORE dispatching. Then, in ONE message, dispatch every lens —
   `refuter-correctness`, `refuter-security`, `refuter-tests`, and `lens-ui` when `ui` is listed —
   each told its round number, its output path `specs/<change>/review/round-N/<lens>.md`, the spec
   path, the worktree and the diff command `git diff <base>...praxis/<change>` with the real base.
6. **Barrier.** Wait until every name in `lenses` has its file; the hook denies a builder resume
   before that. A lens that never returns: write its file yourself with `verdict: SKIP` and the
   reason — the only review write you may do. Read the `verdict:` lines, nothing else.
7. **Route the round.**
   - any `CHANGES`, N = 1 → `SendMessage` to the builder id with the paths of the CHANGES files; on
     its handback return to step 5 with N = 2. If the builder is gone, dispatch a fresh `builder`
     with the spec path and the CHANGES paths; the round does not change.
   - any `CHANGES` or `SKIP`, N = 2 → do not resume the builder (the hook denies a third round);
     go to step 8.
   - all `PASS` → step 8.
8. **Approve.** Dispatch `approver` with the spec path, the worktree, the same diff command and
   `specs/<change>/review/round-*/`. It re-runs the checks itself and writes `specs/<change>/decision.md`.
9. **Ship or escalate.** Read its `verdict:` line.
   - `APPROVE` → `git push -u origin praxis/<change>` and `gh pr create` (title from the spec's
     Goal; body links `specs/<change>/spec.md` and `specs/<change>/decision.md`). The hook allows
     this only with APPROVE and every lens PASS. `stage: shipped`, PR URL in the ledger; Run Card
     phase `ship`.
   - `ESCALATE` → the hook writes `.praxis/needs-human/<change>`. Set `stage: needs-human`; Run Card
     `Needs your decision`, saying what each command does: `/praxis:rework <change> "<note>"`
     (`scripts/rework.sh`) records the note, resets `round:` and clears `needs-human` — the person
     writing the ledger — then you resume the builder with the note; `/praxis:approve <change>`
     (`scripts/approve.sh`) writes `decision.md` with `verdict: APPROVE (human)` and the ledger's
     `stage:` — your next step is then the ship commands above, nothing in between. STOP.

## Resume

On "continue <change>": read `specs/<change>/implementation.md` first — `stage:`, `round:`, `base:`,
`builder:`, `lenses:` — and resume at the step those fields name, never from the conversation. A
missing lens file under `review/round-N/` means step 6; a `decision.md` present means step 9.

## It's working if

- `round:` in the ledger never exceeds 2, and `review/round-3/` never exists.
- Every `review/round-N/<lens>.md` is written before the builder resumes, and `lenses` before all of them.
- The orchestrator's context holds paths and verdict lines; no spec body, diff or review body is in it.
- Each dispatch prompt names files; none pastes their content.
- One Run Card per phase change; the person is stopped once before code, and again only on ESCALATE.
