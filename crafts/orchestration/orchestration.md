---
name: orchestration
description: Harness-engineering discipline — delegate to specialists, fan-out disjoint work, keep orchestrator context thin, render Run Cards.
kind: craft
---

## Rules

**Delegate substantial work.** Multi-file, new behavior, domain-specific, or any task that inflates orchestrator context → dispatch a specialist. Inline only trivial single-file edits with no new public surface.

**Parallel fan-out for disjoint work.** Two or more tasks on genuinely independent files/domains → dispatch in a single wave. Shared files → sequential. Isolate concurrent writers.

**Keep orchestrator context thin.** Each delegated unit returns a result the orchestrator synthesizes. The orchestrator does not read all the files — it delegates reading and writing together to the specialist.

**Make every run inspectable.** Render a Run Card after each phase: phase · tools · artifacts · review gate · recovery · cost. No prose summary substitutes for it.

**Research before deciding.** Scout existing code and prior art; fetch current library docs before proposing an approach. Stale assumptions produce rework.

**Verify before declaring done.** Check the EAG (Executable Acceptance Gate). If red: fix → re-verify. No "should work."

**Smallest viable step.** Prefer the approach that removes more lines over the one that adds more. Apply minimalism throughout.
