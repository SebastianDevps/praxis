---
name: spec-lifecycle
description: Use when managing a change through a spec-driven workflow — moving it across research, design, plan, and implement phases — lean lifecycle with controlled status advancement.
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

| Status | Produces |
|---|---|
| `new` | Spec file created from `templates/spec.md` skeleton |
| `researched` | Research section: what exists, constraints, unknowns |
| `designed` | Design section: chosen approach + alternatives rejected |
| `planned` | Plan section: task checklist |
| `implemented` | All tasks complete, changes verified |

## Status Rule

Advance the `status:` frontmatter field one phase at a time, in lifecycle order — never skip a phase, and never advance before the current phase's section is actually written. Each transition is earned by producing that phase's artifact (see the table above).

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
