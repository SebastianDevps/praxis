---
name: learn-prune
description: Use when curating accumulated project memory — prune stale or unused lessons and learned skills, resolve contradictions, keep the index small.
kind: skill
od:
  category: memory
  triggers:
    - "prune memory"
    - "curate memory"
    - "stale lessons"
    - "resolve contradiction"
    - "shrink index"
---

# Learn-Prune — keep memory small and true

Memory that only grows decays: a bloated `index.md` costs context every session and buries the lessons
that matter. Pruning is the curation pass that keeps it small and trustworthy. Operates on the
project's `.praxis/memory/`. Follows the `praxis-memory` contract.

## The pass

1. **Demote the stale.** A lesson or skill with an old `last_verified` (not confirmed in N sessions) is
   suspect — the codebase may have moved. Lower its `conf`; if it has not resurfaced and is no longer
   true, archive it out of `index.md` (keep detail in `lessons.md` for audit, drop the index line).

2. **Archive the unused.** A learned skill never reached for across N sessions is dead weight. Demote
   `active → candidate` if it is merely cold, or remove it if it is obsolete.

3. **Resolve contradictions.** When two lessons disagree, they cannot both stay — investigate which
   holds now, keep the verified one (refresh its `last_verified`), retire the other. Never leave the
   agent two conflicting instructions to pick from.

4. **Shrink the index.** The whole point is a TINY `index.md` — it is loaded in full every session.
   Merge near-duplicates, cut lines that no longer earn their context, keep one line per live lesson
   and skill. If the index has grown long, you have not pruned enough.

## Retrieval guarantee still holds

Pruning edits the index as the source of truth: removing a lesson means removing its index line (detail
may stay in `lessons.md` for audit, but if it is not in the index it is not in play). Never leave a
lesson in detail that still has a live index line pointing at the wrong thing — index and detail move
together.
