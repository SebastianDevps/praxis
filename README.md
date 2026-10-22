# Praxis

**Senior-grade process and taste for Claude Code — without having to be a senior to get it.**

Your agent stops guessing, works out loud, and remembers what your project already decided.

Hand it a feature and it comes back with a PR that was specified, built, reviewed by lenses that
did not write it, and approved by a role that re-ran the checks — with one approval from you, and a
visible stop when it needs you. [Every claim on this page is measured](#measured-not-asserted), and
every gate is mutation-tested.

```
/plugin marketplace add SebastianDevps/praxis
/plugin install praxis@praxis
/reload-plugins
```

Also runs on **Codex · Cursor · Gemini CLI · Copilot**.

A session runs the copy of the plugin that was installed, not your checkout: new agents, commands
and hooks arrive after an update and a restart. To develop against a directory, start Claude Code
with `claude --plugin-dir <path>`.

---

## What it looks like

Ask for something substantial and the work becomes visible before a line is written:

```
RUN CARD — export invoices to CSV
spec:     specs/export-invoices-csv/   (stage: designed)
phase:    define — Needs your decision
approach: delegate → spec-writer
research: invoices module, tenant guard, existing exporters; one question asked, answered
verify:   the spec's Acceptance — GET /invoices/export → 200 CSV; cross-tenant request → 403
```

It stops there. You approve the spec, and only then does it build.

Nothing was invented, nothing was guessed, and if your context is wiped mid-build
the ledger on disk still knows where it left off.

---

## The cycle

Every substantial change runs the same five roles, each in a fresh context, talking only through
files:

```
            spec-writer done          person approves            builder done
  new ───────────────────► designed ───────────────────► planned ─────────────► built
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
                                                              (push + PR)      ┌──── /praxis:rework ──► built (round 1)
                                                                               └──── /praxis:approve ─► shipped
```

- **spec-writer** turns your request into `spec.md`: goal, scope, runnable acceptance checks, and a
  `[NEEDS CLARIFICATION]` for every ambiguity the repo cannot answer. You get one question at a time.
- **builder** works in its own worktree on `praxis/<change>`, reads the spec and nothing else,
  test-first.
- **lenses** — correctness, security, tests, and UI when the diff touches UI paths — review in one
  parallel wave, each in a fresh context, and each must write what it tried to break even when it
  passes.
- **approver** re-runs every acceptance check itself before writing APPROVE or ESCALATE. The
  builder's own test report is never evidence.
- **ship** pushes the branch and opens a PR. Main is never written by the cycle; you merge.

Two fix rounds at most, then it escalates to you: `/praxis:rework <change> "<note>"` sends it back
to the builder, `/praxis:approve <change>` ships it as is. [The cycle for a reader](docs/cycle.md).

## The limits are hooks, not prose

What must hold whatever the model does is decided by shell, below the model:

| limit | mechanism |
|---|---|
| no source edit before an approved spec | `pre-tool-use` denies until `spec.md` exists and asks until `.praxis/approved/<change>` exists — a record only your answer, or `/praxis:approve`, can write |
| the builder waits for every lens | `pre-tool-use` denies a builder resume while a review file is missing |
| at most two fix rounds | `pre-tool-use` denies the dispatch that would open round 3 |
| nothing ships without APPROVE and every lens PASS | `pre-tool-use` gates `git push` and `gh pr create` on the ship marker `.praxis/ship/<change>`, which only a hook or `/praxis:approve` writes |
| the cycle never pushes trunk | `pre-tool-use` denies a push to `main`, `master` or the change's base while a cycle is open |
| the stop is a record | `post-tool-use` writes `.praxis/needs-human/<change>` on ESCALATE |

The hooks stop a model that drifts, not one that attacks; the deny rules that add the second are in
[docs/cycle.md](docs/cycle.md#threat-model-adr-007). `PRAXIS_FLOOR=off` is the only override, and the README says so instead of hiding it. The floor
runs on Claude Code and Codex; on Cursor, Gemini and Copilot the same rules arrive as prose.

## You set the intensity

```
/praxis:mode fast     rename, typo, one-file fix — edit + verify, a five-line ledger
/praxis:mode full     everything else — the cycle                            ← default
```

The dial holds across turns and travels into every dispatched role. It changes the **ceremony**
only — the taste rules, the simplicity ladder and the safety carve-outs are identical at both
levels. There is no third level: review and ship are always on, and the diff — not a dial —
decides which lenses run.

## Every change leaves a folder

`specs/<change>/` — committed with your code, one writer per file:

```
spec.md              spec-writer writes · you approve · builder, lenses, approver read
implementation.md    the ledger — orchestrator only: stage, round, lenses, tasks, session notes
review/round-N/      one file per lens: PASS | CHANGES, findings with file:line, what it tried to break
decision.md          approver: APPROVE | ESCALATE, with every check it ran and its output
decisions.md         ADRs, only when a decision passes the three gates
```

The convention comes from [cal.diy](https://github.com/calcom/cal.diy/tree/main/specs); Praxis
makes it the floor instead of an opt-in. Its `implementation.md` is the ledger that survives a
context wipe:

```
- [ ] T04 · phase: build · state: blocked(user) · Add POST /login route
      files:  src/routes/auth.ts
      verify: npm test auth
      note:   session store or JWT? your call — both work here
```

A skipped phase is skipped, never faked. A file count never escalates the work —
being unsure what to build does. [The full shape](docs/task-model.md).

---

## How it engineers

Given a well-defined task, the agent works the way a senior does. The method is
[Matt Pocock's](https://github.com/mattpocock/skills), imported as text and cited line by line;
the floor that makes it stick is Praxis's own.

```
define    grill the frontier — facts come from subagents, decisions from you, one question at a time
plan      design at the seam: deep modules, few seams, the interface is the test surface
build     red before green, one vertical slice at a time, no refactor inside the loop
verify    a red command before any bug hypothesis; PASS · FAIL · SKIP · GAP, never silence
review    lenses that did not write the code, each forced to say what it tried to break
ship      a PR behind APPROVE and every lens PASS; main is yours
```

`/praxis:init` gives the project the shape the method expects: `AGENTS.md` (+ `CLAUDE.md`
symlink), `CONTEXT.md` (domain glossary with the synonyms to avoid), `agents/rules/` by category,
`agents/knowledge-base.md`, `agents/commands.md`, `specs/_templates/`. The rules reach the lenses
and the approver and never the builder, so they cost nothing on the build turns.

## Comments a senior would keep

Praxis's builders comment the way a senior does: sparse, and only where the code cannot say it
itself. Four patterns never reach your files, because a hook reads what is being written and
refuses them — commented-out code, banner and divider comments, chain-of-thought leaked from the
session, and a `TODO` with nobody's name on it.

It inspects added lines only: a comment already in your file is never touched. Language convention
wins where a language has one — Go's doc comment on every exported name and Rust's example on
every public item are respected, not flagged. The method is Ousterhout, Fowler, Google's
engineering practices and the Linux kernel style guide, carried in as cited text.
`PRAXIS_COMMENTS=off` turns it off, and the README says so instead of hiding it.

## What it assesses

`/praxis:investigate` points the same method at something outside your repo — a repo URL, a package,
a competitor's product, a technology you are weighing — and returns a cited assessment with a
verdict. Every claim carries a `path:line` or a URL, and the verdict names the finding that would
overturn it.

| | |
|---|---|
| a codebase you do not own | stack, entry points, request lifecycle, architecture at the C4 levels it earns |
| a package or plugin | adopt · adopt-with-guard · avoid, computed from live maintenance, bus-factor and advisory data |
| an architecture | risks, non-risks, sensitivity points and the tradeoff points that pull two attributes at once |
| a capability to source | build · buy · bounded-buy · extend, classified as commodity or differentiator first |

The methods are the ones large engineering organizations already use, carried in as cited text
rather than paraphrase: ATAM for architecture evaluation, C4 and arc42 for structure, Thoughtworks'
build-vs-buy criteria, the OpenSSF Concise Guide and Scorecard. Adoption verdicts are **computed**
against `packages.ecosyste.ms`, `api.scorecard.dev` and `deps.dev` — never from a star count, which
the primary source classifies as gameable.

Where the sources contradict each other, the assessment says so instead of picking quietly. And a
section it could not establish is reported `SKIP` with the reason: a complete-looking report over an
incomplete investigation is the failure this contract exists to prevent.

## Why Praxis

- **Taste, enforced.** A Ship Gate refuses Inter/Roboto, AI-purple gradients and zero-a11y output. Every web deliverable gets a font check, a Baseline table and an a11y/motion pass — even when you don't ask.
- **It engineers like a senior.** Seams agreed before the first test, red before green, vertical slices sized to one fresh context, a red command before any bug hypothesis. The method is Matt Pocock's; the floor that makes it stick is ours.
- **It asks before it guesses.** A vague prompt gets one question back, not a wall of code built from what the model imagined — the spec-writer marks every ambiguity the repo cannot answer, and you get them one at a time.
- **It is reviewed by something that did not write it.** Three lenses in fresh contexts, each forced to write what it tried to break; an approver that re-runs the checks instead of reading the builder's report. Diversity comes from lenses and contexts, not from a bigger panel.
- **It stops for your approval — once.** Before code, on the spec; and again only when two review rounds could not converge. Both stops are written to files, so a resumed session still knows it is waiting on a person.
- **A question gets an answer.** Not a process. The dial scales ceremony, and a question has none to scale.
- **It learns per project.** Recurring lessons land in `.praxis/memory/` as plain Markdown, committed to your repo, read back every session.
- **A floor, not a ceiling.** The approval, the review barrier, the round cap and the ship gate are hook decisions; everything else is text the model reads. Saying yes to the first source edit is recorded by a hook as `.praxis/approved/<change>` — a record the model cannot write, so it cannot approve itself. Without a prompt (Codex, unattended runs), you approve with `/praxis:approve <change>`.
- **Your project gets a scaffold.** `/praxis:init` writes `AGENTS.md` (+ `CLAUDE.md` symlink), `agents/rules/` with a category-prefix convention, `agents/knowledge-base.md` and `agents/commands.md` — the shape cal.diy uses — creating only what is missing.

## What's inside

| | |
|---|---|
| **45** skills | taste, process, the cycle, adversarial review, foreign-artifact assessment, per-project memory |
| **16** agents | spec-writer · builder · approver · lens-ui · design · engineer · backend · platform · security · reviewer · researcher · analyst · orchestrator · a three-lens refuter panel |
| **6** crafts | always-on disciplines, each injected into the dispatches it governs |
| **11** commands | `/praxis:init` `:approve` `:rework` `:design` `:feature` `:bug` `:refactor` `:investigate` `:loop` `:learn` `:mode` |

## Team memory, in your repo

Claude Code already remembers things *for you* — per user, per machine, invisible to everyone else.
Praxis adds the layer that is missing: memory the **team** owns. `/praxis:learn` writes conventions,
decisions and learned procedures into `.praxis/memory/` as plain Markdown you commit, review in a
diff, and share through git. One admission rule keeps it useful: **if a new teammate would not need
it, it does not go in.**

The hook injects the memory index **every session**, which defeats the usual failure: writing
lessons the agent never reads back. Four safeguards keep it honest — capture only on recurrence
(seen twice, never one-offs, with the first sighting parked in `gaps.md` so the second one *in any
later session* can find it), every lesson carrying the source that taught it, a probation gate
before a learned skill is trusted, and a prune pass driven by what a lesson last *changed* rather
than by when it was last written.

No database, no daemon, no port. The market's answer to this runs a resident worker service; this
one is files you can read.

Measured: **~12× fewer tokens** on facts the project already decided
([the A/B](https://github.com/SebastianDevps/praxis/blob/measurement/evals/2026-06-26-learning-ab.md)).

## The autonomous loop

`/praxis:loop` runs the same cycle unattended, fresh context each iteration, with every guardrail
**outside the model**: max iterations, wall clock, no-progress detection, a verifier-integrity
guard that halts if a test file is touched, and a stop at `needs-human`. `--approve` pre-approves
the spec; the ship gate still needs APPROVE in a file.

---

## Measured, not asserted

Every claim on this page has a harness behind it. The write-ups and the code that produced them
live on the [`measurement`](https://github.com/SebastianDevps/praxis/tree/measurement) branch —
`main` ships what serves the agent.

- **~12× fewer tokens** on facts the project had already decided
  ([the learning A/B](https://github.com/SebastianDevps/praxis/blob/measurement/evals/2026-06-26-learning-ab.md)).
- **The spec before the first source edit in 3/3 runs; 0/3 without the floor** (`evals/floor/`,
  measured on `design.md`, the spec's former name).
- **Self-approval 3/3 → 0/3** once the approval became a record only a hook can write.
- **Vertical slices 3/3 vs 0/3** when the TDD method is loaded (`evals/value/`).
- **Fan-out 0/72** before the cycle: parallel review existed in prose and in no transcript
  (`docs/eval-data/`). The barrier is now a hook decision; the cycle's own numbers — dispatch
  count, barrier order, round cap, token cost — are `evals/cycle`'s to publish, and until it runs
  they are design, not measurement.

Every gate is mutation-tested — made to fail on purpose, then restored — so none of them can pass
vacuously. That is how a routing table pointing at two agents that never existed was caught.

The write-ups include the runs that went against us, published in full rather than deleted; the
branch has them all. Claiming rigor is free, and it is the only kind anyone can check.

## Development

Zero dependencies. No package manager, no build step.

```bash
node scripts/validate-resources.mjs   # frontmatter contract for every resource
node --test tests/*.test.mjs          # references, hooks, cursor parity, invariants
```

Both run in CI on every push. Each gate is mutation-tested, so none can pass vacuously — that is
how a routing table pointing at two agents that never existed was caught.

## Cross-platform

One skill set, thin per-host adapters. Skills speak in **actions** ("dispatch a subagent", "invoke
a skill") and each host's `references/<host>-tools.md` resolves them to real tools.

> **Cursor gets one injection point, not three.** Its `beforeSubmitPrompt` and `subagentStart`
> hooks return display-only text that never reaches the model, so the per-turn and per-craft layers
> ship as rule files instead (`.cursor/rules/`). Regenerate with
> `node scripts/build-cursor-crafts.mjs`; CI fails if they drift.

> Codex needs `multi_agent = true` in `~/.codex/config.toml` for subagent dispatch.

## License

MIT © Sebastian Guerra
