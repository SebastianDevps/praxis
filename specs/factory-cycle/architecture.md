# Factory Cycle — Architecture

Companion to `design.md`. Diagrams and layouts of the plugin after this change, a worked use
case, and the split between what the harness owns and what the model owns.

## 1. System view

```
┌──────────────────────────────────── PERSON ─────────────────────────────────────┐
│  /praxis:feature "…"      approve: the ask | /praxis:approve <c>                  │
│  /praxis:rework <c> "…"   merge the PR on GitHub                                  │
└────────────────────────────────────────┬────────────────────────────────────────┘
                                         │ one approval per change · one stop when it needs you
┌────────────────────────────────────────▼────────────────────────────────────────┐
│  ORCHESTRATOR  (main thread)                                                     │
│  context: kernel ≤40 lines every turn · `factory` skill once a change opens      │
│  writes:  .praxis/active-change · specs/<c>/implementation.md                    │
│           specs/<c>/review/round-N/lenses                                        │
│  does:    dispatch roles · pass PATHS, never content · read verdicts · Run Card   │
└───────┬──────────────────┬──────────────────────┬──────────────────────┬────────┘
        │                  │                      │                      │
┌───────▼───────┐  ┌───────▼────────┐  ┌──────────▼──────────┐  ┌────────▼────────┐
│ spec-writer   │  │ builder        │  │ lenses ×N           │  │ approver        │
│ opus · fresh  │  │ inherit · fresh│  │ sonnet · fresh each │  │ opus · fresh    │
│ reads: repo,  │  │ cwd: worktree  │  │ reads: spec.md,     │  │ reads: spec.md, │
│  request,     │  │ reads: spec.md │  │  diff, project rules│  │  diff, reviews  │
│  project rules│  │  (+CHANGES on  │  │ writes:             │  │ RUNS the checks │
│ writes:       │  │   resume)      │  │  review/round-N/    │  │ writes:         │
│  spec.md      │  │ writes: source,│  │  <lens>.md          │  │  decision.md    │
│               │  │  tests, commits│  │                     │  │                 │
└───────────────┘  └────────────────┘  └─────────────────────┘  └─────────────────┘
        ▲ SubagentStart injects: role kernel ≤15 lines + the spec path (+ rules for lenses/approver)
┌─────────────────────────────────────────────────────────────────────────────────┐
│  HARNESS  (deterministic · shell · no LLM)                                       │
│  pre-tool-use      floor on spec.md · review barrier · round cap · ship gate     │
│  post-tool-use     .praxis/approved/<c> · .praxis/needs-human/<c>                │
│  subagent-start    role kernel injection                                         │
│  user-prompt-submit kernel + mode dial        stop  ledger touched               │
│  scripts/          worktree.sh · approve.sh · rework.sh · loop.sh (unattended)   │
│  evals/cycle       proves barrier · cap · ship gate · token cost                 │
│  tests/            mutation-tested hook behaviour                                │
└─────────────────────────────────────────────────────────────────────────────────┘
┌─────────────────────────────────────────────────────────────────────────────────┐
│  STATE  (files · one writer each)                                                │
│  specs/<c>/spec.md  implementation.md  review/round-N/*.md  decision.md          │
│  .praxis/active-change  approved/<c>  needs-human/<c>  worktrees/<c>             │
│  git: branch praxis/<c> · PR on origin                                           │
└─────────────────────────────────────────────────────────────────────────────────┘
```

Three properties the picture enforces:

- **One writer per file.** The orchestrator never writes a review or a decision; a role never
  writes the ledger; nobody but the person writes the markers.
- **Paths, not content.** The orchestrator's context carries file names and verdicts. A role
  reads what it needs from disk.
- **Limits below the model.** Approval, barrier, round cap, ship gate, and injection size are
  shell decisions; the model cannot talk its way past them.

## 2. Use case: "Export invoices to CSV" in a NestJS service

Mode `full`. Project rules in `agents/rules/`. Lenses: correctness, security, tests (no UI paths
touched, so `lens-ui` does not join).

```
 person        orchestrator        harness            spec-writer   builder     lenses×3    approver    git/gh
   │ /praxis:feature "export invoices to CSV, filtered by date, respecting tenant scope"
   ├──────────────►│
   │               │ writes .praxis/active-change = export-invoices-csv
   │               │ writes specs/export-invoices-csv/implementation.md  (stage: new)
   │               │ Agent(spec-writer, paths: request, rules)
   │               ├────────────────────────────────────────────►│
   │               │                                             │ reads invoices module, tenant guard, existing exporters
   │               │                                             │ writes spec.md: Goal · Scope · Acceptance (runnable) ·
   │               │                                             │   Approach · [NEEDS CLARIFICATION] date range inclusive?
   │               │◄────────────────────────────────────────────┤ handback: 1 open question
   │ "¿rango de fechas inclusivo en ambos extremos?"             │
   │◄──────────────┤  (ONE question · STOP)
   │ "sí, inclusivo"│
   ├──────────────►│ SendMessage(spec-writer, answer) → spec.md updated, no open questions
   │               │ Run Card: Needs your decision  (spec.md ready)
   │               │ ledger stage: designed
   │ /praxis:approve export-invoices-csv      (or: answer the ask on the first source edit)
   ├──────────────►│───────────────────►│ approve.sh writes .praxis/approved/export-invoices-csv
   │               │ scripts/worktree.sh → .praxis/worktrees/export-invoices-csv  branch praxis/export-invoices-csv
   │               │ Agent(builder, cwd: worktree, path: spec.md)
   │               ├──────────────────────────────────────────────────────────►│
   │               │                    │ pre-tool-use: spec.md exists · marker exists → source edits allowed
   │               │                                                           │ red test → CsvExportService → green
   │               │                                                           │ controller GET /invoices/export · tenant guard
   │               │                                                           │ commits on praxis/export-invoices-csv
   │               │◄──────────────────────────────────────────────────────────┤ handback: report + commit range
   │               │ ledger: stage implemented · round 1 · builder: <agent-id>
   │               │ writes review/round-1/lenses = correctness, security, tests
   │               │ ONE message · 3 Agent calls (paths: spec.md, diff main...praxis/<c>, rules)
   │               ├───────────────────────────────────────────────────────────────────►│
   │               │                                                                     │ correctness.md  PASS  (tried: empty range, 10k rows, UTF-8 names)
   │               │                                                                     │ security.md     CHANGES (tenant filter bypass via ?tenantId=)
   │               │                                                                     │ tests.md        CHANGES (no test for cross-tenant request)
   │               │◄───────────────────────────────────────────────────────────────────┤
   │               │ barrier: 3/3 files present  → pre-tool-use allows builder resume
   │               │ SendMessage(builder: "round 1 CHANGES: review/round-1/security.md, tests.md")
   │               ├──────────────────────────────────────────────────────────►│
   │               │                                                           │ removes query override · adds cross-tenant 403 test · commit
   │               │◄──────────────────────────────────────────────────────────┤
   │               │ ledger: round 2 · writes review/round-2/lenses
   │               ├───────────────────────────────────────────────────────────────────►│
   │               │                                                                     │ 3× PASS, each with "what I tried to break"
   │               │◄───────────────────────────────────────────────────────────────────┤
   │               │ Agent(approver, paths: spec.md, diff, review/round-*/ )
   │               ├──────────────────────────────────────────────────────────────────────────────►│
   │               │                                                                                │ runs: npm test · npm run lint · the spec's Acceptance commands
   │               │                                                                                │ writes decision.md: APPROVE + the outputs
   │               │◄──────────────────────────────────────────────────────────────────────────────┤
   │               │ Bash: git push -u origin praxis/export-invoices-csv && gh pr create …
   │               │───────────────────►│ pre-tool-use ship gate: decision.md APPROVE ∧ round-2 all PASS → allow
   │               ├────────────────────────────────────────────────────────────────────────────────────────►│ PR #142
   │               │ ledger: stage shipped · PR url
   │◄──────────────┤ Run Card: ship · "PR #142 open · 2 rounds · 1 question · 5 subagents"
   │ reviews and merges on GitHub
```

The same request on the ESCALATE path:

```
 round 2: security.md CHANGES again (same finding, different file)
 orchestrator: a third round would start → pre-tool-use DENIES the builder dispatch
 orchestrator: Agent(approver) anyway → decision.md: ESCALATE (reason: unresolved tenant scope after 2 rounds)
 post-tool-use: writes .praxis/needs-human/export-invoices-csv
 Run Card: Needs your decision · "2 rounds · security lens still CHANGES · worktree kept"
 person:  /praxis:rework export-invoices-csv "scope by tenant in the repository, not the controller"
            → round counter reset · builder resumed with the note · cycle continues
      or: /praxis:approve export-invoices-csv  → ship with decision: APPROVE (human) · PR opens
```

## 3. State of a change

```
            spec-writer done          person approves            builder done
  new ───────────────────► designed ───────────────────► planned ─────────────► implemented
                                   (ask | approve.sh writes                        │
                                    .praxis/approved/<c>)                           │ round 1
                                                                                    ▼
                                                        ┌────────────── review/round-N ──────────────┐
                                                        │ barrier: every lens file present           │
                                                        │   all PASS ──────────────► approver        │
                                                        │   any CHANGES, N<3 ──────► builder resume ─┘ round N+1
                                                        │   N would be 3 ──────────► ESCALATE (hook)
                                                        └────────────────────────────────────────────┘
                                                                     │                    │
                                                           decision APPROVE        decision ESCALATE
                                                                     │                    │
                                                                     ▼                    ▼
                                                                  shipped            needs-human
                                                              (push + PR)      ┌──── /praxis:rework ──► implemented (round 1)
                                                                               └──── /praxis:approve ─► shipped
```

`stage:` in the ledger is the human-readable mirror of this machine. It unlocks nothing; the
markers and the review files do.

## 4. Plugin layout after the change

`NEW`, `CHANGED`, `REMOVED`; unmarked entries are untouched.

```
praxis/
├── agents/
│   ├── orchestrator.md          CHANGED  the cycle; paths not content; sole ledger writer
│   ├── spec-writer.md           NEW      opus · spec.md with runnable Acceptance · [NEEDS CLARIFICATION]
│   ├── builder.md               NEW      cycle implementer · worktree · reads spec.md only · TDD
│   ├── approver.md              NEW      opus · re-runs checks · decision.md
│   ├── lens-ui.md               NEW      wraps design-review · only when the diff touches UI paths
│   ├── refuter-correctness.md   CHANGED  lens: writes review/round-N/correctness.md · "tried to break" mandatory
│   ├── refuter-security.md      CHANGED  lens: security.md
│   ├── refuter-tests.md         CHANGED  lens: tests.md
│   ├── engineer.md              CHANGED  fast path only (trivial edits); no longer the cycle's builder
│   ├── reviewer.md                       on-demand review outside the cycle
│   └── researcher.md · analyst.md · design.md · backend.md · platform.md · security.md
├── commands/
│   ├── feature.md · bug.md · refactor.md · design.md   CHANGED  each enters the cycle with its own spec-writer brief
│   ├── approve.md               CHANGED  approves spec.md; ships a needs-human change
│   ├── rework.md                NEW      sends a needs-human change back to the builder with a note
│   ├── loop.md                  CHANGED  unattended runner of the same cycle
│   └── mode.md · init.md · investigate.md · learn.md
├── crafts/                               unchanged files; injected only to the roles they govern
├── docs/
│   ├── cycle.md                 NEW      the cycle, roles, files, hook decisions (replaces pipelines/)
│   ├── task-model.md            CHANGED  modes: fast | full
│   ├── research-factory-cycle.md NEW     the three research reports with sources
│   └── adversarial-review.md · context-delivery.md · skill-doctrine.md · …
├── evals/
│   ├── cycle/                   NEW      fixture project · 3 cells · RESULTS.md (dispatch, barrier, cap, ship, tokens)
│   └── floor/ · routing/ · value/
├── hooks/
│   ├── context/
│   │   ├── contract.md          CHANGED  kernel ≤40 lines
│   │   └── roles/               NEW      spec-writer.md · builder.md · lens.md · approver.md (≤15 lines each)
│   ├── pre-tool-use             CHANGED  floor on spec.md (+legacy design.md) · barrier · round cap · ship gate · SKIP-only review write
│   ├── post-tool-use            CHANGED  + needs-human marker
│   ├── subagent-start           CHANGED  role kernel + spec path instead of contract + crafts + skill pointers
│   ├── user-prompt-submit       CHANGED  kernel; mode dial fast | full
│   ├── stop · session-start · subagent-stop
│   ├── hooks.json · hooks-codex.json · hooks-cursor.json
│   └── lib.sh                   CHANGED  praxis_spec_file (spec.md|design.md) · lens set · round count · ship-gate check
├── pipelines/                   REMOVED  (five prose files folded into docs/cycle.md and skills/factory)
├── scripts/
│   ├── worktree.sh              NEW      git worktree add -b praxis/<c> .praxis/worktrees/<c> main
│   ├── approve.sh               CHANGED  design approval + ship for needs-human
│   ├── rework.sh                NEW      writes the note, resets the round, clears needs-human
│   ├── loop.sh                  CHANGED  drives /praxis:feature unattended; pre-approval via approve.sh
│   └── init.sh · boundary-audit.mjs · routing-audit.mjs · validate-resources.mjs · build-cursor-crafts.mjs
├── skills/
│   ├── factory/                 NEW      the cycle as the orchestrator runs it; loaded when a change opens
│   ├── using-praxis/            CHANGED  router: classify → fast path | factory
│   ├── spec-lifecycle/          CHANGED  spec.md + ledger; two modes
│   └── (41 others untouched)
├── specs/
│   ├── _templates/              CHANGED  spec.md · implementation.md · decisions.md (design.md kept for legacy)
│   └── <changes>/
├── templates/
├── tests/                       CHANGED  hooks.test.mjs (+ barrier, cap, ship gate, legacy floor), approve.test.mjs, loop.test.mjs, manifest.test.mjs
└── praxis.manifest.json         CHANGED  drop the pipelines glob
```

## 5. A project that uses Praxis

```
my-service/
├── AGENTS.md  (CLAUDE.md → AGENTS.md)   project rules as an index (≤100 lines)  ← next change: harness-quality
├── agents/rules/                        standards the lenses and the spec-writer read
├── specs/
│   ├── _templates/
│   └── export-invoices-csv/
│       ├── spec.md                      spec-writer → person approves
│       ├── implementation.md            orchestrator only
│       ├── review/
│       │   ├── round-1/  lenses · correctness.md · security.md · tests.md
│       │   └── round-2/  lenses · correctness.md · security.md · tests.md
│       ├── decision.md                  approver
│       └── decisions.md                 optional, ADR-gated
├── .praxis/                             gitignored by the hook that creates it
│   ├── active-change
│   ├── approved/export-invoices-csv     written by post-tool-use or approve.sh
│   ├── needs-human/export-invoices-csv  written by post-tool-use on ESCALATE
│   ├── worktrees/export-invoices-csv/   the builder's checkout, branch praxis/export-invoices-csv
│   └── memory/
└── src/ · test/ · …
```

## 6. Harness-owned vs model-owned

| concern | owner | mechanism |
|---|---|---|
| No source edit before an approved spec | harness | `pre-tool-use`: spec file present + `.praxis/approved/<c>` |
| The approval record | person | the ask, or `approve.sh`; Edit/Write to the marker denied |
| Builder waits for every lens | harness | `pre-tool-use` on Agent/SendMessage to the builder id recorded in the ledger: every name in `review/round-N/lenses` has a file |
| At most two fix rounds | harness | `pre-tool-use` denies a builder dispatch when `round-2` is complete and not all PASS |
| Nothing ships without APPROVE and all PASS | harness | `pre-tool-use` on `git push`/`gh pr create` for `praxis/<c>` |
| needs-human is a record | harness | `post-tool-use` on `decision.md: ESCALATE` |
| What each role sees | harness | `subagent-start` role kernel + paths; crafts only to the roles they govern |
| Unattended limits | harness | `loop.sh`: iterations, wall clock, cost, no-progress |
| Proof it holds | harness | `tests/` (mutation-tested) + `evals/cycle` |
| Spec content, acceptance checks, open questions | model | spec-writer |
| Code, tests, commits | model | builder |
| Findings, "what I tried to break", verdict | model | lenses |
| Decision and the evidence behind it | model | approver (must re-run, never trust the builder's test report) |
| Orchestration prose, Run Card, ledger text | model | orchestrator |

Hook decision inputs, so nothing depends on the conversation:

```
pre-tool-use
  Edit/Write <path>            → spec-side? marker? spec file? · review/round-*/ from main thread → SKIP only
  Agent subagent_type=builder  → ledger.round · review/round-<round>/ complete? · round would be 3?
  SendMessage to=<builder id>  → same checks (builder id from the ledger)
  Bash "git push … praxis/<c>" | "gh pr create" → decision.md verdict · every lens file verdict
post-tool-use
  Write specs/<c>/decision.md  → ESCALATE? → .praxis/needs-human/<c>
  first source edit, approved? → .praxis/approved/<c>   (unchanged)
```

## 7. Context budget per role

| role | gets in context | does not get |
|---|---|---|
| orchestrator | kernel (≤40 lines), `factory` skill, ledger, verdict lines | file bodies, diffs, reviews |
| spec-writer | role kernel, request, project rules, the repo (it reads) | the conversation, crafts |
| builder | role kernel, `spec.md`, its own tests and commands; on resume the CHANGES files | reviews it already fixed, the ledger, other roles' output |
| lens | role kernel, `spec.md`, the diff, project rules, its craft (a11y for `lens-ui`) | the builder's conversation, other lenses' files |
| approver | role kernel, `spec.md`, the diff, every review | the builder's self-report |

Today every subagent receives the 103-line contract plus crafts plus skill pointers before its
own prompt. After: ≤15 lines and paths.

## 8. Roadmap

1. **factory-cycle** (this change): the cycle, the diet, the hooks, `evals/cycle`.
2. **harness-quality** (next, after the owner's sample code): project-side harness engineering,
   linters whose message carries the fix, structural invariants as tests, `AGENTS.md` as a
   ≤100-line index into `docs/`, quality grades, a recurring cleanup task.
3. **workflow-arm**: the same cycle as a Claude Code Workflow script, as an `evals/cycle` arm;
   replaces the markdown path only if it wins on the same cells (ADR-002).
4. **multi-model lenses** (optional): a lens run through `pi --mode json` on another provider,
   for diversity the same-family panel cannot give.
