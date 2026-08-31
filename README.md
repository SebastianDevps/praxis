# Praxis

**Senior-grade process and taste for Claude Code — without having to be a senior to get it.**

Your agent stops guessing, works out loud, and remembers what your project already decided.

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
| Run Card | — | ✓ | ✓ |
| stops for your approval | — | ✓ | ✓ |
| mandatory research | — | — | ✓ |
| approach comparison | — | — | ✓ |
| adversarial review | — | — | ✓ |

The dial holds across turns and travels into every dispatched specialist. It changes
the **ceremony** only — the taste rules, the simplicity ladder and the safety
carve-outs are identical at every level.

## Every task carries its own position

One ledger, `PROGRESS.md`, that survives a context wipe:

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

## Why Praxis

- **Taste, enforced.** A Ship Gate refuses Inter/Roboto, AI-purple gradients and zero-a11y output. Every web deliverable gets a font check, a Baseline table and an a11y/motion pass — even when you don't ask.
- **It asks before it guesses.** A vague prompt gets one question back, not a wall of code built from what the model imagined.
- **It stops for your approval.** And the stop is written to a file, so a resumed session still knows it is waiting on a person.
- **A question gets an answer.** Not a process. The dial scales ceremony, and a question has none to scale.
- **It learns per project.** Recurring lessons land in `.praxis/memory/` as plain Markdown, committed to your repo, read back every session.
- **It never blocks you.** Praxis primes; it does not gate. Hooks inject context and nothing else.

## What's inside

| | | |
|---|---|---|
| **38** skills | taste, process, adversarial review, per-project memory |
| **11** agents | design · engineer · backend · platform · security · reviewer · researcher · orchestrator · a three-lens refuter panel |
| **6** crafts | always-on disciplines injected into every dispatch |
| **4** pipelines | named phase sequences, rendered as Run Cards |
| **7** commands | `/praxis:design` `:feature` `:bug` `:refactor` `:loop` `:learn` `:mode` |

## Per-project memory

`/praxis:learn` captures one recurring, reusable lesson per session into `.praxis/memory/` —
plain Markdown, no backend, committable so the whole team shares it.

The hook injects the memory index **every session**, which defeats the usual failure: writing
lessons the agent never reads back. Three safeguards keep it honest — capture only on recurrence
(seen twice, never one-offs), a probation gate before a learned skill is trusted, and a prune pass
so it does not rot.

Measured: **~12× fewer tokens** on facts the project already decided
([the A/B](https://github.com/SebastianDevps/praxis/blob/measurement/evals/2026-06-26-learning-ab.md)).

## The autonomous loop

`/praxis:loop` runs a build to completion, fresh context each iteration, with every guardrail
**outside the model**: max iterations, wall clock, no-progress detection, and a verifier-integrity
guard that halts if a test file is touched.

---

## Measured, not claimed

The harnesses and their write-ups live on the
[`measurement`](https://github.com/SebastianDevps/praxis/tree/measurement) branch — `main` ships
what serves the agent. The negative results are published beside the positive ones: a seeded-defect
eval found the refuter panel costs **3.65× for identical detection**, and a $3 smoke stopped an $18
run from producing an invalid answer.

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
