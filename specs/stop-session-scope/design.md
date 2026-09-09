# Stop Session Scope — Design

Parent: `specs/hook-owned-approval/` future-work DFU-1. Observed 2026-09-09 on this repo.

## Overview
`hooks/stop` decides "source changed this turn" from `git status`, so files that were already
dirty or untracked before the session count as this turn's work. `session-start` writes a
timestamp marker; `stop` counts only files newer than it. Same block, fewer false positives.

## Problem Statement
A turn that changed nothing was blocked because five untracked evaluation documents older than
the change sat in `docs/`. A floor that blocks on someone else's leftovers gets switched off.

## Scope
### In
- `hooks/session-start`: on `startup` and `clear`, write `.praxis/session-started` (empty file,
  its mtime is the marker); on `resume` and `compact`, leave it. Ensure `.praxis/.gitignore`
  lists it (the existing `praxis_ensure_praxis_dir` pattern).
- `hooks/stop`: a changed file counts only if it is newer than the marker (`-nt`); no marker →
  today's behaviour (working tree), so hosts without `session-start` lose nothing.
- `hooks/lib.sh`: `praxis_session_marker`, one helper both hooks share.
- Tests: marker written on startup, kept on resume; stop ignores an untracked file older than the
  marker and blocks on one newer; no marker → old behaviour. Mutation-tested.
### Out
- Per-file content diffing; a touched-but-unchanged file newer than the marker still counts
  (git status already filters unchanged tracked files).
- The `.praxis/memory` capture hook (untouched).

## Technical Design
```
session-start (startup|clear) → : > .praxis/session-started ; .praxis/.gitignore += session-started
stop: for each git-status path (source-side):  [ path -nt marker ] || skip
      ledger_touched likewise; marker missing → count everything (today)
```
Marker under `.praxis/` is spec-side: allowed writes, never gated, never committed.

## Edge Cases
- Marker newer than a file the model edited via Bash before `session-start` ran: impossible in
  order; `session-start` fires before any tool.
- Clock skew across a network filesystem: `-nt` compares mtimes on the same FS; documented, not
  handled.
- A second session in the same repo rewrites the marker; the first session's later stop may miss
  its own older edits. Accepted: one repo, one session is the common case.

## Acceptance (EAG)
- [ ] `node --test tests/hooks.test.mjs` → new cases pass; mutation: stop ignores the marker → fail; restore → pass
- [ ] `node --test tests/*.test.mjs` → all pass
- [ ] This repo, with the five untracked docs present: a no-op turn is not blocked; a turn that
      edits a source file without touching the ledger is blocked
