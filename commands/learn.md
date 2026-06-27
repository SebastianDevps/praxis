---
description: Capture a recurring, reusable delta from this session into the project's .praxis/memory/ — a lesson or a candidate learned skill, deduped and indexed.
---

# /praxis:learn — capture what recurred

Looks back over the session for ONE recurring, reusable delta worth keeping, and writes it to the
PROJECT's `.praxis/memory/` (not the plugin). Follows the `praxis-memory` contract — read it first.

This captures **recurrence, never one-offs.** If nothing was seen ≥2× — a mistake corrected twice, a
pattern that repeated, a convention re-stated — there is nothing to learn this session. Say so and
stop. A memory full of single events is noise that drowns the signal.

## The capture flow

1. **Find the delta.** Scan the session for something that RECURRED and would help next time: a
   correction you made more than once, a convention the user re-stated, a procedure you reconstructed
   that you had to reconstruct before. No second occurrence → no capture. Pick the single strongest;
   do not hoard.

2. **Dedup first.** Read `.praxis/memory/index.md` and the relevant detail. If this delta already
   exists, **MERGE — do not duplicate**: bump its `Recurrence: seen Nx`, refresh `last_verified`,
   raise `conf`. Duplicated near-identical lessons rot the index faster than anything else.

3. **Classify and write:**
   - **Fact / correction / convention** → append an entry to `lessons.md` (What / Why / Recurrence /
     conf / last_verified).
   - **Recurring procedure** (a reusable how-to, several steps) → author a learned skill under
     `.praxis/memory/skills/<name>/SKILL.md` with `metadata.status: candidate`. Born in probation —
     never `active` directly.

4. **Always update `index.md` (retrieval guarantee).** In the SAME pass, add or update the one-line
   entry — a lesson under `## Lessons`, a candidate skill under `## Candidates`. The index is the read
   path; a lesson absent from it is invisible. Write detail and index together or not at all.

5. **Hand off candidates.** If you authored a candidate skill, tell the user it is in probation and
   point at `learn-graduate` to pressure-test it before it is trusted. Do NOT promote it yourself.

## Runtime note

`.praxis/memory/` lives in the user's project and is git-committable, so a team shares accumulated
memory through git. If it does not exist yet, create it on first capture. Keep every write terse —
the index is loaded every session, so each line costs context.
