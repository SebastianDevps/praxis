---
name: scout
description: Use before proposing an approach, building something new, or choosing a library — quick recon of existing code and conventions in the repo plus external prior art, producing a short findings note (not a decision).
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

Before proposing an approach, building something new, or choosing a library — run scout first. Reuse beats building; prior art beats rediscovering.

## Two tracks (run both)

**Internal — what's already in the repo**
- Similar patterns or components that already solve part of the problem.
- Established conventions (naming, folder structure, abstractions) you must match.
- Existing utilities or helpers that overlap with what you're about to write.

**External — what's already been solved**
- Libraries that cover the need (check recency, maintenance status, bundle size).
- Prior art: open-source implementations, RFCs, design docs.
- Known failure modes or gotchas from community experience.

## Output

A short findings note — not a decision. State what you found, what gaps remain, and what the internal conventions suggest. The decision comes after; scout only surfaces the evidence.

## Anti-patterns

- Skipping internal recon and building something that already exists in the repo.
- Treating "I didn't find anything" as conclusive from a single search method (use at least two orthogonal methods before declaring absence).
- Turning scout output into a recommendation — that's the design phase's job.

> Curated from vibecode vc-scout.
