---
title: Stop Session Scope
stage: shipped      # new → designed → planned → implemented → shipped
owner: Sebastian
---

# Stop Session Scope — Implementation

## Tasks
- [x] T01 · phase: build · state: done · session marker in session-start, stop scoped to it, lib helper, tests
      files:  hooks/session-start, hooks/stop, hooks/lib.sh, tests/hooks.test.mjs
      verify: node --test tests/hooks.test.mjs (mutation fail-then-pass) && node --test tests/*.test.mjs
- [x] T02 · phase: verify · state: done · Live check on this repo with the untracked docs present
      files:  specs/stop-session-scope/implementation.md
      verify: a no-op turn ends without a block; a source edit without ledger update is blocked once

## Completed
- Approval: the first Edit was answered with `ask`, the person approved, `.praxis/approved/stop-session-scope`
  written by `post-tool-use` (0 bytes, 09:12) — the floor's own flow, observed live for the first time. PASS.
- T01 · `praxis_session_marker`, `praxis_ensure_ignored` in lib.sh; `session-start` touches
  `.praxis/session-started` on `startup`/`clear`, leaves it on `resume`/`compact`; `stop` counts a
  git-status path only if `-nt` the marker, old behaviour without one. Evidence: mutation (stop ignores
  the marker) → `tests/hooks.test.mjs` 57/58; restored → 58/58; `node --test tests/*.test.mjs` → 238/238.
- T02 · working-tree `hooks/stop` run against this repo with the five untracked docs present, mtimes set
  with `touch -t`: marker 09:14, all files older → no block; `hooks/stop` at 09:15 → block; ledger at
  09:16 → no block. PASS. Two earlier attempts put the marker in the future and proved nothing —
  recorded so the method is not trusted blindly.
- GAP: the installed plugin in this session is the 0.6.0 marketplace copy, so the live `Stop` event
  still runs the unscoped hook until the next release is installed. Codex `session-start-codex` does
  not write the marker → whole-tree behaviour there, by design.

## Blocked
- none

## Session Notes
- Triggered by the first live `hooks/stop` block, recorded in specs/hook-owned-approval/implementation.md.
- 09:2x, after commit 
  `hooks/stop` (installed 0.6.0 copy) blocked again on the same five untracked docs — the false positive
  this change fixes, reproduced once more with the ledger clean. Working tree: only `?? docs/*`, `?? untitled.md`.
  Expected until 0.6.1 is installed. GAP for the installed copy; PASS for the working-tree hook (T02).
- Shipped as 0.6.1: PR #11 merged 2026-09-09T14:28:14Z (ab586ec), changelog heading via PR #12 (f2923f7),
  tag v0.6.1 → f2923f7, CI on main success. The installed 0.6.0 copy blocked this turn too (third time,
  same untracked docs); gone once 0.6.1 is installed.
