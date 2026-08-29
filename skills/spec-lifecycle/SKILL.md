---
name: spec-lifecycle
description: Use when managing a change through a spec-driven workflow — moving it across research, design, plan, and implement stages — lean lifecycle with controlled stage advancement. NOT the doctrine behind it (that is `agentic-lifecycle`), NOT the task checklist (that is `writing-plans`).
kind: skill
od:
  category: workflow
  triggers:
    - spec
    - spec-driven
    - "new change"
    - "research phase"
    - "design phase"
    - "plan phase"
    - "implement phase"
---

## Lifecycle

```
new → researched → designed → planned → implemented
```

| Stage | Produces |
|---|---|
| `new` | Spec file created from `templates/spec.md` skeleton |
| `researched` | Research section: what exists, constraints, unknowns |
| `designed` | Design section: chosen approach + alternatives rejected |
| `planned` | Plan section: task checklist |
| `implemented` | All tasks complete, changes verified |

## Stage Rule

Advance the `stage:` frontmatter field one step at a time, in lifecycle order — never skip a stage, and never advance before the current stage's section is actually written. Each transition is earned by producing that stage's artifact (see the table above).

**The field is `stage:`, not `status:`.** A change has a stage; a task inside it has a `phase:` and
a `state:` (`docs/task-model.md`). One word for three concepts is how a ledger written by one skill
becomes unreadable to the next — this one was renamed rather than documented around.

## Writing Principles

- **Brevity.** Bullets over prose. One fact per bullet.
- **Research = factual.** State what exists; no opinions, no solutions yet.
- **Design = opinionated.** State the chosen approach and why; name alternatives rejected.
- **Pseudocode, not production code.** Specs describe intent; code belongs in implementation.

## Required Sections

Every spec must include:

- `## Deferred Follow-Ups (DFU)` — out-of-scope ideas captured during the session; not acted on now.
- `## Acceptance (EAG)` — runnable checks; each must be green before closing (e.g. the project's test command → all pass).

## Template

See `templates/spec.md` for the standard spec skeleton.
