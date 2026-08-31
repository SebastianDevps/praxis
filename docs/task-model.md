# The task model — one ledger, one phase vocabulary, one state vocabulary

Every Praxis skill that plans, executes, or resumes work reads this file for the shape of a task.
None of them defines its own. Before this document there were **four ledger names and four phase
vocabularies** across five skills, plus the word `status` meaning two different things — a change's
phase in `spec-lifecycle`, a task's state in the task template. Work handed from one skill to
another arrived in a shape the receiver did not recognise.

---

## The ledger: `PROGRESS.md`

One file, at the repo root, named `PROGRESS.md`. Not `plan.md`, not `progress.md`, not `tasks/`.

It is durable state, and that is its whole reason for existing: **it is what survives compaction.**
A plan that lives in the conversation is gone the moment the context is trimmed, and the next
iteration re-derives it wrong. Write the ledger before dispatching anything.

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
| `full` | `plan → build → verify → review` |
| `deep` | `define → plan → build → verify → review → ship` |

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

`spec-lifecycle` tracks a **change** through `new → researched → designed → planned → implemented`
in a `stage:` frontmatter field. That is a different granularity: one change contains many tasks.

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
| breaking work into tasks and writing the ledger | `writing-plans` |
| executing it, one subagent per task, review between | `subagent-driven-development` |
| executing it unattended, one task per iteration | `autonomous-loop` |
| tracking a change across stages | `spec-lifecycle` |
| the project's standing quality bar, written once with numbers | `quality-bar` |
| why any of this makes autonomy possible | `agentic-lifecycle` |

And by phase — the skill that implements each. A phase with no owner here is a phase nothing in the
repo knows how to run, which is how `define` and `ship` stayed unclaimed after this file named them.

| phase | owner |
|---|---|
| `define` | `brainstorming`, and `spec-lifecycle` for a tracked change |
| `plan` | `writing-plans`, `strategy-compare`, `decision-challenge` |
| `build` | `subagent-driven-development`, `autonomous-loop` |
| `verify` | `test-coverage-plan`, `web-testing`, `systematic-debugging` |
| `review` | `design-review`, and the `reviewer` / `refuter-*` agents |
| `ship` | `release-readiness` |

Each of those describes its own job and links here for the shape. If you find yourself writing a
second definition of a phase, a state, or a ledger filename, that is the drift this file exists to
stop.
