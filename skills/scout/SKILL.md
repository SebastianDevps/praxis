---
name: scout
description: Use before proposing an approach or building something new — recon of what THIS repo already has that bears on it: prior art, conventions you must match, overlapping utilities, installed dependencies. Produces a findings note, never a decision. NOT external or library investigation (that is `deep-research`), NOT picking between options already found (that is `strategy-compare`).
kind: skill
od:
  category: research
  triggers:
    - scout
    - recon
    - explore codebase
    - prior art
    - conventions
---

## When to run

Before proposing an approach or building something new. Reuse beats building, and the convention
already in the repo beats the one you would have picked.

## Scope

This repo, and only this repo. The body used to carry a second "external" track — libraries, RFCs,
community gotchas — that the description had already excluded, and a measured run followed the
description and skipped it. External investigation is `deep-research`; choosing between what you
found is `strategy-compare`. One skill, one decision.

## What to look for

- **Prior art** — code that already solves part of this, even under a different name.
- **Conventions** — naming, folder structure, error shape, the abstractions in use. You must match
  these, not improve on them in passing.
- **Overlapping utilities** — helpers that duplicate what you were about to write.
- **Installed dependencies** — what the project already pulls in and can use without a new one.

## Output contract

A findings note with these four sections, each present even when empty. An omitted section is an
unasked question, and an unasked question reads downstream as a settled one.

```
PRIOR ART      <file:line, what it covers, what it does not>  | NONE FOUND (methods: …)
CONVENTIONS    <the ones this change must match, cited>
OVERLAP        <utilities that already do part of this>       | NONE FOUND (methods: …)
DEPENDENCIES   <installed packages that bear on this>
GAPS           <what you could not determine, and why>
```

`NONE FOUND` requires naming the two orthogonal methods that produced it. One search returning
nothing is absence of evidence, not evidence of absence — a glob misses hidden paths, a grep
misses a synonym, a symbol search misses a string built at runtime.

## It's working if

- The note cites concrete `path:line` for every claim of prior art, not a paraphrase.
- Every `NONE FOUND` names two orthogonal methods.
- The note contains no recommendation, no ranking, and no "I suggest" — the decision comes after.
- `GAPS` is non-empty, or the note says explicitly that nothing was left undetermined.

## Anti-patterns

- Building something the repo already has because recon was skipped.
- Declaring absence from a single search method.
- Turning findings into a recommendation — that is the design phase's job.
- Reaching for an external library before checking what is already installed.

> Curated from vibecode vc-scout.
