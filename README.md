# Praxis

**Senior-grade process and taste for Claude Code — without having to be a senior to get it.**

Your agent stops guessing, works out loud, and remembers what your project already decided.

It plans before it builds, stops for your approval, verifies what it claims, and leaves the
reasoning in your repo. [Every claim on this page is measured](#measured-not-asserted), and every
gate is mutation-tested.

```
/plugin marketplace add SebastianDevps/praxis
/plugin install praxis@praxis
/reload-plugins
```

Also runs on **Codex · Cursor · Gemini CLI · Copilot**.

---

## What it looks like

Ask for something substantial and the work becomes visible before a line is written:

```
RUN CARD — add rate limiting to the public API
spec:     specs/api-rate-limiting/   (stage: designed)
phase:    plan — Needs your decision
approach: delegate → backend
research: scanned src/middleware (no limiter), Redis already a dependency
verify:   npm test api → 429 after 100 req/min, headers present
```

It stops there. You say go, and only then does it build.

Nothing was invented, nothing was guessed, and if your context is wiped mid-build
the ledger on disk still knows where it left off.

---

## You set the intensity

The model does not decide how much process to run. You do.

```
/praxis:mode fast     rename, typo, one-file fix
/praxis:mode full     ordinary feature work            ← default
/praxis:mode deep     auth, migrations, anything you won't revisit
```

| | `fast` | `full` | `deep` |
|---|---|---|---|
| a question | answered | answered | answered |
| `specs/<change>/` | `implementation.md` | + `design.md` | + ADRs, `AGENTS.md`, `docs/` |
| Run Card | — | ✓ | ✓ |
| stops for your approval | — | ✓ once, after `design.md` | ✓ |
| mandatory research | — | — | ✓ |
| approach comparison | — | — | ✓ |
| adversarial review | — | — | ✓ |

The dial holds across turns and travels into every dispatched specialist. It changes
the **ceremony** only — the taste rules, the simplicity ladder and the safety
carve-outs are identical at every level.

## Every change leaves a folder

`specs/<change>/` — design, decisions, implementation, future work — copied from a template and
committed with your code. The convention comes from [cal.diy](https://github.com/calcom/cal.diy/tree/main/specs);
Praxis makes it the floor instead of an opt-in. Its `implementation.md` is the ledger that
survives a context wipe:

```
- [ ] T04 · phase: build · state: blocked(user) · Add POST /login route
      files:  src/routes/auth.ts
      verify: npm test auth
      note:   session store or JWT? your call — both work here
```

Six phases, and the dial decides which ones a task passes through:

```
fast    build → verify
full    plan → build → verify → review
deep    define → plan → build → verify → review → ship
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
review    Standards and Spec in separate contexts, findings cite a smell or a spec line, never blended
ship      rollback path, post-deploy evidence, the smallest increment
```

`/praxis:init` gives the project the shape the method expects: `AGENTS.md` (+ `CLAUDE.md`
symlink), `CONTEXT.md` (domain glossary with the synonyms to avoid), `agents/rules/` by category,
`agents/knowledge-base.md`, `agents/commands.md`, `specs/_templates/`. The rules reach the
reviewer and never the builders, so they cost nothing on the build turns.

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
- **It engineers like a senior.** Seams agreed before the first test, red before green, vertical slices sized to one fresh context, a red command before any bug hypothesis, and a review that runs Standards and Spec in separate contexts and never blends them. The method is Matt Pocock's; the floor that makes it stick is ours.
- **It asks before it guesses.** A vague prompt gets one question back, not a wall of code built from what the model imagined.
- **It stops for your approval.** And the stop is written to a file, so a resumed session still knows it is waiting on a person.
- **A question gets an answer.** Not a process. The dial scales ceremony, and a question has none to scale.
- **It learns per project.** Recurring lessons land in `.praxis/memory/` as plain Markdown, committed to your repo, read back every session.
- **A floor, not a ceiling.** Two hooks hold one invariant: a change leaves `specs/<change>/`, and the dial decides how much of it. In `full` that is one stop, after `design.md`: the first source edit asks for your permission, and saying yes is recorded by a hook as `.praxis/approved/<change>` — a record the model cannot write, so it cannot approve itself; then it builds without interruption. Without a prompt (Codex, unattended runs), you approve with `/praxis:approve <change>`. Nothing else gates. `PRAXIS_FLOOR=off` turns it off, and the README says so instead of hiding it. The floor runs on Claude Code and Codex; on Cursor, Gemini and Copilot the same rules arrive as prose.
- **Your project gets a scaffold.** `/praxis:init` writes `AGENTS.md` (+ `CLAUDE.md` symlink), `agents/rules/` with a category-prefix convention, `agents/knowledge-base.md` and `agents/commands.md` — the shape cal.diy uses — creating only what is missing.

## What's inside

| | | |
|---|---|---|
| **44** skills | taste, process, adversarial review, foreign-artifact assessment, per-project memory |
| **12** agents | design · engineer · backend · platform · security · reviewer · researcher · analyst · orchestrator · a three-lens refuter panel |
| **6** crafts | always-on disciplines, each injected into the dispatches it governs |
| **5** pipelines | named phase sequences, rendered as Run Cards |
| **10** commands | `/praxis:init` `:approve` `:design` `:feature` `:bug` `:refactor` `:investigate` `:loop` `:learn` `:mode` |

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

`/praxis:loop` runs a build to completion, fresh context each iteration, with every guardrail
**outside the model**: max iterations, wall clock, no-progress detection, and a verifier-integrity
guard that halts if a test file is touched.

---

## Measured, not asserted

Every claim on this page has a harness behind it. Eleven write-ups and the code that produced them
live on the [`measurement`](https://github.com/SebastianDevps/praxis/tree/measurement) branch —
`main` ships what serves the agent.

- **~12× fewer tokens** on facts the project had already decided
  ([the learning A/B](https://github.com/SebastianDevps/praxis/blob/measurement/evals/2026-06-26-learning-ab.md)).
- **`design.md` before the first source edit in 3/3 runs; 0/3 without the floor** (`evals/floor/`).
- **Self-approval 3/3 → 0/3** once the approval became a record only a hook can write.
- **Vertical slices 3/3 vs 0/3** when the TDD method is loaded (`evals/value/`).

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
