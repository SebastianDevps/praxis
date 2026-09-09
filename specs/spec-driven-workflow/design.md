# Spec-Driven Workflow — Design

Reference: `calcom/cal.diy` (`specs/`, `agents/`, `.claude/`). Cloned and read on 2026-09-09.

## Overview
Every substantial piece of work Praxis touches leaves a folder `specs/<change>/` in the user's
repository: what was built, why, which alternatives were rejected, and how it was verified. The
mode dial decides how much of the folder is mandatory — never whether it exists. The same
convention scaffolds the project side (`AGENTS.md`, `agents/rules/`, `agents/knowledge-base.md`)
so that project knowledge and change history live in files the team commits, not in chat.

## Problem Statement
- Work done through Praxis today leaves no durable record per change. `PROGRESS.md` is one flat
  ledger, gitignored in this repo and unowned by any change; decisions live in commit bodies.
- `spec-lifecycle` already exists but is a single file per change, and two divergent templates
  (`templates/spec.md`, `skills/spec-lifecycle/templates/spec.md`) contradict each other.
- The measured evaluation (`docs/evaluacion-arquitectura-plugin.md`) recorded 0 Run Cards emitted
  in `full` mode across 8/8 cells. A prose rule saying "write a spec" has the same channel and
  the same expected outcome: ignored.
- cal.diy's spec system is opt-in by phrase. The requirement here is the opposite: always on,
  with a floor that scales with the mode, and that does not get in the way when the feature is
  already clear.

## User Stories
- As a developer in `full` mode, I want the agent to write `design.md` and stop for my review
  before it edits source, so that I approve the shape once and it builds without further ceremony.
- As a developer in `fast` mode, I want a rename to cost one short `implementation.md`, not a
  design document.
- As a teammate joining a repo, I want `specs/<change>/` and `agents/knowledge-base.md` to tell
  me what was decided and why, without reading the git log.
- As the plugin maintainer, I want the gate mutation-tested: remove it, watch the test fail.

## Scope
### In
- Folder-per-change spec contract, templates shipped in `specs/_templates/`.
- Mode-scaled minimums (`fast` / `full` / `deep`).
- Phase → file mapping wired into `docs/task-model.md`, the Run Card and the contract.
- `implementation.md` becomes the per-change ledger; `PROGRESS.md` becomes the index of changes.
- Project scaffold command (`/praxis:init`): `AGENTS.md` + `CLAUDE.md` symlink, `agents/rules/`
  with prefix convention, `agents/knowledge-base.md`, `agents/commands.md`, `.claude/rules` symlink.
- Enforcement floor: see ADR-003 (open decision).
- This repository dogfoods the contract: this folder is its first spec.
### Out
- Per-project mode persistence (the dial is global per user today; known defect, separate change).
- Public docs promotion (Mintlify-style `docs/<feature>.mdx`). Captured in `future-work.md`.
- Graduating `.praxis/memory` procedures into `agents/rules/`. Captured in `future-work.md`.
- Pruning any existing skill. Rejected earlier by the owner; not revisited here.

## Technical Design

### 1. Spec folder contract
```
specs/
  _templates/            shipped by the plugin, copied verbatim on first use
  <change-name>/         kebab-case, one per change
    implementation.md    ledger — stage:, tasks (phase:/state:), completed, blocked, notes
    design.md            source of truth — reviewed by the user before source is edited
    decisions.md         ADRs, written at decision time
    future-work.md       DFUs
    AGENTS.md (+CLAUDE.md symlink)   deep only — change-specific instructions
    docs/README.md + screenshots/    deep only, user-facing surface only
```
Stage machine lives in `implementation.md` frontmatter and stays one-step-at-a-time:
`new → designed → planned → implemented → shipped`. (`researched` is dropped: research is a
section of `design.md`, not a stage a folder can be in.)

### 2. Mode minimums
| File | `fast` | `full` | `deep` |
|---|---|---|---|
| `implementation.md` | ✓ Status + Completed + verify evidence | ✓ full ledger | ✓ |
| `design.md` | — | ✓ Overview, Problem, Scope, Technical Design, Acceptance | ✓ all sections |
| `decisions.md` | only if an alternative was rejected | when alternatives were weighed | ✓ ≥1 ADR + refuter verdicts |
| `future-work.md` | — | when a DFU was captured | ✓ |
| `AGENTS.md` | — | — | ✓ |
| `docs/` | — | — | ✓ when user-facing |

A question is answered in every mode and creates nothing. Trivial edits in `fast` still write
`implementation.md`: five lines, filled after the verify command runs.

### 3. Phase → file
| phase (task-model) | writes | who |
|---|---|---|
| define | `design.md` Problem, User Stories, Scope | orchestrator (`brainstorming` when ambiguous) |
| plan | `design.md` Technical Design + Acceptance; `decisions.md`; `implementation.md` tasks | orchestrator; `writing-plans` fills tasks |
| build | `implementation.md` task `state:` + Completed | engineer / backend / design / platform |
| verify | `implementation.md` verify evidence, PASS·FAIL·SKIP·GAP | the builder, then `reviewer` |
| review | `decisions.md` when a finding changed a decision | reviewer, refuters (`deep`) |
| ship | `docs/`, `future-work.md`, `stage: shipped` | `release-readiness` |

The Run Card gains one line so the spec is visible every turn:
```
RUN CARD — <task>
spec:     specs/<change>/   (stage: designed)
phase:    …
```
`full`/`deep`: the Run Card sets `Needs your decision` after `design.md` is written and STOPS.
That is the single approval point; after it, building is not interrupted again by the spec.

### 4. Ledger
`implementation.md` holds the task lines in the exact `docs/task-model.md` format. `PROGRESS.md`
shrinks to an index: one line per change with its stage and a link. `hooks/subagent-stop` counts
`state:` across `specs/*/implementation.md` instead of `PROGRESS.md`. One vocabulary, one owner
per file (ADR-002).

### 5. Project scaffold — `/praxis:init`
Creates, idempotently, only what is missing:
```
AGENTS.md                      project instructions (host-agnostic)
CLAUDE.md -> AGENTS.md
agents/README.md               index of rules by section
agents/rules/_sections.md      section order + impact
agents/rules/_template.md      title / impact / tags frontmatter, incorrect → correct example
agents/knowledge-base.md       domain facts, not code rules
agents/commands.md             build / test / dev commands the agent must use
specs/_templates/              copied from the plugin
.claude/rules -> ../agents/rules
```
Rule files follow cal.diy's prefix convention (`architecture-`, `quality-`, `data-`, `api-`,
`performance-`, `testing-`, `ci-`, `patterns-`, `reference-`). Claude Code loads `.claude/rules/*.md`
natively, so no Praxis hook injects them. `session-start` adds pointers (name + one line, never the
body, per `docs/context-delivery.md`) to `agents/knowledge-base.md` and `agents/commands.md`.

### 6. Runtime floor
Two candidates; the choice is ADR-003 and is open.

**A — prose only.** One rule per mode in `hooks/context/contract.md`, the Run Card `spec:` line,
nothing else. Keeps "No enforcement". Expected effect, from the measured evaluation: low.

**B — mechanical floor, scaled by mode (recommended).**
- `PreToolUse` on `Edit|Write|MultiEdit`: target outside `specs/`, `.praxis/`, `agents/` →
  `fast`: require `specs/<active>/implementation.md`; `full`/`deep`: require
  `specs/<active>/design.md` with `stage: designed` or later. Deny message names the exact file
  to create. `<active>` = `.praxis/active-change`, written when the spec folder is created;
  fallback: the most recently modified `specs/*/implementation.md`.
- `Stop`: if the working tree touches non-spec files and no `specs/*/implementation.md` changed
  in this session, block once with "record it in implementation.md" — the same GAP semantics
  the contract already uses.
- Both gates: shell, zero dependencies, mirrored in `hooks-codex.json` / `hooks-cursor.json` where
  the host supports the event; mutation-tested in `tests/hooks.test.mjs`.
- Identity change: `AGENTS.md` "No enforcement" → "A floor, not a ceiling"; `marketplace.json`
  "Primes, never blocks" rewritten. This is why the decision is the owner's.

### 7. Plugin surface touched
- `skills/spec-lifecycle/SKILL.md` — folder model, minimums table, stage in `implementation.md`.
- `skills/spec-lifecycle/templates/` and `templates/spec.md` — deleted; `specs/_templates/` is
  the single source (resolves the divergence recorded in the evaluation).
- `docs/task-model.md` — phase → file table; `PROGRESS.md` as index.
- `hooks/context/contract.md` — Run Card `spec:` line; one rule per mode.
- `hooks/subagent-stop`, `hooks/lib.sh` — count states across specs.
- `hooks/pre-tool-use`, `hooks/stop`, `hooks.json` (+codex, +cursor) — option B only.
- `commands/init.md` — new; `commands/feature.md`, `bug.md`, `refactor.md`, `design.md` and
  `pipelines/*.md` — `artifacts:` rows point to spec files.
- `agents/orchestrator.md`, `agents/engineer.md` — who writes which file.
- `AGENTS.md`, `README.md`, `.claude-plugin/marketplace.json`, `CHANGELOG.md`.
- `tests/hooks.test.mjs`, `tests/links.test.mjs`, `tests/memory.test.mjs`, `tests/invariants.test.mjs`.
- `evals/value/units.mjs` — one unit: "spec exists before first source edit", with control arm.

## Edge Cases
- Repo without `specs/`: the first deny copies the plugin's `_templates` into `specs/_templates/`
  and every deny step refers to that local copy, because a `-p` run cannot read the plugin dir
  (measured: 3 refusals in the first live cell). `session-start` never writes into the user's repo.
- The approval stop is mechanical too: with `stage: designed`, the first source edit answers
  `permissionDecision: ask`; approving the edit approves the design, and the model then sets
  `stage: planned`. Prose alone did not stop (first live cell: no Run Card, designed and built
  in one run). An unattended `-p` run must arrive with `stage: planned` (ADR-006).
- Several active changes: `.praxis/active-change` decides; the orchestrator switches it when the
  user names another change.
- Subagents: inherit the active change through `subagent-start`; only the orchestrator writes
  `design.md`/`decisions.md`; builders write `implementation.md`.
- A `fast` task that turns out substantial: the contract already says "classify what remains";
  reclassifying creates `design.md` and stops once.
- Hosts without `PreToolUse`/`Stop` (Gemini, Copilot): fall back to option A automatically; the
  README states which hosts have the floor.

## Acceptance (EAG)
- [x] `node scripts/validate-resources.mjs` → `59 passed, 0 failed` — PASS
- [x] `node --test tests/*.test.mjs` → `tests 222 · pass 222 · fail 0`; new tests: `_templates` integrity,
      `subagent-stop` counting across specs, links from contract to `docs/task-model.md` — PASS
- [x] Mutation: deny removed → `tests/hooks.test.mjs` 37/45; stop block removed → 43/45; restored → 49/49 — PASS
- [x] Live cells (`evals/floor`, n=3 per arm, $6.93): `design.md` before the first source edit in 3/3
      treatment runs, 0/3 controls — PASS. Recorded beside it: 3/3 unattended runs then set
      `stage: planned` themselves (ADR-006 consequences, DFU-4); interactive not measured — GAP
- [x] Live cell, `fast`, rename: `implementation.md` only, no `design.md`, 3/3 (control identical) — PASS
- [x] Live cell, a question: no `specs/` write, 3/3 — PASS
- [x] `/praxis:init` twice on an empty dir → 16 `create`, then 16 `keep`; `tests/init.test.mjs` 5/5 — PASS
- [ ] `hooks/stop` blocked in 0/18 cells: it never had cause to. Unobserved — GAP, not PASS
