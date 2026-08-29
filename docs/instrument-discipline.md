# Instrument discipline — rules for anything that produces a number

Praxis measures itself: a routing audit, an activation audit, three paid evals, a validator, 137
tests. Every one of those is an instrument, and an instrument that is quietly wrong is worse than
no instrument, because it is trusted.

Over two days in August 2026 the same shape appeared five times: **the defect was in the
instrument, not in the thing being measured.** In every case, "fixing" what the number said would
have made the product worse to move the number. These are the rules that fall out of it, each with
the case that produced it.

---

## 1. A fixture must satisfy its own contract, clause by clause

Not "the defects I planted are absent." That is the absence of the failures you thought of, which
is not correctness.

**This one failed twice, one day apart.** In the refute eval, the `clean` task shipped a correct
`paginate()` and a correct `routes.js` and never wired them together, against a contract that said
the endpoint returns invoices one page at a time. All six review cells correctly reported it; the
metric scored all six as false positives. The guard test passed, because it only checked that the
three known defects were absent.

The next day, the Tier 3 routing smoke ran ten prompts in a bare workspace — one `README.md` — so
that a real repo could not steer the routing. Six of the prompts named code that did not exist:
*"Review this component"*, *"Audit this login handler"*, *"is there anything like it already in this
codebase?"* There was no component, no handler, no codebase. "No skill fired" and "the prompt had
nothing to act on" became indistinguishable, and the run could not answer the question it was built
for.

**Why it repeated:** the first lesson was written down as a fact about *that fixture* in
`evals/2026-08-28-refuter-panel.md`. A finding about one artifact does not generalise on its own.
That is the reason this file exists rather than a third eval write-up.

**The check:** before spending, read the fixture against the contract one clause at a time and ask
of each — *can a correct answer to this prompt be produced from what is here?* Write that as a test
(`tests/refute.test.mjs` does it clause by clause), and mutation-test the test by reintroducing the
original bug.

## 2. When a metric moves opposite to the practice it scores, suspect the metric

Three times, a number said our own doctrine was hurting us:

| the number said | the truth |
|---|---|
| the pairs that work hardest to distinguish themselves collide most | a `NOT x (that is \`y\`)` clause names the sibling, so bag-of-words counts the shared vocabulary as similarity |
| our descriptions are 2× over a published ceiling | the ceiling was written for a format with no boundary clause; our *positive claim* median was 169 against a 160 target |
| rank-1 is 55% | it was 69.2% on English prompts and 23.5% on Spanish, blended — and every description is English |

In all three, editing the corpus to satisfy the metric would have degraded the product. The fix was
to measure the right thing: strip boundary clauses before scoring collision, budget the claim
rather than the whole description, gate the language the instrument can actually read.

**The check:** before acting on a number that indicts a deliberate practice, ablate the practice and
re-measure. If the number improves while the artifact gets worse, the instrument is the defect.

## 3. Estimate cost from a measured cell, never from reasoning about the prompt

Three consecutive misses, all in the same direction:

| eval | estimated | actual |
|---|---|---|
| refute matrix | $10 | $31 |
| no-orchestrator rewrite | 40–50% cheaper | +12% on one arm |
| Tier 3 smoke | $0.05–0.15/cell | $0.30/cell |

Reasoning about prompt length does not predict cost; agents read, retry, and dispatch. The
60-cell run this smoke was gating would have been ~$18 against the $3–9 quoted.

**The check:** run one cell, read the real figure, then quote the matrix. The smoke pattern already
enforces it — it only has to be run first, every time.

## 4. Score from what the system can derive, never from what the model says

A reply that says *"I used `frontend-design`"* is narration. The `tool_use` block in the transcript
is derivable fact. The Tier 3 smoke reads transcripts for exactly this reason, and `checkIntegrity()`
in `evals/arms` verifies the arms from transcripts rather than from the flags it passed itself.

Adopted deliberately from
[gentle-ai](https://github.com/Gentleman-Programming/gentle-ai): *"trust what the system can derive,
not an agent's narration."*

## 5. Every scorer needs a probe for the wrong answer worded plausibly

Both scorer bugs this session were one-directional predicates that read fine:

- `/\bBLOCK\b/` matched the word inside **"Does not block."** — scoring a report that explicitly
  declined to block as if it had. The bias ran one way: the arm most likely to write that sentence
  was the one under test.
- Skills arrive as `praxis:test-coverage-plan`; the scorer compared bare names and reported **0/10
  where the truth was 2/10**, printing the correct skill name beside the word "other".

Neither was caught by a passing selftest, because no probe contained the failing shape. Both were
caught by reading the table instead of the number.

**The check:** for every metric, ship a `good`, a `bad`, an `alt` (a genuine hit worded differently)
and a `near` (the area named without the thing). `tests/refute.test.mjs` asserts all four exist for
every metric.

## 6. Mutation-test the gate, or you have a GAP

A check that cannot fail is not a PASS. Every gate added in this period was mutated both ways
before being believed — a no-op `stripBoundaries` fails four tests, a ceiling raised to 1000 fails
the decorative-budget assertion, a ledger renamed in one skill fails an invariant.

The exemplar of why: `routing-audit`'s triggers parser was written against four-space indentation
when the real format uses two. It matched nothing, every skill ranked without its triggers, and the
numbers looked plausible. Nothing failed. The fix was a test asserting a known trigger phrase
reaches the corpus.

**Four states, not three:** PASS · FAIL · SKIP (it could not run) · **GAP** (it ran and had nothing
to fail with). A GAP reports; it never sets the failure flag.

---

## The short form

> Before you fix what the number says, prove the number can be wrong.

The floors in `scripts/routing-audit.mjs` carry the same idea in one line: a floor is a description
of what holds today, never a wish. A floor above what the corpus can do trains people to ignore the
gate; a floor far below it is decorative.
