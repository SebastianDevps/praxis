# Seeded-defect eval — the refuter panel

**2026-08-28 · 24 cells + a 6-cell rerun · $29.83 · claude-sonnet-4-6 · 0 errors**

Does a panel with a mandate to refute find defects that a reviewer holding the builder's full
context does not — and if it does, is the gain the mandate or three times the compute?

Instrument: `evals/refute/`. Research behind the design: [`docs/adversarial-review.md`](../docs/adversarial-review.md).

---

## Arms

| Arm | Sessions | Mandate | Cost (8 cells) |
|---|---|---|---|
| `reviewer` | 1 × `reviewer` | status quo | $3.00 |
| `reviewer-x3` | 3 × `reviewer` | **same**, tripled compute | $8.87 |
| `refuters` | `refuter-correctness` + `-security` + `-tests` | **different** | $10.96 |

`reviewer-x3` is the control that matters. Without it, any gain from `refuters` is confounded with
running three sessions instead of one. Mean reply length came out at 6010 vs 5943 characters, so
output volume is controlled too.

Each lens runs as its own headless session with the agent body inlined as its role; the union is
assembled by the harness, not by a model. That scores what the lenses **found**, not what survived
a synthesis step.

---

## Result 1 — find rate: no difference at all

| Seeded defect | reviewer | reviewer-x3 | refuters |
|---|---|---|---|
| off-by-one in `paginate` | 1/1 | 1/1 | 1/1 |
| authorization gap (`req.query.userId` after `requireAuth`) | 2/2 | 2/2 | 2/2 |
| credential leak (`req.body` logged) | 2/2 | 2/2 | 2/2 |
| assertion that cannot fail (`toBeDefined`) | 2/2 | 2/2 | 2/2 |

Every arm found every seeded defect, every time. **The tasks were too easy.** Sonnet finds an
off-by-one, an IDOR, a logged password and a vacuous assertion regardless of the review contract.

This is the same failure that made the first arms run inconclusive: a metric every arm clears
measures nothing. It was predictable and it was not predicted.

## Result 2 — report shape: a clean separation, attributable to the mandate

Measured across all 24 cells by re-reading the saved replies (free, no new spend):

| Behaviour in the report | reviewer | reviewer-x3 | refuters |
|---|---|---|---|
| **demanded a repro or concrete evidence** | 1/8 | **0/8** | **7/8** |
| graded a finding as explicitly non-blocking | 0/8 | **0/8** | **5/8** |
| reported a `GAP` in those words | 1/8 | 5/8 | 8/8 |
| named the attack surface | 2/8 | 7/8 | 6/8 |

The load-bearing row is the first. **0/8 against 7/8 at matched compute and matched output
length.** Tripling the reviewer does not produce a single evidence-backed finding; the panel
produces them in seven cells out of eight. That is the contract, not the sampling.

The second row says the same thing differently: only the panel separates *this blocks* from *this
is a question*. The reviewer arms present every finding flat.

The last row is the honest counterweight — naming where you looked rises from 2/8 to 7/8 by
tripling the reviewer alone. That one is compute, not mandate.

## Result 3 — a "clean" fixture could not be built, and that is the finding

The `clean` task carried no seeded defect and measured whether an arm invents a blocker on correct
code. All three arms scored 0/2. Every cell claimed a blocker.

**First attempt.** They were right. The contract handed to every arm says the endpoint returns
invoices **one page at a time**. The fixture shipped a correct `paginate()` and a correct
`routes.js` and never wired them together:

```js
// src/routes.js — the "clean" fixture
res.json(invoicesFor(req.session.userId));   // returns everything

// src/paginate.js — exported, never imported
export function paginate(items, offset, limit) { ... }
```

Six of six reported an unwired pagination utility against a contract requiring pagination. Correct
finding; the metric scored it as a false positive.

The guard test passed. It asserted that the three *known* defects were absent and never asked
whether the fixture satisfied its own contract. Absence of the defects you thought of is not
correctness — the "can it pass?" question in `refuter-correctness`, asked of the eval instead of
the code, and not asked.

**Second attempt.** The fixture was rebuilt to satisfy every contract clause explicitly and the
guard rewritten to check them one by one. Re-run: **0/2, 0/2, 1/2.** They found something else.

```js
// src/token.js
if (token.exp < Date.now()) return { ok: false, reason: "expired" };
```

Two findings, both defensible:

- `Date.now()` is epoch **milliseconds** (~1.7×10¹²); a JWT `exp` is **seconds** (~1.7×10⁹). The
  fixture never states its unit. Every reviewer arm flagged it.
- A function named `verify()` that checks expiry and no cryptographic signature. The panel raised
  this one; the reviewer arms raised the unit mismatch.

**The conclusion is about eval design, not about the arms.** A false-positive metric assumes a
clean baseline exists. At this level of scrutiny it does not: realistic code carries defensible
criticism, and two independent attempts to write "obviously correct" code both failed against
reviewers reading it against a stated contract. **`did not invent a blocker` is not measurable this
way** and should be replaced by precision against a human-adjudicated finding list.

What it does say, positively, about all three arms: they find real defects consistently, including
ones nobody planted.

## Result 4 — a scorer bug, found by reading the replies rather than the table

The blocker predicate was `/\bBLOCK\b|…/`, which matches the word "block" inside **"Does not
block."** — scoring a report that explicitly declines to block as if it blocked.

The bias ran in one direction: the arm most likely to write that sentence is the panel, whose
contract asks it to grade a finding as non-blocking. The metric penalised the exact behaviour under
test. The selftest missed it because no probe contained a negation.

Fixed: negated forms are neutralised before positive blocking claims are tested, and four negation
probes are now permanent (`Does not block.`, `[NON-BLOCKING]`, `blocking: 0`, `Nothing here blocks
the merge.`). **Rescoring both runs changed no number** — today's blockers were genuine claims — so
the bug was real, latent, and would have fired the first time an arm declined to block without also
raising one.

Found only by reading the actual replies instead of trusting the table.

## What this justifies, and what it does not

**It does not justify the panel on find rate.** 3.65× the cost of `reviewer` for identical
detection on these defects. On this evidence, if the bottleneck is *finding* defects, the panel is
not worth its price.

**It does justify a narrower claim.** At matched compute the panel is the only arm that attaches
evidence to a finding and separates a blocker from a question. Whether that saves a tech lead time
is the thing worth measuring next, and it was not measured here.

**The literature narrows the reading further.** Published work already reports three adversarial
agents beating a five-agent baseline on defect detection. Our null on find rate is therefore weak
evidence against the effect and strong evidence that *these tasks* cannot see it.

---

## What to fix before spending again

1. **Harder defects.** If Sonnet finds them unaided, they measure the model, not the contract. A
   defect that needs cross-file reasoning, or one whose symptom points away from its cause.
2. **Measure the claim that actually survived.** Not "did it find the defect" but "how long does a
   human take to act on the report" — precision, ranking, and whether a blocker carries a repro.
3. **Keep `reviewer-x3`.** It is a third of the spend and it is the only reason Result 2 can name a
   cause. `tests/refute.test.mjs` fails if someone makes its three lenses diverse.

## Reproduce

```bash
node evals/refute/run.mjs --selftest              # free; 28 probes gate every spend
node evals/refute/run.mjs --run --n 2             # ~$23
node evals/refute/run.mjs --rescore <run-dir>     # re-score kept workspaces, no API calls
```
