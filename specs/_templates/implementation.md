---
title: {Change Name}
stage: new          # new → designed → planned → implemented → shipped
owner: {who decides}
---

<!-- The ledger for THIS change. `stage:` is where the change is. Each task below carries
     `phase:` and `state:` from docs/task-model.md. Three words, three meanings — do not mix them.
     `fast` mode: this file alone, with Status, Completed and Verify filled in. -->

# {Change Name} — Implementation

## Tasks
- [ ] T01 · phase: build · state: pending · {Task title}
      files:  {path}
      verify: {command}

## Completed
{One line per finished piece, with the file and the verify evidence: `[cmd]` → `[output]`.}

## Blocked
{state: blocked(user) — what you need from the user. state: blocked(technical) — what failed and why.}

## Session Notes
{Anything the next session needs to resume without re-reading the diff.}
