---
name: quality-bar
description: Use when a project needs a written quality bar — set up constraints, define our standards, quality gates, what coverage should we require — detect the stack, interview with defaults, measure today's numbers, write CONSTRAINTS.md at the root. NOT the standing floor at the ship moment (that is `release-readiness`), NOT choosing what to test for one change (that is `test-coverage-plan`).
kind: skill
od:
  category: testing
  triggers:
    - "set up constraints"
    - "define our standards"
    - "quality gates"
    - "what coverage should we require"
    - "stop the agent shipping junk"
---

## Why this is written down, not described

Other resources say what good looks like, in prose an agent may or may not follow, and none of it
survives the session. This one produces a record of **this project's** bar, with numbers, checkable
by a command. When a person wrote the code, reading it told them whether it was good; an agent
writes more in an afternoon than anyone reads that week, so the judgement leaves a person's head
and becomes checks that run around the loop.

## Detect before you ask

Never ask what you can read. Gather this, report it in two lines, then ask only what is left.

| What | Where |
|---|---|
| Language and stack | the manifest — `package.json`, `pyproject.toml`, `go.mod`, `Cargo.toml` |
| Test runner | dev dependencies and the test script |
| Linters and type checks | config files at the root; the scripts that already run |
| Coverage today | an existing coverage report, or one run of the suite |
| CI | the workflow files, and which of the above they already gate |

## A short interview, every question with a default

One question at a time is `brainstorming`, not restated here — and it means literally one: ask,
STOP, wait for the answer, then ask the next. The table below is your reference for what to ask and
what to fall back on, **not a list to paste into a turn**. Four questions is the ceiling; four turns
is the shape. Specific here: **every question carries a default**, so "I don't know" is a complete
answer that still produces a working bar rather than a dead end.

| Question | Default | What the default costs |
|---|---|---|
| Which dimensions — coverage, security, performance, a11y, architecture? | coverage and secrets | Nothing watches bundle size or layer boundaries until someone asks. |
| Does a breach block the change or warn? | block the floor, warn the numbers at first | A regression lands and is caught at review, not at the edit. |
| Target numbers, or should we measure? | measure and hold today's value | The bar starts where the project is, not where it should be. |
| Slowest check allowed before work comes back? | 90s at task end, no limit in CI | Slow checks move to CI, so the loop learns about them late. |

## Measure, don't invent

Where the user has no number in mind, run the check and record what the project scores today. An
invented threshold gets ignored — 80% coverage on a 62% codebase is a permanently red build, and a
red build is one people stop reading. A measured one is already true, so the only way to fail it is
to regress. Ratchet up **only when a change earns it**: 71% coverage rewrites the line to 71%.

**Measure-and-hold applies to a number, never to an absence.** A project at 62% coverage holds 62%.
A project with no dependency audit and no secret scanning does not hold "none" — those are floor
items, and a floor is not measured, it is applied. Recording a zero as this project's standard
turns a gap into a ratified decision, and the file's authority is what makes that dangerous.

## The artifact

`CONSTRAINTS.md` at the project root, committed — it is the team's standard, not one person's
local preference, and a bar nobody else can read is not a bar. Written once, not renegotiated per change — an argument about
whether a rule applies to this particular change is the argument the file exists to have had
already. If one genuinely does not apply, record why; do not drop it silently. Three sections, and
a number never appears without its reason:

```markdown
## Floor — always
- No new suppressions (`@ts-ignore`, `eslint-disable`, `# noqa`)
- No skipped or deleted tests without a reason in the commit body
- No secrets in source; this file may not be weakened to make a change pass

## Enforced
| Dimension | Rule | Checked by | Runs |
|---|---|---|---|
| Coverage, changed lines | ≥ 80% — forces a test, still allows config | `vitest run --coverage` | task end |
| Secrets | zero findings | `gitleaks detect --redact` | task end, CI |

## Measured, not yet enforced
| Metric | Today | Direction |
|---|---|---|
| Project coverage | 62.4% | must not fall |
| Bundle, main entry | 184 kB | must not grow |
```

## When there is no live user

The interview needs a person. In a non-interactive run — CI, `/praxis:loop`, any autonomous
iteration — do not interview and do not answer on the user's behalf. Apply the floor plus every
metric measurable without a decision, say out loud that you did exactly that, and flag the numbered
dimensions as unset for a human.

The floor still applies in full — it is the part that needs no decision. Mark the file itself
`status: provisional — dimensions unset, needs a human` at the top, so a later run or another agent
reads it as incomplete rather than as the bar. An artifact written with nobody present must not be
indistinguishable from one somebody chose.

## What erodes it

Tightening the bar should be silent; loosening it should be loud. The named tells of a lowered bar
belong to the `evidence-discipline` craft, which is always injected. Read them there.
