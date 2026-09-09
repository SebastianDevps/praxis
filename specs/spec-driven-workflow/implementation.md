---
title: Spec-Driven Workflow
stage: implemented  # new → designed → planned → implemented → shipped
owner: Sebastian
---

# Spec-Driven Workflow — Implementation

## Tasks
- [x] T01 · phase: plan · state: done · Decide ADR-003 (runtime floor: prose vs mechanical)
      files:  specs/spec-driven-workflow/decisions.md
      verify: ADR-003 has a Decision paragraph and the task list below matches it
- [x] T02 · phase: build · state: done · Evolve `spec-lifecycle` to the folder model; delete the two old templates
      files:  skills/spec-lifecycle/SKILL.md, templates/spec.md, skills/spec-lifecycle/templates/spec.md
      verify: node scripts/validate-resources.mjs && node --test tests/links.test.mjs
- [x] T03 · phase: build · state: done · `docs/task-model.md`: phase → file table; `PROGRESS.md` as index
      files:  docs/task-model.md
      verify: node --test tests/invariants.test.mjs
- [x] T04 · phase: build · state: done · Contract: Run Card `spec:` line + one rule per mode; resume reads `implementation.md`
      files:  hooks/context/contract.md, skills/using-praxis/SKILL.md
      verify: node --test tests/invariants.test.mjs tests/hooks.test.mjs
- [x] T05 · phase: build · state: done · `subagent-stop` counts states across `specs/*/implementation.md`
      files:  hooks/subagent-stop, hooks/lib.sh, tests/hooks.test.mjs, tests/memory.test.mjs
      verify: node --test tests/hooks.test.mjs tests/memory.test.mjs
- [x] T06 · phase: build · state: done · Runtime floor per ADR-003 (option B: hooks/pre-tool-use, hooks/stop, hooks.json ×2; Cursor is a GAP)
      files:  hooks/pre-tool-use, hooks/stop, hooks/hooks.json, hooks/hooks-codex.json, hooks/hooks-cursor.json
      verify: mutation — remove the gate → tests/hooks.test.mjs fails; restore → passes
- [x] T07 · phase: build · state: done · `/praxis:init` scaffold command
      files:  commands/init.md, scripts/init.sh, tests/init.test.mjs
      verify: run twice on an empty dir → scaffold present, second run is a no-op
- [x] T08 · phase: build · state: done · Agents and commands: who writes which spec file; pipelines point `artifacts:` at spec files
      files:  agents/orchestrator.md, agents/engineer.md, commands/*.md, pipelines/*.md
      verify: node --test tests/references.test.mjs tests/links.test.mjs
- [x] T09 · phase: build · state: done · Identity surfaces: AGENTS.md, README.md, marketplace.json, CHANGELOG.md
      files:  AGENTS.md, README.md, .claude-plugin/marketplace.json, CHANGELOG.md
      verify: node --test tests/manifest.test.mjs
- [x] T10 · phase: verify · state: done · Live cells with control (full feature, fast rename, question)
      files:  evals/floor/run.mjs, evals/floor/units.mjs, evals/floor/RESULTS.md
      verify: node evals/floor/run.mjs → results recorded, negatives included
      note:   evals/value/run.mjs runs in plan mode and cannot exercise Edit/Write hooks; own runner, control = PRAXIS_FLOOR=off

Waves: T01 → {T02, T03, T04, T05, T07} in parallel → {T06, T08} → T09 → T10.

## Completed
- Reference read: cal.diy `specs/`, `agents/`, `.claude/` (2026-09-09).
- `specs/_templates/` written; `design.md`, `decisions.md` for this change written.
- T01 · ADR-003 decided: mechanical floor (option 2). Evidence: `decisions.md` §ADR-003 Decision.
- T02 · `skills/spec-lifecycle/SKILL.md` folder model; both old templates deleted. Evidence:
  `node scripts/routing-audit.mjs` → PASS, spec-lifecycle rank unchanged; `node scripts/boundary-audit.mjs` → 7 clashes (baseline).
- T03 · `docs/task-model.md` phase → file table; `PROGRESS.md` is the index.
- T05 · `hooks/subagent-stop` counts across `specs/*/implementation.md`, `PROGRESS.md` fallback;
  helpers `praxis_project_root`, `praxis_spec_ledgers`, `praxis_active_change`, `praxis_ledger_stage` in `hooks/lib.sh`.
- T06 · `hooks/pre-tool-use` + `hooks/stop`, registered for Claude Code and Codex (Codex `apply_patch` parsed).
  Evidence: mutation — deny removed → `tests/hooks.test.mjs` 37/45 pass; stop block removed → 43/45; restored → 45/45.
  GAP: Cursor `stop` cannot block, `preToolUse` dialect unverified → not registered, prose applies.
- T07 · `commands/init.md`, `scripts/init.sh`, `scripts/init-assets/**`, `tests/init.test.mjs`.
  Evidence: double run → 16 `create` then 16 `keep`; mutation (overwrite) → 3/5 pass; restored → 5/5.
- T08 · orchestrator owns `design.md`/`decisions.md`; builders own `implementation.md`; pipelines and
  commands point `artifacts` at spec files; pipelines' Run Card line now `(spec · phase · approach · research · verify)`.
- T04 · contract + router carry the `spec:` line, the per-mode floor, "The floor is mechanical", the resume rule;
  `.cursor/rules/praxis.mdc` mirrors the prose (no floor claim: Cursor has no hooks for it). Ledger consumers
  (`writing-plans`, `subagent-driven-development`, `autonomous-loop`, `agentic-lifecycle`, `commands/loop.md`,
  `scripts/loop.sh`) point at `specs/<change>/implementation.md`. Evidence: invariants mutations fail-then-pass ×4.
- T09 · `AGENTS.md`, `README.md`, `marketplace.json`, `CHANGELOG.md` rewritten: "A floor, not a ceiling"; 8 commands.
- T10 · first live cell (full-feature, treatment): PASS-built, deny fired once, design before first source edit, $0.56.
  Two findings → ADR-006: deny pointed at the plugin path (3 refusals in `-p`) and the prose stop did not hold.
  Fixes in `hooks/pre-tool-use`: templates copied into `specs/_templates/` on first deny; `stage: designed` →
  `permissionDecision: ask` (Codex: deny). Evidence: mutation A (templates no-op) → 48/49; mutation B
  (designed allows) → 47/49; restored → 49/49; full suite → tests 220, pass 220, fail 0.
- T10 · matrix `node evals/floor/run.mjs --n 3` → 18 cells, $6.93, 21 min; table in `evals/floor/RESULTS.md`.
  full: 3/3 designs before first edit vs 0/3 control; fast: implementation.md only 3/3; question: nothing 3/3.
  NEGATIVE, recorded: 3/3 unattended full runs set `stage: planned` themselves after the refused ask
  (ADR-006 consequences; DFU-4 hardening). `hooks/stop` unobserved (0 blocks) — GAP.
- Build wave verified by the orchestrator: `node scripts/validate-resources.mjs` → 59 passed, 0 failed;
  `node --test tests/*.test.mjs` → tests 216, pass 216, fail 0. `git status` shows `crafts/` intact.
- Incident: `crafts/*.md` appeared deleted in the working tree mid-wave; no agent found the cause
  (no `rm`/`rmSync` in any new file). Restored with `git checkout -- crafts/`; re-check before commit.
- Incident: `specs/_templates/{implementation,decisions,future-work}.md` were overwritten by a failed
  heredoc of the orchestrator; restored to placeholders.

## Blocked
- none

## Session Notes
- Praxis facts that shaped this: no `PreToolUse`/`Stop` hooks exist (`hooks/hooks.json`);
  `PROGRESS.md` and `CONSTRAINTS.md` are gitignored on purpose (`.gitignore:22,27`); the mode
  dial is global per user (`hooks/lib.sh:55-60`).
- Pruning of skills was rejected by the owner earlier; this change adds no removal beyond the
  two duplicate templates.
