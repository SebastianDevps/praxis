---
title: Hook-Owned Approval
stage: implemented  # new → designed → planned → implemented → shipped
owner: Sebastian
---

# Hook-Owned Approval — Implementation

## Tasks
- [x] T01 · phase: build · state: done · post-tool-use hook, pre-tool-use gating on the marker, lib.sh helpers, .praxis/.gitignore, hooks.json ×2
      files:  hooks/post-tool-use, hooks/pre-tool-use, hooks/lib.sh, hooks/hooks.json, hooks/hooks-codex.json, tests/hooks.test.mjs
      verify: mutation — post-tool-use writes nothing → tests/hooks.test.mjs fails; restore → passes
- [x] T02 · phase: build · state: done · `/praxis:approve` command + script
      files:  commands/approve.md, scripts/approve.sh, tests/approve.test.mjs
      verify: script writes the marker for the named change and refuses an unknown change
- [x] T03 · phase: build · state: done · Prose: contract, using-praxis, spec-lifecycle, AGENTS.md, README, CHANGELOG, invariants
      files:  hooks/context/contract.md, skills/using-praxis/SKILL.md, skills/spec-lifecycle/SKILL.md, tests/invariants.test.mjs, AGENTS.md, README.md, CHANGELOG.md
      verify: node --test tests/*.test.mjs
- [x] T04 · phase: verify · state: done · Re-measure full-feature with a pre-approved arm
      files:  evals/floor/units.mjs, evals/floor/run.mjs, evals/floor/RESULTS.md
      verify: node evals/floor/run.mjs --unit full-feature --n 3

## Completed
- T01 · `hooks/post-tool-use` writes `.praxis/approved/<change>` after an approved source edit in full/deep;
  `pre-tool-use` asks until the marker exists regardless of `stage:`, denies Edit/Write to the marker, denies a
  marker without `design.md`. Evidence: mutation 1 (post-tool-use writes nothing) → 53/55; mutation 2
  (pre-tool-use ignores the marker) → 53/55; restored → 60/60 across hooks + approve tests.
- T02 · `scripts/approve.sh` + `commands/approve.md`. Evidence: mutation 3 (skip design check) → 4/5; restored → 5/5.
- T03 · contract, router and spec-lifecycle carry "the approval is a record the model cannot write" and
  "`stage: planned` unlocks nothing", pinned in invariants (mutations fail-then-pass ×2); AGENTS.md, README
  (9 commands), CHANGELOG updated. Evidence: `node --test tests/*.test.mjs` → tests 235, pass 235, fail 0.
- T04 · matrix v2, 8 cells, $3.67: treatment 3/3 PASS-stopped (one ask, refused, no retry, no `stage:` edit,
  no Bash/approve attempts); control 0/3; pre-approved 2/2 PASS-built with the floor silent. Table in
  `evals/floor/RESULTS.md`. Nothing contradicts the hook headers.

## Blocked
- none

## Session Notes
- Parent change `spec-driven-workflow` stays `implemented`; this one hardens its ADR-006.
- Known gaps, documented in the hook headers: Bash writes to `.praxis/approved/`; the model can run
  `scripts/approve.sh` itself through Bash — the command text tells it to wait, nothing mechanical does.
- 2026-09-09, post-release · `hooks/stop` blocked a turn that changed no source: the trigger was the
  five untracked evaluation documents in `docs/` and `untitled.md`, present since before this change.
  First live observation of the block (`evals/floor` had 0 in 26 cells) — PASS for the mechanism, and
  the "working tree ≈ session" looseness stated in the hook header seen in practice. Verify evidence:
  `git status --short | rg -v '^\?\? (docs/|untitled)'` → empty. Follow-up: `future-work.md` DFU-1.
