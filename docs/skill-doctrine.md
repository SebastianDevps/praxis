# Skill doctrine — the bar a Praxis resource has to clear

Adapted from the rubric in [`rsc-harness`](https://github.com/ericrisco/rsc-harness), which wrote
its test before any skill existed. Three rules do most of the work. They are here because each one
contradicts an instinct that feels like diligence.

> **Where the instruments are.** This file cites `scripts/routing-audit.mjs`,
> `tests/routing.test.mjs` and the `evals/` write-ups. They are not on `main`: `main` ships what
> serves the agent, and a measurement harness serves the author. They live on the
> [`measurement`](https://github.com/SebastianDevps/praxis/tree/measurement) branch, along with the
> numbers quoted below. The rules stand without them; the evidence is one branch away.

---

## 1. Discriminative power, not coverage

A description is judged by one question: **could a reader pick this resource over its nearest
sibling from the description alone?**

Not "does it list everything this can do." Coverage is what makes descriptions long and
interchangeable. Discrimination is what makes them route.

Every skill and agent therefore ends its description with an explicit boundary:

```
NOT the words alone (that is `copywriting`), NOT the brand system (that is `brand`).
```

Naming the sibling is the load-bearing half. "NOT for other things" teaches nothing; "NOT X, that
is `Y`" tells the router where to go instead, and `tests/routing.test.mjs` checks that `Y` exists.

`scripts/routing-audit.mjs` measures the result. Two descriptions above the collision ceiling
cannot be told apart by a reader either.

**The measurement has a trap, and it is worth understanding before trusting the number.** Naming
the sibling puts the sibling's vocabulary inside this description. A bag-of-words ranker sees the
shared words and scores the two as *more* alike — so the harder a pair works to separate itself,
the worse it looks. Measured 2026-08-29: `learn-prune` ↔ `praxis-memory` reads 0.57 with the
boundary clauses and 0.32 without; `autonomous-loop` ↔ `subagent-driven-development` 0.44 → 0.13.
The collision ceiling was set against the inflated reading and gated against the doctrine it was
meant to enforce.

The audit now strips boundary clauses before measuring collision and ranks on the full text, and
prints both readings. Do not read the fix as "the boundaries were wrong" — an LLM router, which is
what actually reads these, resolves `NOT x (that is \`y\`)` in a way a lexical proxy cannot
represent. What was wrong was the instrument. The general form: **when a metric moves in the
direction opposite to the practice it scores, suspect the metric before the practice.**

This trap has its own file now — [instrument discipline](https://github.com/SebastianDevps/praxis/blob/measurement/docs/instrument-discipline.md) — because it
recurred five times in two days and the lessons were being filed as facts about individual
artifacts instead of as rules.

**The same trap, found a second time.** Every description is English; the eval prompts are
deliberately bilingual, because Praxis is used in Spanish. Measured 2026-08-29: rank-1 is **69.2%
on English prompts and 23.5% on Spanish**, and the Spanish winners are near-random — `ad-creative`
took five unrelated prompts. A lexical ranker cannot cross languages, so 19% of the corpus was
being scored by an instrument that cannot read it, and the blended number hid it. The floor now
sits on the English subset and the Spanish figure is tracked, not gated: gating the blend invites
someone to stuff Spanish keywords into English descriptions, which would raise the number and make
the descriptions worse.

**What the split then made visible.** With the noise separated, five descriptions turned out to be
missing vocabulary users actually say — `copywriting` had no "button label" or "tooltip",
`systematic-debugging` no "flaky" or "intermittent", `scout` no "already installed". Adding it took
rank-1 from 62.3% to 69.2% on English with **zero regressions**, and `owner-at-1` fell 11.8 → 11.1,
so precision improved alongside recall. That is the signature of a real gap being closed rather
than keywords being stuffed: stuffing raises recall and costs precision.

Two limits worth knowing before chasing the number further. `od.triggers` are read by the audit and
by **no runtime hook** — vocabulary added there raises the score without helping production, which
is gaming, not fixing. And some phrasings are invisible by construction: the either/or shape of
"Redis or an in-memory store?" lives entirely in stopwords, so no edit to `strategy-compare` can
make a lexical ranker see it.

---

## 2. Length is a cost, never a credit

Every line of a description is paid for on every turn the resource is installed, whether or not it
is ever invoked. Every line of a craft is paid for on every dispatch that requires it.

**If two versions route the same, the shorter one is better.** Do not reward a longer body for
being thorough. There is no minimum length — a skill that does its job in 60 lines beats the same
skill padded to 200.

**The budgeted number is the positive claim, capped at 250 characters** — the description with its
boundary clause stripped. Nothing on `main` enforces it — `scripts/routing-audit.mjs` lives on the `measurement` branch, so this ceiling holds by author discipline alone. Treat it as a rule you apply, not a gate that will catch you. The ceiling
comes from the [gentle-ai skill style guide](https://github.com/Gentleman-Programming/gentle-ai)
(250 hard, 160 target) and was checked before adoption rather than after: measured 2026-08-29, our
claims ran to a median of 169 with 96% already under 250, so the ceiling ratifies the practice and
catches the two outliers. It binds — the longest claim in the corpus sits exactly at 250.

What is deliberately *not* budgeted, and why, because both look like oversights:

- **Whole-description length.** Forty percent of the surface is boundary clauses, and the only
  instrument that can weigh them is lexical — a proxy that penalises them by construction (§1).
  Budgeting a number you can only mismeasure optimises the metric against the practice.
- **Siblings named per description.** Every resource names one or two; none names three. A rule
  there would sit far below what the corpus already does, which makes it decoration, not a gate.

Two consequences that come up constantly here:

- **An unlinked reference is dead weight.** A file under `references/` that the body never points
  at is never loaded, so it costs package size and buys nothing.
- **Progressive disclosure is a budget decision, not a style.** The `anti-slop` craft carries five
  prose tells because it is injected into every design dispatch; the full forty-line audit lives in
  `prose-tells`, which loads only when a text is actually being audited. Same material, split at the
  point where the cost changes. See [context delivery](context-delivery.md).

---

## 3. An honest 7 beats a dishonest 9

A score that drives a fix is worth more than a score that clears a bar.

This applies to gates as much as to reviews. Two habits follow:

**Floors are set from measurement, not ambition.** `routing-audit.mjs` shipped with aspirational
floors (rank-1 ≥ 60%) that the corpus could not meet, which makes a gate people learn to ignore.
They were reset to the first honest measurement plus a small margin, and they ratchet upward only
when a change actually earns it.

**A check that cannot fail is a GAP, not a PASS.** Four states, not three:

| State | Meaning | Sets the failure flag? |
|---|---|---|
| `PASS` | ran, and the thing it checks holds | no |
| `FAIL` | ran, and the thing it checks does not hold | yes |
| `SKIP` | could not run — missing tool, missing target | no |
| `GAP` | ran, and had nothing to fail with | **no** |

A `GAP` never sets the failure flag. If it did, every project without that layer would start
failing a check that passed yesterday. It reports, loudly, and someone decides.

And the corollary, which is the whole point: **silence must not read as clean.** If an integrity
check did not run, the report says `NOT CHECKED` — never nothing.

---

## Verifying a gate in both directions

Before a new gate is trusted, mutate the thing it guards and watch it fail. Then restore and watch
it pass.

The second half is the one people skip, and it is not the safe side to skip. A gate that fires on
correct work gets muted, worked around, or wedges the pipeline that depends on it — and it is
*harder* to notice, because it arrives dressed as diligence.

Watch in particular for a check that matches **text** where it should match **structure**. "The path
appears in the string" is not "the write targets that location."

Three gates added on 2026-08-28 were mutation-tested both ways: dead `route_to`, a skill below the
case minimum, and a silently-empty triggers parser. The third existed because the parser was
written against the wrong indentation, matched nothing, and produced plausible numbers anyway.
