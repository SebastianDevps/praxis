# Skill doctrine — the bar a Praxis resource has to clear

Adapted from the rubric in [`rsc-harness`](https://github.com/ericrisco/rsc-harness), which wrote
its test before any skill existed. Three rules do most of the work. They are here because each one
contradicts an instinct that feels like diligence.

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

---

## 2. Length is a cost, never a credit

Every line of a description is paid for on every turn the resource is installed, whether or not it
is ever invoked. Every line of a craft is paid for on every dispatch that requires it.

**If two versions route the same, the shorter one is better.** Do not reward a longer body for
being thorough. There is no minimum length — a skill that does its job in 60 lines beats the same
skill padded to 200.

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
