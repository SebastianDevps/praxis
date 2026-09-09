# Matt Pocock Imports — Design

Reference set, read 2026-09-09: `mattpocock/skills` at `3cca18b` (2 commits after the SHA this repo
evaluated in August), `sandcastle`, `dictionary-of-ai-coding`, `evalite`, `ralph-workshop-repo-001/002`,
`ai-hero-cli`, `mise-en-place`, `total-typescript-monorepo`, `harness-claude-code-usage-repro`,
`slopwatch`, plus his 2026 writing (aihero.dev, AIE Europe talks, X). The prior plan in
`docs/plan-importacion-referentes.md` §1 was never executed: none of `tdd`, `codebase-design`,
`domain-modeling`, the git guard or "It's working if" exist in Praxis today.

## Overview
Praxis becomes the senior engineer the owner described: given a well-defined task it grills the
frontier once, designs at the seam, builds in vertical slices with red→green, reviews in a fresh
context on two axes, diagnoses bugs only from a red command, and reports like a senior. What is
imported from Matt is **method as text** plus two small mechanical gates; nothing that publishes,
commits, or owns the process for the user.

## Problem Statement
- Praxis has process (spec floor, modes, ledger, approval) but thin engineering method: no TDD
  discipline, no design vocabulary (seams, deep modules), a debugging skill that does not require a
  red command before a hypothesis, a reviewer with two quality axes but no spec axis, tasks not
  sized to a fresh context, and a loop runner without priorities or a re-scoping signal.
- Matt's repo is the densest public source of that method, and it is the opposite of Praxis on
  enforcement: zero hooks, zero evals. The two compose: his method inside Praxis's floor.

## Research (facts, with sources)
- `skills` barely moved since the August evaluation: 2 commits, `link-skills.sh` stops linking
  `misc/`. 37 skills, 25 promoted. The invariant "a user-invoked skill may call model-invoked ones,
  never the reverse" was violated in 6 places and fixed in unreleased changesets.
- Refactor was removed from the TDD loop in June 2026 "because agents essentially never performed
  it"; it lives in `code-review` with a 12-smell Fowler baseline. `docs/engineering/tdd.md:31`.
- `diagnosing-bugs`: "No red-capable command, no Phase 2"; 3–5 ranked hypotheses before probing;
  `[DEBUG-xxxx]` tagged logs; regression test before the fix only if a correct seam exists, and
  "if no correct seam exists, that itself is the finding".
- `grilling`: design tree, rounds, frontier; "finding facts is your job, never the user's"
  (subagents for facts); recommended answer per question; done when the frontier is empty.
- `to-tickets`: a slice is "a narrow but COMPLETE path through every layer … sized to fit in a
  single fresh context window"; wide refactors as expand–contract. Dictionary `Ticket.md`: the
  falsifiable size rule (sessions degrade → too big; setup dominates → too small).
- `codebase-design`: deep modules, interface = test surface, deletion test, "one adapter means a
  hypothetical seam, two means a real one", rejected framings named.
- `writing-for-agents`: context vs cognitive load, leading words, no negation, no-ops test,
  cache/sediment/sprawl, "It's working if" per skill (`.agents/writing-docs.md`).
- Dictionary triad: **Automated check** (deterministic, pass/fail) · **Automated review**
  (a judgment) · **Human review** ("reading the diff counts; reading the summary does not"); AX as
  the environment's fitness for agents.
- Loop lineage: ralph-workshop → `plans/backlog/prompt.md` (priority: bugfix → tracer bullet →
  polish → refactor; `HANG ON A SECOND` re-scoping) → sandcastle `simple-loop/prompt.md`. State
  lives in commit messages; three stop signals; the only hard cap is a counter outside the model.
- sandcastle's pipeline shape: plan (expensive model, 1 iteration) → implement (cheap model, many)
  → review **only if commits exist** → merge; `CODING_STANDARDS.md` loaded by the reviewer, never
  the implementer. In real use (`mise-en-place/.sandcastle/main.ts`) the review phase is commented
  out — recorded as counter-evidence.
- `harness-claude-code-usage-repro`: the senior bug report — thesis in the title, deterministic
  repro without credentials, exact lines, expected/actual table, why it escaped, which bug it is
  NOT, exit code as the assertion.
- Not usable: `slopwatch` (stubs, `throw new Error("not implemented")`), `mise-en-place` domain,
  `evalite` runner (Vitest, sqlite, Fastify) beyond its scorer contract, the `sandcastle` engine
  (Docker, worktrees, tsx), `git-guardrails` script (substring match; `echo "git push"` blocks).
- His own limits, stated: no enforcement, no evals ("you must be able to fail it" is Praxis's
  rule, not his), `/implement` commits without asking, tracker skills publish issues.

## Scope
### In — wave 1, method as text (no hooks)
- `skills/tdd/` (new, model-invoked): pre-agreed seams confirmed with the user, red→green, three
  anti-patterns (implementation-coupled, tautological, horizontal slicing), mocks only at system
  boundaries; `tests.md`, `mocking.md` references. Declared by `engineer`, `backend`, `platform`.
- `skills/codebase-design/` (new, model-invoked): the 7-term glossary with `Avoid`, 4 principles,
  rejected framings, `DESIGN-IT-TWICE.md` (parallel subagents design the interface differently,
  compare on depth/locality/seam). `strategy-compare` points here for code design.
- `brainstorming` ← grilling: design tree, rounds, frontier, facts via subagents, recommended
  answer per question, stop when the frontier is empty. Keeps one question at a time.
- `systematic-debugging` ← diagnosing-bugs: red-capable command before any hypothesis (the 10
  loop kinds, ordered), 3–5 ranked falsifiable hypotheses, `[DEBUG-xxxx]` tags with a cleanup
  grep, regression test only at a correct seam. `pipelines/bug.md` output contract = the senior
  bug report (title thesis, repro, expected/actual, why it escaped, what it is not, exit code).
- `writing-plans` + `docs/task-model.md` ← vertical slices sized to a fresh context, falsifiable
  acceptance per task ("the observation that would show it false"), expand–contract for wide
  refactors, the ticket-size rule, and the verify triad (automated check / automated review /
  human review) as the vocabulary for `verify:` lines and the four states.
- `agents/reviewer.md` ← two axes in separate subagents: **Standards** (Fowler 12 smells as the
  floor, `agents/rules/` as the repo's override, "skip what tooling already enforces") and **Spec**
  (against `specs/<change>/design.md`; no spec → GAP). Never merged or reranked. "Maintain
  balance"; "if the code is clean, say so and do nothing". The refactor `tdd` does not do lives here.
- `docs/skill-doctrine.md` + `templates/skill.md` ← writing-for-agents: leading words, positive
  prompting, the no-op test, cache/sediment/sprawl, and a required `## It's working if` section.
- `pipelines/refactor.md` ← Fowler: each step small enough that the program always works.
### In — wave 2, scaffold and loop
- `/praxis:init` ← `CONTEXT.md` (domain glossary, `Avoid` lists, "devoid of implementation
  details"), `AGENTS.md` as a **capabilities index** ("before writing new glue, check these"),
  the "proceed silently if a doc is missing" rule, and ADR gates in `decisions.md` guidance
  (hard to reverse · surprising without context · a real trade-off — all three or no ADR).
- `autonomous-loop` + `scripts/loop.sh` ← the 7-section prompt, priority order, one task per
  iteration, `HANG ON A SECOND` re-scoping, `ABORT` as a third signal with exit 1, typecheck+test
  before commit, state in the commit message and the ledger, iteration cap outside the model.
### Out (own specs, listed in `future-work.md`)
- Mechanical git guard on `Bash` in `pre-tool-use` (classified by executor, not substring).
- `validate-resources.mjs` requiring `## It's working if` (after wave 1 lands the sections).
- Invocation policy (`disable-model-invocation` for state-changing skills), measured with the
  routing audit before and after — not adopted blind; the owner rejected pruning earlier.
- Evalite's scorer contract and threshold for `evals/value`.
- Never: `implement`'s unprompted commit, tracker-publishing skills, sandcastle engine, slopwatch,
  `ask-matt` (Praxis has `using-praxis`), `teach`/`writing-*`/`wizard`/course tooling.

## Technical Design
Each import is a bounded edit to one resource, with the source cited in a comment-free "Adapted
from" line at the bottom (the repo's existing convention for Addy). New skills follow
`docs/skill-doctrine.md` (`Use when … — … NOT x (that is `sibling`)`) and get routing cases in
`evals/routing/cases/`. Agents declare new skills under `skills:`. Nothing here adds a hook.

Reviewer dispatch shape (from sandcastle + code-review):
```
diff = merge-base..HEAD, refuse empty
Standards subagent ← diff + Fowler baseline + agents/rules/*   (never the implementer)
Spec subagent      ← diff + specs/<change>/design.md          (missing → GAP)
report: ## Standards / ## Spec, findings cite rule, smell or spec line; no cross-axis ranking
```

## Edge Cases
- A repo without `agents/rules/`: Standards axis runs on the Fowler floor alone and says so.
- A `fast` change has no `design.md`: Spec axis reports GAP, not PASS.
- Grilling on a clear task: the frontier is empty at round 1; the skill exits without questions.
- Loop `ABORT` vs `HANG ON A SECOND`: abort ends the run (exit 1); hang-on re-scopes and continues.

## Acceptance (EAG)
- [x] `node scripts/validate-resources.mjs` → 61 passed; `node scripts/routing-audit.mjs` → PASS (6/6 rank-1 each) with
      `tdd` and `codebase-design` cases added (≥5 positives, ≥4 near-misses each)
- [x] `node scripts/boundary-audit.mjs` → 7 (no new description/body clashes)
- [x] `node --test tests/*.test.mjs` → 258/258; invariants pin the reviewer's two-axis rule and
      the red-command rule in `systematic-debugging`
- [x] `evals/value` unit `tdd` ($10.10 with red-first): vertical slicing 3/3 vs 0/3 — PASS; seams named and
      confirmed before the first test file 0/3 vs 0/3 — FAIL, recorded (ADR-006, DFU-6);
      n=3 vs control (skill directory removed)
- [x] `evals/value` unit `red-first`: red command before the first hypothesis 3/3 vs 2/3 — PASS (weak delta;
      the control already does it); ranked hypotheses 0/6 — GAP, task too small to need them. Original line: treatment shows a red command before its
      first hypothesis, n=3 vs control
- [x] `/praxis:init` on an empty repo also writes `CONTEXT.md` (7/7, mutation 5/7 → 7/7) and the capabilities section;
      second run is a no-op (`tests/init.test.mjs`)
- [x] `scripts/loop.sh` fixture: `ABORT` → exit 1; `HANG ON A SECOND` → next iteration runs (8/8, mutation 7/8 → 8/8)
