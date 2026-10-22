# Factory Cycle — Design

Parent: `specs/spec-driven-workflow/` (ADR-003 floor, ADR-006 ask) and `specs/hook-owned-approval/`.
Research: three reports dated 2026-10-21 (current flow with `file:line`, provenance of the factory
pattern, QM/Pi as substrate), collected in the session dossier; T05 copies it into `docs/`.

## Overview
Praxis runs every substantial change through one cycle: **spec → build → review (bounded) →
approve → ship**. Each role runs in its own context and talks to the others only through files
under `specs/<change>/`. The limits that must hold whatever the model does (one human approval,
the review barrier, the round cap, the ship gate) move into hooks. In the same change the spec
process goes on a diet: one spec file the builder reads, one ledger the orchestrator alone writes,
and a per-turn contract cut to its kernel.

## Problem Statement
Three measured problems with one cause: the agents spend their attention on process instead of
the task.

1. **The cycle stops at review.** No barrier waits for the reviewers, no cap bounds the fix rounds
   ("until green or escalate", `agents/orchestrator.md:116`), no approver re-runs the checks, and
   no ship step exists: `rg` over `scripts/ hooks/ agents/ commands/` finds no merge, push, or PR.
   `needs-human` is a Run Card line, not a record.
2. **The fan-out does not fire.** `subagents_spawned` is 0 in all 72 cells of
   `docs/eval-data/matriz.json`. Parallel review exists in prose (`agents/orchestrator.md:123-133`)
   and nowhere in evidence.
3. **The spec process taxes every turn and every subagent.** `hooks/context/contract.md` is 103
   lines / 921 words, injected on every prompt and into every subagent
   (`hooks/subagent-start:48-78`). A change carries up to four files, plus `AGENTS.md` and `docs/`
   in deep. `stage:` is written by the model and unlocks nothing
   (`skills/spec-lifecycle/SKILL.md:88-98`). Builders own the ledger per task and `hooks/stop`
   blocks on it. Cost on the matrix tasks: 1.08–1.40× baseline tokens. The clarifying question
   the ceremony was meant to buy fires 1/4 in `full` and 0/4 in `fast`.

## User Stories
- As the person driving, I want to hand a feature to the plugin and get back a PR that was
  specified, built, reviewed by lenses that did not write it, and approved by a role that re-ran
  the checks, with one approval from me and a visible stop when it needs me.
- As a builder subagent, I want one file that tells me what to build and how it is accepted, and
  nothing else in my context.
- As the owner of the plugin, I want the loop's limits to hold when the model ignores prose.

## Scope
### In
- **Roles** (`agents/`): `spec-writer` (new), `builder` (new; the cycle's implementer, `engineer`
  stays for the fast path), `approver` (new), lenses = `refuter-correctness`, `refuter-security`,
  `refuter-tests` (existing; now each writes a file per round) and `lens-ui` (new; wraps
  `design-review`, dispatched only when the diff touches UI paths).
- **Files per change**: `spec.md` (spec-writer writes, person approves), `implementation.md`
  (ledger; the orchestrator is its only writer), `review/round-N/<lens>.md` (one per lens; the
  barrier), `decision.md` (approver). `decisions.md` only when an ADR passes the three gates.
  `future-work.md`, `AGENTS.md`, `docs/` leave the minimums.
- **Hooks**: `pre-tool-use` keys the floor on `spec.md` (accepts `design.md` for existing
  changes); denies builder resume while `review/round-N/` is incomplete; denies a third fix round;
  gates `gh pr create` / `git push` of the change branch on `decision.md: APPROVE` plus every lens
  `PASS`. `post-tool-use` writes `.praxis/needs-human/<change>` when `decision.md` records
  ESCALATE. `subagent-start` injects a role kernel (≤15 lines) plus the spec path instead of the
  whole contract, crafts, and skill pointers. `user-prompt-submit` injects a kernel of ≤40 lines;
  the cycle itself lives in a `factory` skill loaded when a change starts.
- **Commands**: `/praxis:feature|bug|refactor|design` all enter the cycle with different
  spec-writer briefs. `/praxis:approve <change>` also ships a `needs-human` change.
  `/praxis:rework <change> "<note>"` (new) sends it back to the builder. `/praxis:loop` runs the
  same cycle unattended.
- **Modes**: `fast` (trivial path, unchanged) and `full` (the cycle). `deep` removed (ADR-004).
- **Models**: `model:` per role: `spec-writer` and `approver` `opus`, lenses `sonnet`, `builder`
  inherits. Pinned only after `evals/cycle` has run both ways.
- **Docs**: `docs/task-model.md` modes table; `docs/cycle.md` replaces `pipelines/*.md`;
  `specs/_templates/`; `skills/spec-lifecycle` and `skills/using-praxis` rewritten to the cycle;
  README and CHANGELOG.
- **Evals**: `evals/cycle`: fixture repo plus one feature; asserts dispatch count, barrier order,
  round cap, decision file, ship gate (stub `gh`), and tokens against today's `full`.
### Out
- QM or Pi as substrate. QM is YC's organisational harness with no pipeline or review primitive;
  Pi has no native subagents. Claude Code already covers fan-out, worktrees, resume with history,
  and hooks inside subagents.
- Project-side harness engineering (linters whose message carries the remediation, structural
  invariants as tests, `AGENTS.md` as an index, quality grades). Next change, once the owner shows
  the target code.
- The skills catalog. Routing, not pruning: a measured decision that stands.
- A Workflow-tool implementation of the cycle (ADR-002: deferred to an eval arm).
- The Cursor floor, and Bash-path forgery of markers (documented gap, unchanged class).

## Technical Design

### The cycle
```
/praxis:feature "<request>"
 orchestrator  writes .praxis/active-change · specs/<c>/implementation.md (stage: new)
 spec-writer   fresh context · reads repo + request · writes specs/<c>/spec.md
               Goal · Scope in/out · Acceptance (runnable checks) · Approach · Open questions [NEEDS CLARIFICATION]
 orchestrator  open questions → ask ONE, stop · none → Run Card `Needs your decision`
 person        first source edit asks → .praxis/approved/<c>    |  /praxis:approve <c>
 builder       worktree, branch praxis/<c> · reads spec.md ONLY · TDD · commits · report in its handback
 orchestrator  ledger stage: built, round: N · writes review/round-N/lenses (one lens name per line)
 lenses        ONE message, N Agent calls · fresh context: spec.md + diff · each writes review/round-N/<lens>.md
               verdict: PASS | CHANGES · findings with file:line · "what I tried to break" (mandatory, also on PASS)
 barrier       every name in lenses has its file   ← hook denies builder resume until then
 any CHANGES   round < 3 → SendMessage to the builder with the CHANGES files → round N+1
               round 3 would start → hook denies → ESCALATE
 all PASS      approver, fresh context · spec + diff + all reviews · RUNS the acceptance checks itself → decision.md
 APPROVE       push praxis/<c> · gh pr create   ← hook allows only with APPROVE + all PASS · stage: shipped
 ESCALATE      .praxis/needs-human/<c> (hook) · Run Card `Needs your decision`
               /praxis:approve <c> → ship   ·   /praxis:rework <c> "<note>" → builder, round counter reset
```

### Roles
| role | context | reads | writes | model |
|---|---|---|---|---|
| orchestrator | main thread | everything | `implementation.md`, `review/round-N/lenses`, `.praxis/active-change` | session |
| spec-writer | fresh | repo, request, project rules | `spec.md` | opus |
| builder | fresh, worktree | `spec.md`; on resume the CHANGES files | source, tests, commits | inherit |
| lens ×N | fresh | `spec.md`, diff, project rules | `review/round-N/<lens>.md` | sonnet |
| approver | fresh | `spec.md`, diff, every review | `decision.md` | opus |

Only the orchestrator writes the ledger. Only the person writes the two markers. The orchestrator
passes paths, never content: a role reads its files itself.

### Files per change
```
specs/<change>/
  spec.md              spec-writer → person approves → builder, lenses, approver read it
  implementation.md    orchestrator only: stage, round, lenses, tasks, decision, session notes
  review/round-1/      lenses · correctness.md · security.md · tests.md [· ui.md]
  review/round-2/      same shape; round-3 never exists
  decision.md          approver: APPROVE | ESCALATE, with every check it ran and its output
  decisions.md         only when an ADR passes the three gates
```

### Hooks
| event | today | after |
|---|---|---|
| PreToolUse Edit/Write | floor on `design.md`; ask until marker | floor on `spec.md` (legacy `design.md` accepted); same marker; main thread may write under `review/round-*/` only a file whose verdict is `SKIP` |
| PreToolUse Agent / SendMessage | — | deny builder resume while `review/round-N/` is incomplete; deny any builder dispatch that would open round 3 |
| PreToolUse Bash `gh pr create`, `git push` of `praxis/<c>` | — | allow only with `decision.md: APPROVE` and every lens `PASS` |
| PostToolUse Write | writes `.praxis/approved/<c>` | also writes `.praxis/needs-human/<c>` on `decision.md: ESCALATE` |
| SubagentStart | contract + crafts + skill pointers, every subagent | role kernel ≤15 lines + `spec.md` path; lenses and approver also get project rules |
| UserPromptSubmit | 103-line contract | ≤40-line kernel; the `factory` skill carries the cycle |
| Stop | block once until the ledger was touched | unchanged |

### Contract diet
Stays in the kernel: classify (trivial / substantial), research before deciding, one question,
one approval, verify with the four states, delegate. Moves to the `factory` skill, loaded on
`/praxis:*` or when the orchestrator opens a change: the cycle, the Run Card, the files, the
resume rules. Leaves the per-turn text: the spec-lifecycle paragraphs, the ladder, the crafts
list. Crafts stay as files and reach only the roles they govern.

### Modes
| mode | path |
|---|---|
| `fast` | trivial: edit + verify; floor = `implementation.md` (unchanged) |
| `full` | the cycle: define → plan → build → verify → review → ship |

### Compatibility
Existing `specs/*/design.md` keep working: the floor accepts either name. No migration of closed
changes. `/praxis:mode deep` maps to `full` with a notice for one release.

## Edge Cases
- The builder cannot be resumed (subagent gone): dispatch a fresh `builder` with `spec.md` plus
  the CHANGES files; the round counter does not change.
- A lens never writes its file (hung, `maxTurns`): the orchestrator writes `<lens>.md` with
  `verdict: SKIP` and the reason, the only review write the main thread may do. The approver sees
  the SKIP; the ship gate treats SKIP as not PASS, so the change escalates.
- The diff touches UI paths (`components/`, `*.tsx`, `*.vue`, `*.css`): `lens-ui` joins the
  round. Otherwise it does not exist for the change.
- The spec-writer judges the request trivial: it returns `trivial: true`; the orchestrator takes
  the fast path and writes no cycle files.
- Unattended (`-p`, `loop.sh`): the ask is refused, so the run stops as today;
  `/praxis:approve` pre-approves; the ship gate still needs APPROVE in a file.
- Two orchestrators on one change: not handled; documented, as in the factory lineage.

## Acceptance (EAG)
Runnable checks. Each must be green before `stage: implemented`. Four states: PASS · FAIL · SKIP · GAP.

- [ ] `node --test tests/*.test.mjs` → all pass. New cases: a builder dispatch that would open
      round 3 is denied; builder resume is denied while a lens file is missing; `gh pr create` is
      denied without APPROVE and allowed with APPROVE + all PASS; legacy `design.md` satisfies the
      floor; SubagentStart output for `builder` is ≤15 lines plus the spec path.
- [ ] `wc -l hooks/context/contract.md` → ≤ 40
- [ ] `evals/cycle`, 3 cells on the fixture feature: `subagents_spawned ≥ 4`; every
      `review/round-1/*.md` exists before any builder resume (transcript order); rounds ≤ 2;
      `decision.md` present; the stub `gh` is invoked only after APPROVE.
- [ ] `evals/cycle` tokens on the 4 matrix tasks ≤ today's `praxis-full` ratios
      (1.31 / 1.29 / 1.17 / 1.12 vs baseline).
- [ ] Trap task: asked ≥ 2/4 via the spec-writer's `[NEEDS CLARIFICATION]` (today 1/4).
- [ ] Reported as GAP, not hidden: a live `ask` answered by a person, and `hooks/stop` under `-p`,
      stay unmeasured, as in `evals/floor`.

## Appendix: file formats (the contract between hooks, roles, and templates)

Approved 2026-10-21 (owner: "GO"; marker written via `scripts/approve.sh`). Every task reads
these; none redefines them.

```
specs/<c>/spec.md                         writer: spec-writer
---
title: <change>
ready: false | true                     # true = no open questions left
---
# <Change> — Spec
## Goal
## Scope
### In
### Out
## Acceptance
- [ ] `<command>` → <expected output>     # runnable; the approver executes these
## Approach                               # files/modules and the seam; no code
## Open questions
- [NEEDS CLARIFICATION] <question>        # empty when ready: true

specs/<c>/implementation.md               writer: orchestrator ONLY
---
title: <change>
stage: new | designed | planned | implemented | shipped | needs-human
round: 0                                  # 0 = no review yet; set to N when round N's lenses are dispatched
builder: <agent id>                       # set when the builder is dispatched; SendMessage target
lenses: correctness, security, tests      # + ui when the diff touches UI paths
owner: <who decides>
---
(body as today: Tasks · Completed · Blocked · Session Notes)

specs/<c>/review/round-N/lenses           writer: orchestrator — one lens name per line, written before dispatch
specs/<c>/review/round-N/<lens>.md        writer: that lens — lens ∈ correctness | security | tests | ui
---
lens: <lens>
round: N
verdict: PASS | CHANGES | SKIP            # SKIP only by the orchestrator, when the lens never returned
---
## Findings
- `path/file.ts:42` — <finding> — severity: blocking | important | minor
## What I tried to break                  # mandatory, also on PASS; a PASS without it is treated as SKIP
- <attempt> → <result>

specs/<c>/decision.md                     writer: approver (or approve.sh for the human override)
---
verdict: APPROVE | ESCALATE | APPROVE (human)
round: N
---
## Checks run
- `<command>` → <output>                  # the approver's own runs, never the builder's report
## Reason

.praxis/approved/<c>                      empty file · post-tool-use or approve.sh · never Edit/Write
.praxis/needs-human/<c>                   empty file · post-tool-use on ESCALATE · removed by rework.sh / approve.sh
.praxis/worktrees/<c>/                    builder checkout · branch praxis/<c> · created by scripts/worktree.sh
```

Hook rules on these files:

```
builder dispatch (Agent subagent_type ~ builder) or resume (SendMessage to = ledger.builder):
  round = 0                                   → allow
  round = N ≥ 1, review/round-N incomplete     → deny  "barrier: waiting for <missing>"
  round = N, complete, all PASS                → allow
  round = N, complete, any CHANGES, N < 2      → allow  (the fix round)
  round = 2, complete, any CHANGES/SKIP        → deny  "round cap: 2 rounds done → approver / ESCALATE"
ship (Bash: `gh pr create`, or `git push` naming praxis/<c>):
  decision.md verdict APPROVE (human)          → allow
  decision.md verdict APPROVE, round complete, all PASS → allow
  anything else                                → deny  with the reason
decision.md written with verdict ESCALATE      → post-tool-use creates .praxis/needs-human/<c>
decision.md written with verdict APPROVE*      → post-tool-use removes .praxis/needs-human/<c>
Edit/Write to .praxis/approved/* or .praxis/needs-human/*  → deny
```
