---
title: {Change Name}
stage: new          # new → designed → planned → implemented → shipped · needs-human after an ESCALATE
round: 0            # 0 = no review yet; N once round N's lenses are dispatched
builder:            # the builder's agent id, set at dispatch — the SendMessage target on resume
lenses: correctness, security, tests   # + ui when the diff touches UI paths
owner: {who decides}
---

<!-- The ledger for THIS change. The orchestrator is its only writer: roles report in their handback
     and it records. `stage:` is where the change is; `round:` is what the review cap counts. Each
     task below carries `phase:` and `state:` from docs/task-model.md. Three words, three meanings —
     do not mix them. `fast` mode: this file alone, with Status, Completed and Verify filled in. -->

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
{Anything the next session needs to resume without re-reading the diff. At ship: the PR URL and the rounds.}
