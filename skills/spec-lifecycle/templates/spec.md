---
title: <change name>
stage: new          # new → researched → designed → planned → implemented
owner: <who decides>
---

<!-- `stage:` is where this CHANGE is. The tasks inside it carry `phase:` and `state:`,
     defined in docs/task-model.md. Three words, three meanings — do not mix them. -->

## Problem

<what is wrong or missing today, in the terms of someone affected by it — not in terms of the fix>

## Research

<!-- earns stage: researched -->

Factual only. What exists, what constrains us, what is unknown. No proposals here.

- **Exists:** <what is already in the codebase, with paths>
- **Constraints:** <what cannot change, and why>
- **Unknown:** <what we could not determine, and what it would take to determine it>

## Design

<!-- earns stage: designed -->

Opinionated. The chosen approach, and the alternatives rejected with the reason.

- **Chosen:** <approach>
- **Rejected:** <alternative> — <why not>
- **Rejected:** <alternative> — <why not>

Pseudocode is fine. Production code is not: a spec describes intent.

## Plan

<!-- earns stage: planned -->

The task list, in dependency order. Line shape and field values: `docs/task-model.md`. Written to
`PROGRESS.md`, referenced here — not duplicated, or the two will disagree by the second edit.

## Deferred Follow-Ups (DFU)

Out-of-scope ideas surfaced while writing this. Captured so they are not lost, and explicitly not
acted on now.

- <idea> — <why it is out of scope for this change>

## Acceptance (EAG)

<!-- earns stage: implemented, once every line here is green -->

Runnable checks, not intentions. Each must be a command someone can paste.

- [ ] `<command>` → `<the output that means it passed>`
- [ ] `<command>` → `<the output that means it passed>`

A criterion nobody can run is not acceptance — it is a hope. If you cannot write the command, the
requirement is not yet specified.
