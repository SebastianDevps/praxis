---
name: learn-prune
description: Use when curating accumulated project memory — prune stale or unused lessons and learned skills, resolve contradictions, keep the index small. NOT promoting a candidate (that is `learn-graduate`), NOT the store itself (that is `praxis-memory`).
kind: skill
od:
  category: memory
  triggers:
    - "prune the index"
    - "curate accumulated lessons"
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

2. **Archive the unused — read `last_used`, not `last_verified`.** The two answer different questions:
   `last_verified` says when someone last confirmed the lesson is TRUE, `last_used` says when it last
   CHANGED anything. A lesson can be perfectly true and still be dead weight, and that is the case
   pruning exists for. Rank by `last_used` ascending and start at the top: never used since it was
   written is the strongest possible signal to cut. Demote a learned skill `active → candidate` if it
   is merely cold; remove it if it is obsolete.

   A missing `last_used` means the lesson predates the field — treat it as cold, not as fresh.

3. **Sweep `gaps.md` too.** A first sighting that never found its second occurrence is a line that will
   never promote. Old sightings decay like anything else: cut the ones that stopped being plausible,
   keep the ones still worth watching. An unbounded gaps file stops being a work queue and becomes an
   attic — and unlike the index it is never read at session start, so nothing else will catch it.

4. **Resolve contradictions.** When two lessons disagree, they cannot both stay — investigate which
   holds now, keep the verified one (refresh its `last_verified`), retire the other. Never leave the
   agent two conflicting instructions to pick from.

5. **Shrink the index.** The whole point is a TINY `index.md` — it is loaded in full every session.
   Merge near-duplicates, cut lines that no longer earn their context, keep one line per live lesson
   and skill. If the index has grown long, you have not pruned enough.

## Retrieval guarantee still holds

Pruning edits the index as the source of truth: removing a lesson means removing its index line (detail
may stay in `lessons.md` for audit, but if it is not in the index it is not in play). Never leave a
lesson in detail that still has a live index line pointing at the wrong thing — index and detail move
together.
