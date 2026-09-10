# Release 0.8.0 — Design

## Overview
Cut 0.8.0, and land one rule the eval runs earned.

## Problem Statement
`[Unreleased]` holds two feature changes since 0.7.0 — the investigation suite and comment
discipline — plus their fixes. Neither breaks a public surface, so SemVer puts this at a minor bump.

Separately, the T05 eval agent reported that it stopped a run with `pkill -f "claude -p"`, a pattern
broader than its own cells: it would have matched any concurrent non-interactive `claude` invocation
on the machine. No damage occurred, and the correct instrument (`TaskStop` on the task id) was the
one it used for the loop itself. That lesson currently lives in one change's ledger, where only
someone reading that file finds it. `crafts/orchestration` is the harness-engineering craft and is
the surface that reaches every dispatch.

## Scope
### In
- `crafts/orchestration/orchestration.md` — one rule: stop work by its task id, never by a
  command-line pattern.
- `CHANGELOG.md` — `[Unreleased]` becomes `## [0.8.0] — 2026-09-10`.
- The four manifests bumped to `0.8.0`, together, as the 0.7.0 cut did.
- Tag `v0.8.0` at the merge commit.
### Out
- Any change to what shipped. This is a version cut, not a revision.
- The `[Unreleased]` prose. It was written per change and stays as written.

## Technical Design
`.claude-plugin/plugin.json:3` and `.claude-plugin/marketplace.json:9,16` carry the version;
`tests/manifest.test.mjs` asserts they agree, so they move in one commit or the gate goes red.
The 0.7.0 precedent (`git show b9c7de5 --stat`) is a single `chore(release)` commit cutting the
heading and bumping the manifests — followed, not reinvented.

The orchestration rule is phrased in the positive, per `docs/skill-doctrine.md:196`: it says what to
stop by, not what to avoid.

## Acceptance
- [ ] `node scripts/validate-resources.mjs` → 0 failed
- [ ] `node --test tests/*.test.mjs` → 0 fail, `manifest.test.mjs` included
- [ ] `rg -n '"version"' .claude-plugin/*.json` → every hit reads `0.8.0`
- [ ] `node scripts/build-cursor-crafts.mjs` → no drift after the craft edit
- [ ] The tag points at the merge commit, verified with `git rev-parse v0.8.0^{commit}`
