# The task model — one ledger, one phase vocabulary, one state vocabulary

Every Praxis skill that plans, executes, or resumes work reads this file for the shape of a task.
None of them defines its own. Before this document there were **four ledger names and four phase
vocabularies** across five skills, plus the word `status` meaning two different things — a change's
phase in `spec-lifecycle`, a task's state in the task template. Work handed from one skill to
another arrived in a shape the receiver did not recognise.

---

## The ledger: `specs/<change>/implementation.md`

One file per change, `specs/<change>/implementation.md`. Not `plan.md`, not `progress.md`, not
`tasks/`. It holds the task lines below, under `## Tasks`, plus `## Completed`, `## Blocked` and
`## Session Notes`; its frontmatter carries the change's `stage:`, `round:`, `builder:` and `lenses:`,
and the orchestrator is its only writer. The folder around it — `spec.md`, `review/`, `decision.md`,
`decisions.md` — is `spec-lifecycle`'s; the task lines are this file's.

It is durable state, and that is its whole reason for existing: **it is what survives compaction.**
A plan that lives in the conversation is gone the moment the context is trimmed, and the next
iteration re-derives it wrong. Write the ledger before dispatching anything.

`PROGRESS.md`, at the repo root, is not a ledger any more: it is the **index of changes**, one line
per change with its stage and a link, and nothing else —

```
- spec-driven-workflow · stage: planned · specs/spec-driven-workflow/
```

Which change a Run Card is about is `.praxis/active-change`: one line, the change name, written when
`specs/<change>/` is created and rewritten when the user names another change. Hooks that count
`state:` read `specs/*/implementation.md`, never the index.

## Which phase writes which file

| phase | writes | who |
|---|---|---|
| `define` | `spec.md` Goal, Scope, Open questions (`[NEEDS CLARIFICATION]`) | `spec-writer`; `brainstorming` on the fast path when ambiguous |
| `plan` | `spec.md` Approach + Acceptance; `implementation.md` tasks; `decisions.md` when a decision passes the three gates | `spec-writer`; the orchestrator fills the ledger (`writing-plans` on the fast path) |
| `build` | source, tests, commits on `praxis/<change>`; the orchestrator records `state:` + Completed in `implementation.md` | `builder` in the cycle; `engineer` / `backend` / `design` / `platform` on the fast path |
| `verify` | the builder runs every Acceptance line; `decision.md` Checks run, PASS · FAIL · SKIP · GAP | `approver`, re-running the checks itself — never from the builder's report |
| `review` | `review/round-N/<lens>.md`; `decisions.md` when a finding changed a decision | the lenses: `refuter-correctness`, `refuter-security`, `refuter-tests`, `lens-ui` when the diff touches UI |
| `ship` | the PR on `praxis/<change>`; `stage: shipped`; `future-work.md`, `docs/` when kept | the orchestrator, behind the hook's ship gate (APPROVE + every lens PASS) |

## A task line

```
- [ ] T07 · phase: build · state: blocked(technical) · Add POST /login route
      files:  src/routes/auth.ts
      verify: npm test auth
      note:   3rd attempt — session store not initialised in the test env
```

The `- [ ]` / `- [x]` checkbox stays for a human skimming the file. **`state:` is the source of
truth** — the checkbox cannot express `blocked`, and a task that fails twice and stops is the case
the ledger exists for.

`files:` and `verify:` are not optional. A task with no named verification cannot be finished by an
agent, because nothing can decide that it is done.

## A task is a vertical slice

A task is **a narrow but COMPLETE path through every layer, demoable or verifiable on its own,
sized to fit in a single fresh context window**. Vertical, not a horizontal slice of one layer:
"the schema" is not a task, "a user can save a draft" is. Any prefactoring that makes the slice
easy is its own task, sequenced first.

The size rule is falsifiable, and it is the only sizing rule. If sessions on your tasks routinely
degrade before the work is done, the tasks are too big — split them. If each session spends most
of its context on setup before doing five minutes of work, they are too small — merge them.

**Wide refactors are the exception.** One mechanical change whose blast radius fans across the
codebase — rename a column, retype a shared symbol — breaks every call site at once, so no
vertical slice lands green. Sequence it as **expand–contract**: one task that *expands* (add the
new form beside the old, nothing breaks); then *migrate* the call sites in batches sized by blast
radius (per package, per directory), each batch its own task blocked by the expand, green batch to
batch because the old form still exists; finally one task that *contracts* (delete the old form),
blocked by every migrate batch.

## `verify:` — the observation that would show it false

The `verify:` line is the task's acceptance, and it is written as a falsifier: the observation
that would show the task is *not* done. "Tests pass" is not that observation; "`npm test auth`
exits 0, and it exited 1 before the route existed" is. A `verify:` that could not have failed
yesterday proves nothing today.

Three kinds of verification exist, and a `verify:` line names one of them. What the assertion
*does* decides the kind, never where it runs — an LLM judge in CI is a review, not a check.

| kind | what it is | `verify:` looks like |
|---|---|---|
| **automated check** | deterministic, pass/fail, no judgement: tests, typecheck, lint, build. The signal an agent self-corrects from alone. A flaky check is a broken check, not a non-check. | `npm test auth` |
| **automated review** | an agent that did not write the code forms a judgement on the diff — fresh context, often a different model or prompt. Non-deterministic: it can miss and it can over-flag; a filter before a human, not a gate that replaces one. | `reviewer on src/auth/**` |
| **human review** | a person reads the diff and judges it. **Reading the diff counts; reading the summary does not** — the summary is written by the party being reviewed. Reserved for what only a person can judge: is this the right change, should it exist at all. | `human: diff of src/auth/**` |

The four states apply to each kind, and `GAP` is the one that differs:

| state | automated check | automated review | human review |
|---|---|---|---|
| `PASS` | exit 0 | the reviewer read the diff and reports no findings, in those words | the person read the diff and accepted it |
| `FAIL` | non-zero exit | findings | rejected |
| `SKIP` | the runner could not start — missing tool, missing target | no diff, or no reviewer could run | nobody read it |
| `GAP` | it ran and asserted nothing — zero tests matched, an assertion-free test, a linter with no rules | the Spec axis with no `design.md` to judge against (a missing `agents/rules/` is not a GAP: the Standards axis runs on the Fowler floor and says so) | the summary was read, not the diff |

A `GAP` never sets the failure flag; it reports, and someone decides. Silence is not a state.

---

## `phase:` — where the task sits in the cycle

Six phases, in order. Adopted from
[addyosmani/agent-skills](https://github.com/addyosmani/agent-skills), which organises the whole
lifecycle this way.

| phase | the task is | done when |
|---|---|---|
| `define` | establishing what is wanted | the requirement is stated and bounded |
| `plan` | deciding how | the approach is chosen, alternatives named |
| `build` | implementing | the code exists |
| `verify` | proving it works | `verify:` runs green |
| `review` | being read by something that did not write it | findings are dispositioned |
| `ship` | being released | it is merged, deployed, or handed over |

**The dial decides which phases a task passes through.** `/praxis:mode` is the human's control; it
is not a suggestion the agent weighs.

| mode | phases |
|---|---|
| `fast` | `build → verify` |
| `full` | `define → plan → build → verify → review → ship` — the cycle, `docs/cycle.md` |

`deep` was removed in 0.10.0 (ADR-004, `specs/factory-cycle/decisions.md`): review and ship are
always on in `full`, and the diff — not the dial — decides which lenses run. `/praxis:mode deep`
maps to `full` with a notice for one release.

A skipped phase is skipped, not faked. Never write `phase: review` on a task nothing reviewed.

---

## `state:` — whether the task is moving

```
pending → in_progress → review → done
             ↓
          blocked(technical | user)
```

| state | meaning | who unblocks it |
|---|---|---|
| `pending` | not started | — |
| `in_progress` | a subagent holds it | — |
| `review` | implemented, not yet reviewed | the reviewer |
| `done` | reviewed and verified | — |
| `blocked(technical)` | the agent cannot proceed — failed N times, missing dependency | the agent, next attempt |
| `blocked(user)` | a decision is required that is not the agent's to make | **you** |

`blocked(user)` is the durable form of the Run Card's `Needs your decision`. The Run Card states
the halt in the conversation; this records it in a file, so a session that resumes after compaction
still knows it is waiting on a person rather than re-deciding on your behalf.

The two blocked kinds are separate because they have different recipients. Collapsing them loses
the only thing the state is for.

---

## Not to be confused with `stage:`

`spec-lifecycle` tracks a **change** through `new → designed → planned → implemented → shipped` —
plus `needs-human`, the side exit when the approver escalates and the person decides — in the
`stage:` frontmatter field of `implementation.md`. That is a different granularity: one change
contains many tasks.

Three words, three meanings, no overlap:

- `stage:` — where a **change** is (`spec-lifecycle`)
- `phase:` — where a **task** is (this file)
- `state:` — whether a **task** is moving (this file)

That field was called `status:` until it collided with the task template's `status:`. Renamed
rather than documented around: a word that means two things in one system is a defect, and the
cheapest moment to fix it is before anything depends on the ambiguity.

---

## Who owns what

| concern | skill |
|---|---|
| running a substantial change through the cycle — spec-writer, builder, lenses, approver, PR | `factory` |
| breaking work into tasks and writing the ledger's task lines | `writing-plans` |
| executing it, one subagent per task, review between | `subagent-driven-development` |
| executing it unattended, one task per iteration | `autonomous-loop` |
| tracking a change across stages, and the spec folder around the ledger | `spec-lifecycle` |
| the project's standing quality bar, written once with numbers | `quality-bar` |
| why any of this makes autonomy possible | `agentic-lifecycle` |

And by phase — the skill that implements each. A phase with no owner here is a phase nothing in the
repo knows how to run, which is how `define` and `ship` stayed unclaimed after this file named them.

| phase | owner |
|---|---|
| `define` | `factory` (the `spec-writer` role); `brainstorming` on the fast path |
| `plan` | `factory` (`spec.md` Approach + Acceptance); `writing-plans`, `strategy-compare`, `decision-challenge` |
| `build` | `factory` (the `builder` role); `subagent-driven-development`, `autonomous-loop` |
| `verify` | `factory` (the `approver` role); `test-coverage-plan`, `web-testing`, `systematic-debugging` |
| `review` | `factory` (the lenses: `refuter-*`, `lens-ui`); `design-review`, and the `reviewer` agent outside the cycle |
| `ship` | `factory` (the PR behind the ship gate); `release-readiness` |

Each of those describes its own job and links here for the shape. If you find yourself writing a
second definition of a phase, a state, or a ledger filename, that is the drift this file exists to
stop.

The slice, the size rule, expand–contract and the three kinds of verification are adapted from
[mattpocock/skills](https://github.com/mattpocock/skills) `to-tickets` and the
[dictionary of AI coding](https://github.com/mattpocock/dictionary-of-ai-coding) entries *Ticket*,
*Automated check*, *Automated review* and *Human review*.
