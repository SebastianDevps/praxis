---
name: spec-lifecycle
description: Use when managing a change through the spec-driven workflow — its `specs/<change>/` folder, advancing `stage:` one step at a time from new to shipped, the mode-scaled file minimums, and resuming from `implementation.md`. NOT the doctrine behind it (that is `agentic-lifecycle`), NOT the task checklist (that is `writing-plans`).
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
  _templates/            shipped by the plugin at specs/_templates/, copied verbatim on first use
  <change>/
    implementation.md    ledger — frontmatter (title, stage, owner), Tasks, Completed, Blocked, Session Notes
    design.md            source of truth — Overview, Problem Statement, User Stories, Scope (In/Out),
                         Technical Design, Edge Cases, Acceptance (EAG)
    decisions.md         ADR-NNN entries — Context, Options Considered, Decision, Consequences
    future-work.md       DFU-n items — Enhancements, Technical Debt, Nice to Have
    AGENTS.md            deep only — Context, Before Starting Work, Code Patterns, Don't
    CLAUDE.md -> AGENTS.md
    docs/README.md       deep only, user-facing surface only — Overview, How to Use,
    docs/screenshots/    Configuration Options, FAQ; screenshots from the running product
```

First use in a repo without `specs/`: the floor's first deny copies the templates into the project
as `specs/_templates/` (its `CLAUDE.md` is a symlink to `AGENTS.md`; keep it one), and every step
from then on names that local copy — never a plugin path. Create `specs/<change>/` from it.
`session-start` never writes into the user's repo; the first denied edit does, templates only.

| File | Owner |
|---|---|
| `design.md`, `decisions.md` | the orchestrator — never a dispatched builder |
| `implementation.md` | the builder for its task lines; the orchestrator for the frontmatter and Blocked |
| `future-work.md`, `docs/` | the orchestrator, at ship |

## Stage machine

```
new → designed → planned → implemented → shipped
```

| Stage | Earned by |
|---|---|
| `new` | `specs/<change>/` created from `specs/_templates/` |
| `designed` | `design.md` written through Technical Design — research is a section of it, not a stage |
| `planned` | set after `.praxis/approved/<change>` exists (see below); `implementation.md` holds the task lines |
| `implemented` | every task `state: done`, every Acceptance line green |
| `shipped` | merged, deployed, or handed over; `docs/` and `future-work.md` final |

Advance the `stage:` frontmatter field of `implementation.md` one step at a time, in that order —
never skip a stage, and never advance before the artifact that earns it is actually written.

**The field is `stage:`, not `status:`.** A change has a stage; a task inside it has a `phase:` and
a `state:` (`docs/task-model.md`). One word for three concepts is how a ledger written by one skill
becomes unreadable to the next — this one was renamed rather than documented around.

## Mode minimums

| File | `fast` | `full` | `deep` |
|---|---|---|---|
| `implementation.md` | ✓ Status (frontmatter) + Completed + verify evidence | ✓ full ledger | ✓ |
| `design.md` | — | ✓ Overview, Problem, Scope, Technical Design, Acceptance | ✓ all sections |
| `decisions.md` | only if an alternative was rejected | when alternatives were weighed | ✓ ≥1 ADR + refuter verdicts |
| `future-work.md` | — | when a DFU was captured | ✓ |
| `AGENTS.md` | — | — | ✓ |
| `docs/` | — | — | ✓ when user-facing |

A trivial edit in `fast` still writes `implementation.md`: five lines, filled after the verify
command runs.

## The single approval stop

In `full` and `deep`, once `design.md` is written the Run Card reads `Needs your decision`, and the
first source edit is answered by `hooks/pre-tool-use` with the host's own permission prompt
(`permissionDecision: ask`) until the approval exists. The approval is a record the model cannot
write: `.praxis/approved/<change>`, written by `hooks/post-tool-use` when the person's approved edit
actually ran, or by the person with `/praxis:approve <change>` — on hosts without a prompt (Codex)
and for unattended runs, which must ship the marker. `pre-tool-use` gates on that marker, not on
`stage:`; an Edit or Write targeting `.praxis/approved/` is denied. Once the marker exists the floor
is silent, whatever `stage:` says, and the model sets `stage: planned` — the human-readable record
of the approval; it unlocks nothing. After approval, building is not interrupted again by the spec:
tasks move through `implementation.md`, and a `fast` task that turns out substantial reclassifies,
writes `design.md`, and takes that one stop.

## The active change and the floor

Creating `specs/<change>/` also writes `.praxis/active-change` — one line, the change name. It is
the change the Run Card's `spec:` line is about; the orchestrator rewrites it when the user names
another change, and dispatched subagents inherit it.

The runtime floor reads that pointer: a `PreToolUse` hook denies a source edit until the active
change has the file its mode requires (`implementation.md` in `fast`; `design.md` in `full`/`deep`),
naming the exact local file to create, asks until `.praxis/approved/<change>` exists, and is silent
from then on; a `Stop` hook blocks once when source changed and no `implementation.md` did. The
mechanics live in `hooks/pre-tool-use`, `hooks/post-tool-use` and `hooks/stop`; hosts without those
events keep the prose rule only.

## Resume

On "continue <change>", read `specs/<change>/implementation.md` first — stage, what is done, what is
blocked — before reading anything else or asking anything. The ledger, not the conversation, is
where the change is.

## Writing principles

- **Brevity.** Bullets over prose. One fact per bullet.
- **Research = factual.** `design.md` Problem Statement and Technical Design state what exists,
  with paths; no opinions before the facts.
- **Design = opinionated.** Technical Design states the chosen approach; every rejected
  alternative goes to `decisions.md` as an ADR with the reason.
- **Pseudocode, not production code.** Specs describe intent; code belongs in implementation.
- **Acceptance is runnable.** `design.md` Acceptance (EAG) holds commands someone can paste, each
  reported as PASS · FAIL · SKIP · GAP. A criterion nobody can run is a hope, not acceptance.
- **DFUs go to `future-work.md`.** Out-of-scope ideas are captured there, not acted on now.

Task line shape, phases, and states: `docs/task-model.md`, never redefined here.
