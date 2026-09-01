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

1. **Read the queue before reading the session.** Two files, in this order:
   - `.praxis/memory/sessions.jsonl` — every row with `"state":"pending"` is a dispatch the capture
     hook recorded and nobody has consolidated. It tells you WHICH dispatches to look at and which
     ones fought back (`status`, and the ledger's `done/blocked/pending` counts).
   - `.praxis/memory/gaps.md` — first sightings and open holes from EARLIER sessions.

   Skipping this step is what makes the capture hook pointless: it would keep appending rows into a
   file no one ever opens. If either file is missing, say so plainly — an empty queue and an absent
   one are different states.

2. **Find the delta — and count the sighting.** Look for something reusable: a correction made more
   than once, a convention re-stated, a procedure reconstructed again. Then decide which case you
   are in:
   - **Seen twice or more** (in this session, or once here and once as a gap line) → it is a lesson.
     Proceed.
   - **Seen exactly once** → it is NOT a lesson. Write it to `gaps.md` as a first sighting and stop
     there. The second occurrence, in any later session, promotes it.

   This is what makes `≥2×` mean anything across sessions. Without the gap line, a delta seen once
   per session for a month never gets recorded at all.

3. **Dedup first.** Read `.praxis/memory/index.md` and the relevant detail. If this delta already
   exists, **MERGE — do not duplicate**: bump its `Recurrence: seen Nx`, refresh `last_verified`,
   raise `conf`. Duplicated near-identical lessons rot the index faster than anything else.

4. **Check the admission rule.** Would a NEW TEAMMATE need this? If it is about how *you* work rather
   than about this project, it belongs in the host's personal memory, not in the committed team
   store. See `praxis-memory`. Writing personal preferences here is how a shared store fills with
   lines nobody else can act on.

5. **Classify and write:**
   - **Fact / correction / convention** → append an entry to `lessons.md` (What / Why / **Source** /
     Recurrence / conf / last_verified / last_used). `Source` names what taught it — the correction,
     the PR, the commit. A distilled claim with no traceable origin outlives its evidence and keeps
     being obeyed after it stops being true.
   - **Recurring procedure** (a reusable how-to, several steps) → author a learned skill under
     `.praxis/memory/skills/<name>/SKILL.md` with `metadata.status: candidate`. Born in probation —
     never `active` directly.
   - **Promoted from a gap** → write the lesson AND remove the gap line. Promotion is a move, not a
     copy; a line left in both files will be counted twice next time.

6. **Always update `index.md` (retrieval guarantee).** In the SAME pass, add or update the one-line
   entry — a lesson under `## Lessons`, a candidate skill under `## Candidates`. The index is the read
   path; a lesson absent from it is invisible. Write detail and index together or not at all.

7. **Mark the rows consumed.** Every `sessions.jsonl` row you just considered flips
   `"state":"pending"` → `"state":"consolidated"` — including the rows that taught nothing. A row
   left pending will be re-read forever and re-argued every run; consolidated-with-no-lesson is a
   real and useful outcome.

8. **Hand off candidates.** If you authored a candidate skill, tell the user it is in probation and
   point at `learn-graduate` to pressure-test it before it is trusted. Do NOT promote it yourself.

## Report honestly

Say which of these actually happened, in these words: a lesson written, a gap recorded, a gap
promoted, or nothing durable found. "Nothing recurred this session" is a correct and frequent
outcome — and if `.praxis/` does not exist yet, the capture hook has been INERT, so an empty queue
means nothing was ever recorded, not that nothing happened.

## Runtime note

`.praxis/memory/` lives in the user's project and is git-committable, so a team shares accumulated
memory through git. If it does not exist yet, create it on first capture. `sessions.jsonl` is the
one file that stays local — the capture hook writes the `.gitignore` that excludes it. Keep every
write terse: the index is loaded every session, so each line costs context.
