---
title: {Change Name}
ready: false        # true when no [NEEDS CLARIFICATION] remains
---

<!-- Written by `spec-writer`; the person approves it; `builder`, the lenses and `approver` read it.
     The one file the builder sees: what to build and how it is accepted, nothing else. Older
     changes carry the same role under the name design.md; the floor accepts either. -->

# {Change Name} — Spec

## Goal
{What the change does and for whom, in 2-3 sentences.}

## Scope
### In
- {…}
### Out
- {The adjacent behaviour this change must leave alone, named.}

## Acceptance
Runnable checks — the approver executes these itself. Four states: PASS · FAIL · SKIP · GAP.

- [ ] `{command}` → {expected output}

## Approach
{Files and modules touched, and the seam — no code.}

## Open questions
- [NEEDS CLARIFICATION] {One material ambiguity the repo cannot answer — e.g. "is the date range inclusive on both ends?"}
