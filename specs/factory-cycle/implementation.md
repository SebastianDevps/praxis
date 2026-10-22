---
title: Factory Cycle
stage: planned      # new → designed → planned → implemented → shipped
owner: plugin owner
---

# Factory Cycle — Implementation

Design approved 2026-10-21 (`.praxis/approved/factory-cycle`). File formats: `design.md` appendix.
Diagrams and layouts: `architecture.md`. Waves run in order; tasks inside a wave touch disjoint
files and run in parallel without worktrees; the orchestrator commits per wave.

## Tasks

### Wave 1 — hooks ∥ roles
- [x] T01 · phase: build · state: done · Hooks: floor on `spec.md` (+ legacy `design.md`), builder barrier and round cap on Agent/SendMessage, ship gate on Bash, needs-human marker, markers denied to Edit/Write
      files:  hooks/lib.sh, hooks/pre-tool-use, hooks/post-tool-use, hooks/hooks.json, hooks/hooks-codex.json, tests/hooks.test.mjs
      verify: node --test tests/hooks.test.mjs (+ one mutation shown failing) · node --test tests/*.test.mjs
- [x] T02 · phase: build · state: done · Roles: spec-writer, builder, approver, lens-ui (new); refuters write `review/round-N/<lens>.md`; engineer narrowed to the fast path
      files:  agents/spec-writer.md, agents/builder.md, agents/approver.md, agents/lens-ui.md, agents/refuter-correctness.md, agents/refuter-security.md, agents/refuter-tests.md, agents/engineer.md
      verify: node scripts/validate-resources.mjs · node --test tests/*.test.mjs
- [ ] R01 · phase: review · state: pending · reviewer on the wave-1 diff (Standards + Spec vs design.md appendix)

### Wave 2 — orchestration ∥ commands
- [ ] T03 · phase: build · state: pending · Contract diet (kernel ≤40), `hooks/context/roles/*.md` (≤15 each), subagent-start injects role kernel + spec path, user-prompt-submit kernel + modes fast|full, `skills/factory/SKILL.md`, `agents/orchestrator.md` rewritten to the cycle
      files:  hooks/context/contract.md, hooks/context/roles/, hooks/subagent-start, hooks/user-prompt-submit, skills/factory/SKILL.md, agents/orchestrator.md, tests/invocation.test.mjs (if it asserts injection)
      verify: wc -l hooks/context/contract.md ≤ 40 · node --test tests/*.test.mjs
- [ ] T04 · phase: build · state: pending · Commands enter the cycle; approve ships needs-human; rework (new); worktree.sh (new); loop.sh drives the cycle
      files:  commands/feature.md, commands/bug.md, commands/refactor.md, commands/design.md, commands/approve.md, commands/rework.md, commands/loop.md, scripts/approve.sh, scripts/rework.sh, scripts/worktree.sh, scripts/loop.sh, tests/approve.test.mjs, tests/loop.test.mjs
      verify: node --test tests/*.test.mjs
- [ ] R02 · phase: review · state: pending · reviewer on the wave-2 diff

### Wave 3 — docs, templates, removal
- [ ] T05 · phase: build · state: pending · docs/cycle.md (replaces pipelines/), task-model modes fast|full, specs/_templates (spec.md, implementation.md), spec-lifecycle + using-praxis rewritten, README, CHANGELOG (0.10.0 unreleased), manifest without pipelines glob, pipelines/ removed, research dossier into docs/
      files:  docs/, specs/_templates/, skills/spec-lifecycle/SKILL.md, skills/using-praxis/SKILL.md, README.md, CHANGELOG.md, praxis.manifest.json, pipelines/ (removed)
      verify: node scripts/validate-resources.mjs · node scripts/routing-audit.mjs · node --test tests/*.test.mjs

### Wave 4 — proof
- [ ] T06 · phase: verify · state: pending · evals/cycle: fixture project + feature, 3 cells, assertions (subagents ≥ 4, barrier order, rounds ≤ 2, decision.md, stub gh after APPROVE), tokens vs praxis-full
      files:  evals/cycle/
      verify: evals/cycle/RESULTS.md with every EAG row in PASS · FAIL · SKIP · GAP
- [ ] R03 · phase: review · state: pending · refuter wave (correctness, security, tests) on the whole change, then ship

## Completed
- T01 hooks (2026-10-21): `praxis_spec_file`, ledger/round/decision helpers in `hooks/lib.sh:475-569`; `pre-tool-use` floor on spec file (:119), builder barrier + cap (:155-204), ship gate (:170, :205), main-thread SKIP-only review write (:226, Claude host only), needs-human deny (:251); `post-tool-use` decision record (:66-84). Matchers `Edit|Write|MultiEdit|Agent|SendMessage|Bash` (Codex: no SendMessage equivalent). `node --test tests/hooks.test.mjs` → 74/74 before, 87/87 after; mutation (cap off) → 85/87; restored 87/87. `node --test tests/*.test.mjs` → 304/308, 4 reds owned by T04 (gitignore expectation) and T05 (README inventory).
- T02 roles (2026-10-21): `agents/{spec-writer,builder,approver,lens-ui}.md` created; refuters write `review/round-N/<lens>.md`; engineer narrowed to the fast path. `node scripts/validate-resources.mjs` → 71 passed, 0 failed · `node scripts/routing-audit.mjs` → PASS (rank-1 EN 68.5, floor 65; worst new collision approver↔spec-writer 0.26, ceiling 0.38). Spec field renamed `status:` → `ready: false|true` (task-model retired `status`); appendix and role updated.

## Handoffs to later tasks
- T05: README agent count test expects 16 (`tests/manifest.test.mjs` ×2, `tests/references.test.mjs` ×1) — update the README table and list.
- T04 or T05: add `builder`, `approver` to `CODE_AGENTS` in `tests/references.test.mjs`.
- T05: the floor's deny message points at `specs/_templates/design.md` until the `spec.md` template exists (test accepts either); switch it when the template lands.
- T06: `evals/floor/units.mjs:102` mirrors `praxis_is_spec_side`; add `.praxis/needs-human/*`.
- T04: `tests/approve.test.mjs:65` expects `.praxis/.gitignore` = `mine\n`; the new `needs-human/`, `worktrees/` lines break it — fix the expectation with T01.

## Blocked
(none)

## Session Notes
- Research dossier (three reports with URLs and `file:line`): session scratchpad
  `/private/tmp/claude-501/-Users-sebasing-Projects-PluginClaude-praxis/606cb74a-2de7-4cf2-afd3-189b8ef711ed/scratchpad/dossier-factory-praxis-2026-10-21.md`; T05 copies it to `docs/research-factory-cycle.md`.
- Project-side harness engineering is the next change (`harness-quality`), pending the owner's sample code.
- Parallel writers share the working tree: disjoint file sets, no git mutations inside subagents.
