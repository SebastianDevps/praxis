---
name: spec-lifecycle
description: Use when managing a change through the spec-driven workflow — its `specs/<change>/` folder, advancing `stage:` one step at a time from new to shipped, the file minimums per mode, and resuming from `implementation.md`. NOT the doctrine behind it (that is `agentic-lifecycle`), NOT the task checklist (that is `writing-plans`), NOT running the cycle's roles (that is `factory`).
kind: skill
od:
  category: workflow
  triggers:
    - spec
    - spec-driven
    - "new change"
    - "specs folder"
    - "design phase"
    - "plan phase"
    - "implement phase"
    - "continue the change"
    - "active change"
---

## The folder

Every substantial change leaves `specs/<change>/` in the user's repository — kebab-case, one per
change. The mode dial decides how much of it is mandatory, never whether it exists. A question is
answered in every mode and creates nothing.

```
specs/
  _templates/          shipped by the plugin at specs/_templates/, copied verbatim on first use
  <change>/
    spec.md            what to build and how it is accepted — Goal, Scope (In/Out), Acceptance
                       (runnable), Approach, Open questions; frontmatter `ready: false | true`
    implementation.md  ledger — frontmatter (title, stage, round, builder, lenses, owner), Tasks,
                       Completed, Blocked, Session Notes
    review/round-N/    `lenses` (one name per line) and one `<lens>.md` per lens — verdict
                       PASS | CHANGES | SKIP, Findings with file:line, What I tried to break
    decision.md        verdict APPROVE | ESCALATE | APPROVE (human), Checks run, Reason
    decisions.md       ADR-NNN — Context, Options Considered, Decision, Consequences; only when a
                       decision passes the three gates in the template
    future-work.md · AGENTS.md (CLAUDE.md -> AGENTS.md) · docs/   optional — no mode requires them
    design.md          the legacy name of spec.md: existing changes keep it, the floor accepts either
```

First use in a repo without `specs/`: the floor's first deny copies the templates into the project
as `specs/_templates/` (its `CLAUDE.md` is a symlink to `AGENTS.md`; keep it one), and every step
from then on names that local copy — never a plugin path. Create `specs/<change>/` from it.
`session-start` never writes into the user's repo; the first denied edit does, templates only.

One writer per file. A role reads what it needs from disk and never edits another role's file:

| File | Writer |
|---|---|
| `spec.md` | `spec-writer`; the person approves it |
| `implementation.md` | the orchestrator, and only the orchestrator — roles report in their handback, it records |
| `review/round-N/lenses` | the orchestrator, before the round's lenses are dispatched |
| `review/round-N/<lens>.md` | that lens; the orchestrator may write one only with `verdict: SKIP`, for a lens that never returned |
| `decision.md` | `approver`; `scripts/approve.sh` for the person's `APPROVE (human)` |
| `decisions.md`, `future-work.md`, `docs/` | the orchestrator |
| `.praxis/approved/<change>`, `.praxis/needs-human/<change>` | the hooks and the person's scripts; an Edit or Write to either is denied |

## Stage machine

```
new → designed → planned → implemented → shipped
                                   ↘ needs-human ─ /praxis:rework → planned · /praxis:approve → shipped
```

| Stage | Earned by |
|---|---|
| `new` | `specs/<change>/` created from `specs/_templates/`; `.praxis/active-change` written |
| `designed` | `spec.md` written by `spec-writer` with `ready: true` — no `[NEEDS CLARIFICATION]` left |
| `planned` | `.praxis/approved/<change>` exists (see below); `implementation.md` holds the task lines |
| `implemented` | the last review round is all `PASS` and `decision.md` says `APPROVE` |
| `shipped` | the PR is open on `praxis/<change>`; its URL is in the ledger |
| `needs-human` | `decision.md` says `ESCALATE` and the hook wrote `.praxis/needs-human/<change>`; the person decides |

Advance the `stage:` frontmatter field of `implementation.md` one step at a time, in that order —
never skip a stage, and never advance before the artifact that earns it is actually written. The
field is the human-readable mirror of the markers and the review files; it unlocks nothing.

**The field is `stage:`, not `status:`.** A change has a stage; a task inside it has a `phase:` and
a `state:` (`docs/task-model.md`). One word for three concepts is how a ledger written by one skill
becomes unreadable to the next — this one was renamed rather than documented around.

## Mode minimums

| File | `fast` | `full` |
|---|---|---|
| `implementation.md` | ✓ Status (frontmatter) + Completed + verify evidence | ✓ the full ledger, orchestrator-only |
| `spec.md` | — | ✓ every section, `ready: true` before approval |
| `review/round-N/`, `decision.md` | — | ✓ written by the cycle (`factory`) |
| `decisions.md` | only if an alternative was rejected | only when a decision passes the three gates |
| `future-work.md`, `AGENTS.md`, `docs/` | — | optional |

`deep` is gone (ADR-004, `specs/factory-cycle/decisions.md`): what it added — review, ship, an ADR,
the refuters — is always on or gated on the diff, never on a dial; `/praxis:mode deep` maps to
`full` with a notice for one release. A trivial edit in `fast` still writes `implementation.md`:
five lines, filled after the verify command runs.

## The single approval stop

In `full`, once `spec.md` is written with `ready: true`, the Run Card reads `Needs your decision`,
and the first source edit is answered by `hooks/pre-tool-use` with the host's own permission prompt
(`permissionDecision: ask`) until the approval exists. The approval is a record the model cannot
write: `.praxis/approved/<change>`, written by `hooks/post-tool-use` when the person's approved edit
actually ran, or by the person with `/praxis:approve <change>` — on hosts without a prompt (Codex)
and for unattended runs, which must ship the marker. `pre-tool-use` gates on that marker, not on
`stage:`; an Edit or Write targeting `.praxis/approved/` is denied. Once the marker exists the floor
is silent, whatever `stage:` says, and the model sets `stage: planned` — the human-readable record
of the approval; it unlocks nothing. After approval the spec does not interrupt building again: the
person is stopped once more only when the approver escalates. A `fast` task that turns out
substantial reclassifies, enters the cycle, and takes that one stop.

## Review rounds and the decision

The cycle (`factory`) owns the steps; the folder records them. Round N exists when
`review/round-N/lenses` does, and is complete when every name in it has its `<lens>.md`; the
builder is not resumed before then — the hook denies it. Two rounds at most: the dispatch that
would open a third is denied, and the approver decides. `decision.md` closes the change: `APPROVE`
lets `git push` / `gh pr create` for `praxis/<change>` through the hook, together with every lens
`PASS`; `ESCALATE` makes the hook write `.praxis/needs-human/<change>` and the cycle stops.
`/praxis:rework <change> "<note>"` archives the rounds and the decision under `review/rework-k/`,
resets `round: 0`, and sends the builder back; `/praxis:approve <change>` records `APPROVE (human)`
and ships. Formats and hook rules, for a reader: `docs/cycle.md`.

## The active change and the floor

Creating `specs/<change>/` also writes `.praxis/active-change` — one line, the change name. It is
the change the Run Card's `spec:` line is about; the orchestrator rewrites it when the user names
another change, and dispatched roles inherit it.

The runtime floor reads that pointer: a `PreToolUse` hook denies a source edit until the active
change has the file its mode requires (`implementation.md` in `fast`; `spec.md` — or a legacy
`design.md` — in `full`), naming the exact local file to create, asks until
`.praxis/approved/<change>` exists, and is silent from then on; a `Stop` hook blocks once when
source changed and no `implementation.md` did. The mechanics live in `hooks/pre-tool-use`,
`hooks/post-tool-use` and `hooks/stop`; hosts without those events keep the prose rule only.

## Resume

On "continue <change>", read `specs/<change>/implementation.md` first — `stage:`, `round:`,
`builder:`, `lenses:`, what is done, what is blocked — before reading anything else or asking
anything. A lens file missing under `review/round-N/` means the barrier is still open; a
`decision.md` present means ship or escalate. The ledger, not the conversation, is where the
change is.

## Writing principles

- **Brevity.** Bullets over prose. One fact per bullet.
- **Spec = what, then how.** Goal and Scope state what is wanted, in the terms of someone affected;
  Approach states the chosen seam, with paths — no code. A rejected alternative that passes the
  three gates goes to `decisions.md` as an ADR with the reason.
- **Acceptance is runnable.** `spec.md` Acceptance holds commands someone can paste, each reported
  as PASS · FAIL · SKIP · GAP; the approver runs them itself. A criterion nobody can run is a hope,
  not acceptance.
- **Open questions are markers.** One `[NEEDS CLARIFICATION]` per material ambiguity the repo cannot
  answer; the orchestrator asks ONE and stops. `ready: true` only when none remain.
- **DFUs go to `future-work.md`.** Out-of-scope ideas are captured there, not acted on now.

Task line shape, phases, and states: `docs/task-model.md`, never redefined here.
