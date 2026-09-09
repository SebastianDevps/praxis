# Hook-Owned Approval — Future Work

## Enhancements
- DFU-1: `hooks/stop` should scope "this session" tighter than the working tree. `session-start`
  can write `.praxis/session-started` (a timestamp file, gitignored); `stop` then counts only files
  newer than it, so pre-existing untracked files stop counting as this turn's source changes.
  Observed 2026-09-09: a no-op turn was blocked by untracked docs older than the change.

## Technical Debt
- Bash writes to `.praxis/approved/` and a model running `scripts/approve.sh` itself are outside the
  floor (headers say so).
