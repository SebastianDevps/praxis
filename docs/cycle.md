# The cycle — how Praxis runs a substantial change

One change, five roles, files between them. `/praxis:feature "<request>"` (or `:bug`, `:refactor`,
`:design`) opens a change and runs **spec → build → review (bounded) → approve → ship**. Each role
works in its own context and talks to the others only through `specs/<change>/`. The limits that
must hold whatever the model does — one human approval, the review barrier, the round cap, the ship
gate — are hook decisions, not prose. This page is the reader's map; `skills/factory/SKILL.md` is
how the orchestrator runs it, `skills/spec-lifecycle/SKILL.md` owns the folder and its stages,
`docs/task-model.md` the task vocabulary. Design and decisions: `specs/factory-cycle/`.

## Roles

| role | context | reads | writes | model |
|---|---|---|---|---|
| orchestrator | main thread | everything | `implementation.md`, `review/round-N/lenses`, `.praxis/active-change` | session |
| spec-writer | fresh | repo, request, project rules | `spec.md` | opus |
| builder | fresh, worktree | `spec.md`; on resume the CHANGES files | source, tests, commits | inherit |
| lens ×N | fresh | `spec.md`, diff, project rules | `review/round-N/<lens>.md` | sonnet |
| approver | fresh | `spec.md`, diff, every review | `decision.md` | opus |

Three properties the roles hold: **one writer per file** — the orchestrator never writes a review or
a decision, a role never writes the ledger, nobody but the person writes the markers; **paths, not
content** — the orchestrator's context carries file names and verdicts, a role reads what it needs
from disk; **limits below the model** — approval, barrier, round cap, ship gate and injection size
are shell decisions.

## Files per change

```
specs/<change>/
  spec.md              spec-writer → person approves → builder, lenses, approver read it
                       ready: false | true · Goal · Scope (In/Out) · Acceptance (runnable) · Approach · Open questions
  implementation.md    orchestrator only: stage, round, builder, lenses, tasks, decision, session notes
  review/round-1/      lenses (one name per line) · correctness.md · security.md · tests.md [· ui.md]
  review/round-2/      same shape; round-3 never exists
  decision.md          approver: APPROVE | ESCALATE | APPROVE (human), with every check it ran and its output
  decisions.md         only when an ADR passes the three gates
.praxis/
  active-change        the change the Run Card is about
  approved/<change>    written by post-tool-use when the approved edit ran, or by approve.sh — never by Edit/Write
  needs-human/<change> written by post-tool-use on ESCALATE; removed by rework.sh / approve.sh
  ship/<change>        empty file; written by post-tool-use on APPROVE with every lens PASS, or by approve.sh; removed by rework.sh
  worktrees/<change>/  the builder's checkout, branch praxis/<change> (scripts/worktree.sh)
```

Legacy changes keep `design.md` in the role of `spec.md`; the floor accepts either name.

## State of a change

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

## The cycle, step by step

```
/praxis:feature "<request>"
 orchestrator  writes .praxis/active-change · specs/<c>/implementation.md (stage: new)
 spec-writer   fresh context · reads repo + request · writes specs/<c>/spec.md
               Goal · Scope in/out · Acceptance (runnable checks) · Approach · Open questions [NEEDS CLARIFICATION]
 orchestrator  open questions → ask ONE, stop · none → Run Card `Needs your decision`
 person        first source edit asks → .praxis/approved/<c>    |  /praxis:approve <c>
 builder       worktree, branch praxis/<c> · reads spec.md ONLY · TDD · commits · report in its handback
 orchestrator  ledger stage: implemented, round: N · writes review/round-N/lenses (one lens name per line)
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

The spec-writer may answer `trivial: true` — one file, no new behaviour, no design surface — and the
orchestrator takes the fast path with no cycle files. `lens-ui` joins a round only when the diff
touches UI paths (`components/`, `*.tsx`, `*.vue`, `*.css`, `*.html`). A lens that never returns gets
its file from the orchestrator with `verdict: SKIP` — the only review write the main thread may do —
and SKIP is not PASS, so the change escalates.

## What the hooks decide

| event | decision |
|---|---|
| `PreToolUse` Edit / Write | deny a source edit until `specs/<c>/spec.md` (legacy `design.md`) and `implementation.md` exist, naming the file to create; `ask` until `.praxis/approved/<c>`; deny any Edit/Write to `.praxis/{approved,needs-human,intent,ship}/*`; from the main thread, a write under `review/round-*/` only with `verdict: SKIP` |
| `PreToolUse` Agent (builder) / SendMessage (the builder id in the ledger) | the barrier and the round cap — rules below |
| `PreToolUse` Bash | the ship gate and the trunk rule; denies Bash that touches a record directory or executes a Praxis hook — rules below |
| `PostToolUse` Write | `.praxis/approved/<c>` when the approved source edit ran; `.praxis/needs-human/<c>` when `decision.md` records ESCALATE, removed when it records APPROVE; `.praxis/ship/<c>` when it records APPROVE and the last round is complete with every lens PASS |
| `SubagentStart` | the role kernel (≤15 lines, `hooks/context/roles/`) + the spec path; lenses and the approver also get the project rules |
| `UserPromptSubmit` | the ≤40-line kernel and the mode; the `factory` skill carries the cycle |
| `Stop` | block once when source changed and no `implementation.md` did |

```
open cycle of <c>  ⇔  implementation.md exists, stage ≠ shipped, and the ledger has `round:` or
                       `builder:`, or specs/<c>/review/ exists. A pre-0.10 ledger is never open.
change a ship command is about:
  pushed or PR head branch praxis/<c>  → <c>
  any other branch                     → .praxis/active-change, only if it is an open cycle
  neither                              → not a ship → allow
ship (`git push`, `gh pr create`, `gh api …pulls|merge` about <c>):
  .praxis/ship/<c> exists and decision.md verdict is APPROVE or APPROVE (human) → allow
  anything else                                                                  → deny with the reason
trunk rule: push destination main, master or the ledger's `base:` while ANY change is an open
  cycle → deny "the cycle never pushes trunk"; `--all`, `--mirror`, `--branches` likewise.
  No open cycle → not Praxis's call → allow.
`stage: shipped` written to the ledger of an open cycle before .praxis/ship/<c> exists → deny
  (otherwise writing the stage would close the cycle and free the push it was meant to gate).
builder dispatch (Agent subagent_type ~ builder) or resume (SendMessage to = ledger.builder):
  round = 0                                   → allow
  round = N ≥ 1, review/round-N incomplete     → deny  "barrier: waiting for <missing>"
  round = N, complete, all PASS                → allow
  round = N, complete, any CHANGES, N < 2      → allow  (the fix round)
  round = 2, complete, any CHANGES/SKIP        → deny  "round cap" — also every SendMessage and every
                                                 builder|engineer|backend|design|platform dispatch,
                                                 until rework.sh runs
lens list: review/round-N/lenses when present, else the ledger's `lenses:`; always the union with
  {correctness, security, tests}.
decision.md written with verdict ESCALATE      → post-tool-use creates .praxis/needs-human/<c>
decision.md written with verdict APPROVE*      → post-tool-use removes .praxis/needs-human/<c>
Edit/Write to .praxis/{approved,needs-human,intent,ship}/*  → deny
Bash touching those directories (after normalising `//`, `/./`, `./`, a preceding `cd .praxis`)
  → deny unless every stage is a plain read; `find -exec|-delete`, `fd -x`, `rg --pre` are not reads
Bash executing a Praxis hook (hooks/<name> as the command word or the script of sh|bash|zsh|dash,
  through env/sudo/time/timeout/nohup/exec/`bash -c`) → deny; reading a hook → allow
scripts/approve.sh, scripts/rework.sh → need the person's intent token; reading them is allowed
Codex apply_patch → each path in the patch is classified on its own; one denied path denies the patch
```

`PRAXIS_FLOOR=off` lifts the floor, the barrier, the cap and the ship gate together — the only
override. The hooks run on Claude Code and Codex (Codex has no SendMessage; the barrier gates the
Agent call); Cursor, Gemini and Copilot receive the same rules as prose.

## Threat model (ADR-007)

The hooks stop **drift**: a model that, mid-task, reaches for the direct spelling — an Edit on a
record, a push to trunk, `scripts/approve.sh` without the person's token, a write to `decision.md`.
They do not stop an **adversary**. A PreToolUse hook sees one command string and no history, and a
shell has unbounded spellings for one action; the forms left open are git aliases, `GIT_DIR` /
`--git-dir`, `$(…)`, variables, wrapper scripts, and interpreters (`python -c`, `node -e`) writing
a record. Resistance to those belongs to the host's permission rules, which apply outside the model
to every command. A project that wants it adds, in `.claude/settings.json`:

```json
{
  "permissions": {
    "deny": [
      "Bash(*hooks/*)",
      "Bash(*.praxis/approved*)",
      "Bash(*.praxis/needs-human*)",
      "Bash(*.praxis/intent*)",
      "Bash(*.praxis/ship*)",
      "Bash(*decision.md*)",
      "Edit(.praxis/approved/**)",
      "Edit(.praxis/needs-human/**)",
      "Edit(.praxis/intent/**)",
      "Edit(.praxis/ship/**)"
    ]
  }
}
```

Syntax checked against <https://code.claude.com/docs/en/permissions>: a Bash rule matches the whole
command text and `*` may stand at any position; a deny applies when any subcommand matches; an
`Edit(path)` deny covers the Write tool and Bash output redirects (`> file`, `tee`). Two limits the
docs state: a Bash deny does not match the same program by absolute path or inside `sh -c`, and
rules that constrain arguments are fragile. `Bash(*hooks/*)` and `Bash(*decision.md*)` also block
honest reads of those paths through Bash; use Read for them. There is no `Edit` rule for
`decision.md`, because the approver subagent writes it and permission rules apply to subagents.
Codex has an equivalent in its `permissions` config; its syntax is not documented here.

## Plugin reload

A session runs the plugin copy that was installed (`~/.claude/plugins/cache/<marketplace>/<plugin>/<version>/`),
not the repository. Agents, commands and hooks added in the repo reach a session only after the
plugin is updated and the session restarts. For development, `claude --plugin-dir <repo>` loads the
directory in place.

## Modes

| mode | path |
|---|---|
| `fast` | trivial: edit + verify; the floor is `implementation.md` alone |
| `full` | the cycle above — the default |

`deep` is gone (ADR-004): what it added — review, ship, a mandatory ADR, the refuters — is always on
in `full` or gated on the diff (the UI lens, the ADR gates). `/praxis:mode deep` maps to `full` with
a notice for one release. The dial changes ceremony only; the crafts and the safety carve-outs are
identical at both levels.

## Commands

| command | what it does |
|---|---|
| `/praxis:feature "<request>"` · `:bug` · `:refactor` · `:design` | open a change and run the cycle; each hands the spec-writer a different brief — bug: the repro command is the first Acceptance line; refactor: the same test count before and after; design: `ui` always among the lenses |
| `/praxis:approve <change>` | the person's approval of `spec.md`, written where no prompt exists (Codex, unattended); on a `needs-human` change it records `APPROVE (human)` in `decision.md`, clears the marker and prints the two ship commands |
| `/praxis:rework <change> "<note>"` | back to the builder: archives `review/round-*` and `decision.md` under `review/rework-k/`, writes the note, resets `round: 0`, clears the marker; the round cap starts again |
| `/praxis:loop` | the same cycle unattended, one step per iteration, every limit outside the model; `--approve` pre-approves the spec; exits 5 on `needs-human` |
| `/praxis:mode fast \| full` | the dial |
| `/praxis:investigate <target>` | not the cycle: the `analyst` assesses something you do not own and returns a cited dossier |
| `/praxis:init` · `/praxis:learn` | the project scaffold; team memory |

## Resume

On "continue <change>": read `specs/<change>/implementation.md` first — `stage:`, `round:`,
`builder:`, `lenses:` — and resume at the step those fields name, never from the conversation. A
lens file missing under `review/round-N/` means the barrier is still open; a `decision.md` present
means ship or escalate; `.praxis/needs-human/<change>` means the person decides. A builder that
cannot be resumed is replaced by a fresh one given the spec and the CHANGES files; the round does
not change. Two orchestrators on one change are not handled — documented, as in the factory
lineage. `.praxis/active-change` names the change the Run Card is about.

This page replaces the five prose phase lists that lived under `pipelines/` until 0.10.0. The
research behind the design — provenance of the pattern, the harness state of the art, the evidence
on parallel reviewers and bounded rounds — is `docs/research-factory-cycle.md`.
