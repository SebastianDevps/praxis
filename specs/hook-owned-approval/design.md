# Hook-Owned Approval — Design

Parent: `specs/spec-driven-workflow/` (ADR-006 consequences, DFU-4). Approved by the owner 2026-09-09.

## Overview
The approval of a design becomes a record the model cannot write. A `PostToolUse` hook writes
`.praxis/approved/<change>` only when the first source edit at `stage: designed` actually ran —
which on Claude Code means the person answered the `ask`. `pre-tool-use` then gates on that
marker, not on `stage:`, and refuses to let Edit/Write forge it.

## Problem Statement
`evals/floor` (n=3, $6.93) measured 3/3 unattended `full` runs setting `stage: planned` themselves
after the host refused the `ask`, then building. The floor's approval stop gates on a field the
model owns, so in `-p` it is prose with a prompt in front of it.

## Scope
### In
- `hooks/post-tool-use` (new) — writes the marker; registered for Claude Code and Codex.
- `hooks/pre-tool-use` — marker replaces stage as the approval condition; denies Edit/Write under
  `.praxis/approved/`; `ask` text no longer names `stage:` as the thing that unlocks building.
- `hooks/lib.sh` — `praxis_is_spec_side` excludes `.praxis/approved/`; helper `praxis_approved`.
- `.praxis/.gitignore` written by the hook that first creates `.praxis/` (`active-change`,
  `approved/`), same pattern as the memory capture hook.
- `commands/approve.md` + `scripts/approve.sh` — the person's explicit approval on hosts without
  `ask` (Codex) and for unattended runs: writes the marker. Typed by a person, not the model.
- Tests: `tests/hooks.test.mjs` (marker written only after a successful source edit at `designed`;
  not written for spec-side edits; pre-tool-use asks while the marker is missing regardless of
  `stage:`; Edit/Write to `.praxis/approved/` denied; `PRAXIS_FLOOR=off`), mutation-tested.
- Re-measure `evals/floor` `full-feature`: treatment, control, and a `pre-approved` arm whose
  fixture ships the marker.
### Out
- Bash-path writes to `.praxis/approved/` (documented gap, same class as DFU-5).
- Cursor (still no floor).

## Technical Design
```
first source edit, stage designed, no marker   → pre-tool-use: ask
   person approves → edit runs → post-tool-use: write .praxis/approved/<change>
   person denies   → nothing written; next edit asks again
   -p              → host refuses ask; nothing written; no build (PASS-stopped)
marker present                                  → allow, silently, whatever stage: says
Edit/Write targeting .praxis/approved/*         → deny ("the person writes this, via the ask or /praxis:approve")
/praxis:approve <change>                        → scripts/approve.sh writes the marker
```
`stage: planned` stays the human-readable record the model sets after approval; it no longer
unlocks anything.

## Edge Cases
- Marker exists but `design.md` was deleted: deny (design required) — the marker is not a bypass.
- Active change switched: the marker is per change; a new change asks again.
- `PostToolUse` also fires for `acceptEdits` auto-approved edits — only when the host auto-approved
  an `ask`, which the matrix showed it does not in `-p`. Recorded as observed, not documented.

## Acceptance (EAG)
- [x] `node --test tests/hooks.test.mjs` → mutation (post-tool-use writes nothing) → 53/55; restored → 60/60 with approve tests — PASS
- [x] `node --test tests/*.test.mjs` → tests 235, pass 235, fail 0 — PASS
- [x] `evals/floor` matrix v2 ($3.67): treatment 3/3 PASS-stopped, zero bypass attempts; control 0/3 stopped
      (1/3 wrote a design unprompted); pre-approved 2/2 PASS-built, floor silent — PASS
- [ ] `post-tool-use` writing the marker on a live human answer: preflight only, no interactive cell — GAP
- [ ] `hooks/stop` blocking: 0 blocks in 26 cells, never had cause — GAP
