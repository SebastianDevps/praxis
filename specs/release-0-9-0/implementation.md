---
title: Release 0.9.0
stage: implemented  # new → designed → planned → implemented → shipped
owner: Sebastian
---

# Release 0.9.0 — Implementation

## Tasks
- [x] T01 · phase: ship · state: done · Cut 0.9.0 across the CHANGELOG and the manifests
      files:  CHANGELOG.md, .claude-plugin/plugin.json, .claude-plugin/marketplace.json
      verify: node --test tests/manifest.test.mjs; every version hit reads 0.9.0

## Completed
- Version chosen: a removal of a feature that shipped in 0.8.0, so minor rather than patch.

## Blocked
- none

## Session Notes
- The `[Unreleased]` prose was written when the removal shipped and stays as written.
- T01 · 0.9.0 cut. Evidence: `rg -n '"version"' .claude-plugin/*.json` → all three read 0.9.0;
  heading `## [0.9.0] — 2026-09-10`; `node --test tests/*.test.mjs` → 291/291;
  `validate-resources` → 67 passed, 0 failed — PASS. No prose touched.
