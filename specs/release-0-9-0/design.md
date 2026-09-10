# Release 0.9.0 — Design

## Overview
Cut 0.9.0. `[Unreleased]` holds one change: the `comment-discipline` craft was removed after two
measurements returned zero, and the T09 driver was repaired.

## Problem Statement
0.8.0 shipped the craft. Removing it changes what a user on 0.8.0 already has — a craft that was
injected into every builder dispatch stops being injected. That is observable, so the version has to
say so.

## Technical Design
**Why minor and not patch.** Under 0.x, SemVer leaves the meaning of a minor bump to the project.
This one removes a feature that shipped one version ago. A patch would read as "nothing you can
notice changed", which is false: the crafts count goes 7 → 6 and a body stops reaching every build
turn. The hook that shipped alongside it is untouched, so nothing a user relies on for the four
denied patterns changes.

`.claude-plugin/plugin.json:3` and `.claude-plugin/marketplace.json:9,16` move together, as
`tests/manifest.test.mjs` asserts they agree. Same shape as the 0.7.0 and 0.8.0 cuts: one
`chore(release)` commit cutting the heading and bumping the manifests, no prose touched.

## Acceptance
- [ ] `node scripts/validate-resources.mjs` → 0 failed
- [ ] `node --test tests/*.test.mjs` → 0 fail, `manifest.test.mjs` included
- [ ] `rg -n '"version"' .claude-plugin/*.json` → every hit reads `0.9.0`
- [ ] The tag points at the merge commit, verified with `git rev-parse v0.9.0^{commit}`
