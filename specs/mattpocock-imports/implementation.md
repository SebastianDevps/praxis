---
title: Matt Pocock Imports
stage: implemented  # new → designed → planned → implemented → shipped
owner: Sebastian
---

# Matt Pocock Imports — Implementation

## Tasks
- [x] T01 · phase: build · state: done · `skills/tdd/` + `tests.md`, `mocking.md`; routing cases; declared by engineer, backend, platform
      files:  skills/tdd/**, evals/routing/cases/tdd.yaml, agents/engineer.md, agents/backend.md, agents/platform.md
      verify: node scripts/validate-resources.mjs && node scripts/routing-audit.mjs && node scripts/boundary-audit.mjs
- [x] T02 · phase: build · state: done · `skills/codebase-design/` + `DESIGN-IT-TWICE.md`; `strategy-compare` points here
      files:  skills/codebase-design/**, evals/routing/cases/codebase-design.yaml, skills/strategy-compare/SKILL.md
      verify: same as T01
- [x] T03 · phase: build · state: done · `brainstorming` ← grilling (frontier, rounds, facts via subagents, recommended answer)
      files:  skills/brainstorming/SKILL.md
      verify: node --test tests/*.test.mjs
- [x] T04 · phase: build · state: done · `systematic-debugging` ← red-first, ranked hypotheses, tagged logs, seam rule; `pipelines/bug.md` senior report contract
      files:  skills/systematic-debugging/SKILL.md, pipelines/bug.md, commands/bug.md, tests/invariants.test.mjs
      verify: invariants pin "no red-capable command, no hypothesis"; mutation fail-then-pass
- [x] T05 · phase: build · state: done · `writing-plans` + `docs/task-model.md` ← vertical slices, falsifiable acceptance, expand–contract, verify triad
      files:  skills/writing-plans/SKILL.md, docs/task-model.md, tests/invariants.test.mjs
      verify: node --test tests/*.test.mjs
- [x] T06 · phase: build · state: done · `reviewer` ← Standards (Fowler floor + agents/rules) and Spec (design.md) in separate subagents; rules injected to reviewer only
      files:  agents/reviewer.md, hooks/subagent-start, hooks/lib.sh, tests/hooks.test.mjs, tests/invariants.test.mjs
      verify: invariants pin "never merged or reranked"; hooks test: rules reach reviewer, not engineer
- [x] T07 · phase: build · state: done · `docs/skill-doctrine.md` + `templates/skill.md` ← writing-for-agents; `## It's working if` in every new skill
      files:  docs/skill-doctrine.md, templates/skill.md, pipelines/refactor.md
      verify: node scripts/validate-resources.mjs
- [x] T08 · phase: build · state: done · `/praxis:init` ← CONTEXT.md glossary, capabilities index, proceed-silently rule, ADR three gates
      files:  scripts/init.sh, scripts/init-assets/**, specs/_templates/decisions.md, tests/init.test.mjs
      verify: node --test tests/init.test.mjs (double run, no-op)
- [x] T09 · phase: build · state: done · `autonomous-loop` + `scripts/loop.sh` ← 7-section prompt, priorities, HANG ON A SECOND, ABORT exit 1, gate before commit
      files:  skills/autonomous-loop/SKILL.md, scripts/loop.sh, commands/loop.md, tests/loop.test.mjs (new)
      verify: fixture: ABORT → exit 1; HANG ON → next iteration; mutation fail-then-pass
- [x] T10 · phase: verify · state: done · `evals/value` units `tdd` and `red-first`, n=3 vs control; README/CHANGELOG
      files:  evals/value/units.mjs, evals/value/RESULTS.md, README.md, CHANGELOG.md
      verify: node evals/value/run.mjs → results recorded, negatives included

Waves: {T01, T02, T03, T04, T05, T07} parallel (disjoint files; invariants.test.mjs edits serialized) → {T06, T08, T09} → T10.

## Completed
- Research: three parallel investigations (skills at HEAD, nine other repos, public doctrine) with sources;
  standing plan in `docs/plan-importacion-referentes.md` §1 confirmed unexecuted.
- Approval: first source edit answered with `ask`, approved by the person; `.praxis/approved/mattpocock-imports`
  written by post-tool-use at 10:03. Later agents' edits were silent.
- T01/T02 · `skills/tdd/` (+ references/tests.md, mocking.md) and `skills/codebase-design/` (+ DEEPENING, DESIGN-IT-TWICE);
  wired into engineer/backend/platform and strategy-compare; routing cases 6+5 each. Evidence: `routing-audit` → PASS,
  6/6 positives rank-1 for both, EN rank-1 69.3% (baseline 67.3%), pairwise collisions ≤0.12; `boundary-audit` → 7 right after.
- T03 · `brainstorming` ← frontier, rounds, facts via `scout`/`docs-seeker`, recommended answer, empty frontier exits.
- T04 · `systematic-debugging` gate "No red-capable command, no hypothesis." + loop kinds, ranked hypotheses,
  `[DEBUG-xxxx]`, seam rule; `pipelines/bug.md` senior report contract. Evidence: invariant mutation → `not ok 46`; restored → ok.
- T05 · `docs/task-model.md` owns the vertical-slice sentence, size rule, expand–contract, verify triad with a
  PASS/FAIL/SKIP/GAP table; `writing-plans` quotes and points. Evidence: mutations → `not ok 47`, `not ok 48`; restored → ok.
  `routing-audit` → PASS, rank-1 61.3% (baseline 59.4%); `boundary-audit` → 7.
- T07 · `docs/skill-doctrine.md` §4 (writing-for-agents), `templates/skill.md` `## It's working if`,
  `pipelines/refactor.md` Fowler step rule. Wording "ends with" softened to "carries" (scout has Anti-patterns after it).
- T08 · `/praxis:init` writes `CONTEXT.md` (glossary with `Avoid`), AGENTS.md `## Domain Language` + `## Capabilities`,
  ADR three gates in `specs/_templates/decisions.md`. Evidence: `tests/init.test.mjs` 7/7; mutation (overwrite) → 5/7; restored → 7/7.
- T09 · `scripts/loop.sh` seven-section prompt, priority order, `HANG ON A SECOND` continues, `ABORT` → 1, signals
  matched on their own line (`grep -qxE`), exit-code table 0/1/2/3/4; `autonomous-loop` and `commands/loop.md` mirror it.
  Found and fixed on the way: `failure_signature()` ignored HEAD, so a healthy loop halted as "no progress" on iteration 2.
  Evidence: `tests/loop.test.mjs` 8/8; mutation (substring match) → 7/8; restored → 8/8; `boundary-audit` → 7.
- T06 · `agents/reviewer.md` two axes in separate contexts (Standards: Fowler floor + `agents/rules/` + CONSTRAINTS;
  Spec: `design.md`, missing → GAP), fixed point, empty diff → SKIP, ≤400 words per axis, never merged or reranked;
  `hooks/subagent-start` injects rule pointers only to `reviewer` (`praxis_project_rules`). Evidence: mutation A
  (inject for every agent) → `not ok 28`; mutation B (drop both sentences) → `not ok 49/50`; restored → 258/258.
  `docs/task-model.md` GAP cell aligned with the design (missing `agents/rules/` is the Fowler floor, not a GAP).
  Agents interrupted by the session rate limit (T06, T10) were resumed with context intact.
- T10 · `evals/value` units `tdd` and `red-first`, scored from stream-json in `acceptEdits` (plan mode cannot fail
  a "stops before writing" claim). 12 cells + probe, $11.33. tdd: vertical slicing 3/3 vs 0/3 (the measured win);
  seam named-and-confirmed 0/3 vs 0/3 (NEGATIVE, ADR-006); no refactor in loop 6/6. red-first: red output before
  the first hypothesis 3/3 vs 2/3; ranked hypotheses 0/6 (task too small). Five scorer defects found by reading
  streams, fixed, re-scored at $0. Setup facts recorded: floor denies spec-less fixtures in both arms (driver sets
  PRAXIS_FLOOR=off); `-p` honours allow rules only from `.claude/settings.local.json`. README 40 skills, CHANGELOG entry.
  Final gates: validate-resources 61/0 · routing PASS · boundary 7 · `node --test tests/*.test.mjs` 258/258.

## Blocked
- none

## Session Notes
- Nine skill names in the first research brief did not exist in Matt's repo (they came from the Addy
  section of the old plan); the agent verified with `git log --all --diff-filter=A` and corrected it.
- Ship: committed on feat/mattpocock-imports, PR #13 opened. `hooks/stop` blocked this turn on the pre-existing
  untracked docs: the 0.6.1 hook needs `.praxis/session-started`, written at session start, and this session
  began before the reinstall — no marker, old behaviour. Expected until the next session.
