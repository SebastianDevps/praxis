---
title: Release 0.8.0
stage: implemented  # new → designed → planned → implemented → shipped
owner: Sebastian
---

# Release 0.8.0 — Implementation

## Tasks
- [x] T01 · phase: build · state: done · Orchestration rule: stop by task id
      files:  crafts/orchestration/orchestration.md
      verify: validate-resources; build-cursor-crafts → no drift
- [x] T02 · phase: ship · state: done · Cut 0.8.0 across the CHANGELOG and four manifests
      files:  CHANGELOG.md, .claude-plugin/plugin.json, .claude-plugin/marketplace.json
      verify: node --test tests/manifest.test.mjs; every version hit reads 0.8.0

## Completed
- Version chosen: two feature changes since 0.7.0, no breaking surface → minor bump.

## Blocked
- none

## Session Notes
- The rule exists because an eval agent reported its own overbroad `pkill` rather than leaving it in
  a transcript. It is recorded as a rule so the next driver does not repeat it.
- T01 · orchestration rule added, positive voice: stop by task id, and why a pattern is wider than
  the work you started. Evidence: `validate-resources` → `68 passed, 0 failed`;
  `build-cursor-crafts.mjs` regenerated, only `craft-orchestration.mdc` changed — PASS.
- T02 · 0.8.0 cut. Evidence: `rg -n '"version"' .claude-plugin/*.json` → all three read 0.8.0;
  CHANGELOG heading `## [0.8.0] — 2026-09-10`; `node --test tests/*.test.mjs` → 285/285 — PASS.
  No prose in the entry was touched: it was written per change and stays as written.
