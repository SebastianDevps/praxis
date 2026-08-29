# Adversarial review — why the panel is built this way

Research behind the `refuter-*` agents, gathered 2026-08-28 before spending on the seeded-defect
eval. Recorded because the design was adopted from one repository's practice, and practice is worth
less than practice plus published evidence — especially when the evidence narrows what our own
experiment is allowed to claim.

---

## The three claims the panel rests on

### 1. A reviewer denied the builder's reasoning finds more

The `refuter-*` contract gives each lens exactly four inputs — task contract, spec, exact source
state, entry point — and withholds the builder's conversation, reasoning, defences and draft
verdict. The stated reason is anchoring: *a reviewer looking for confirmation finds confirmation.*

**Published support.** [Adversarial Review: Structured Disagreement for Grounded Agentic Code
Review](https://arxiv.org/abs/2608.18167) formalizes a coding agent plus a reviewer plus a **critic
that audits the review through structured disagreement**. Disagreement is the mechanism, not a
side-effect of having more agents.

### 2. Diversity of lens beats number of passes

The contract says *"what matters is not the number of lenses but their diversity — the worst defect
a panel finds is usually found by the lens that was not looking for it."*

**Published support.** Different training distributions produce **different systematic gaps**, and
that epistemic diversity is what widens coverage; diverse perspectives from several smaller models
can produce a verification signal strong enough to improve a stronger generator. Diversity has to be
maintained deliberately — Self-Consistency does it through temperature and top-k, DIV-SE by asking
explicitly for different approaches.

The load-bearing comparison: on LiveCodeBench, Adversarial Review **outperformed a five-agent
baseline using only three agents.** More agents with the same mandate lost to fewer agents with
opposed mandates. That is the `reviewer-x3` vs `refuters` question, already answered once in
someone else's system.

### 3. It finds defects that matter, not just more findings

**Published support.** [Refute-or-Promote: An Adversarial Stage-Gated Multi-Agent Review
Methodology for High-Precision LLM-Assisted Defect Discovery](https://arxiv.org/pdf/2604.19049)
reports real CVEs discovered in OpenSSL and libfuse. The name states the mandate: refute, and
promote only what survives.

---

## What this does NOT settle

**It is not our measurement.** Those results are other systems on other benchmarks. That a
well-constructed adversarial protocol beats a same-mandate baseline says nothing about whether the
contract in `agents/refuter-*.md` is well constructed. A badly written adversarial prompt is still
a badly written prompt.

**It shrinks the claim our eval is allowed to make.** Before this research the eval was asking "does
this effect exist?" It now asks the narrower "does our implementation deliver a known effect?" That
is still worth answering — it is the difference between adopting a pattern and adopting a working
copy of it — but it is a smaller claim and should be reported as one.

**It raises the bar on a null result.** If our panel does NOT beat `reviewer-x3`, the published work
makes "the effect is not real" an unlikely explanation. The likelier ones are our contract, our
seeded defects being too easy, or n being too small — and the honest report has to say which was
checked.

---

---

## The disposition gap, and where the taxonomy came from

The design above says how to *produce* findings and never says how to *dispose* of them. Praxis
routed them by severity and evidence — blocking if it carries a repro, a question if not — which
answers "how urgent is this?" and never answers "**is this finding right?**"

That gap is created by our own mechanism. Blind-first withholds the builder's reasoning on purpose;
a lens denied that context will sometimes flag something correct under context it was never given.
We manufacture false positives deliberately and then had no named way to dispose of one. Our own
seeded-defect eval hit it: two independent attempts to write an "obviously correct" fixture both
drew defensible findings, and the metric scored them as errors because nothing distinguished *this
reviewer is wrong* from *this reviewer lacks context*.

The four classes are adapted from
[`doubt-driven-development`](https://github.com/addyosmani/agent-skills), whose framing is the load-
bearing part: **"The reviewer's output is data, not verdict. You remain the orchestrator."** And its
counterweight, which matters more for us: *"A fresh reviewer can be wrong — lack of context causes
false positives. Don't defer just because it's 'fresh.'"*

Two things we changed rather than copied:

- **`contract gap` is first, and it re-dispatches.** Every lens receives the same four inputs, so an
  unclear contract corrupts the whole wave, not one finding. Addy's version fixes the contract and
  re-classifies next cycle; ours throws the wave away, because our lenses run in parallel off one
  contract rather than sequentially.
- **`noise` must name the context the lens lacked.** It is the only class that disposes of a finding
  while changing nothing, so it is the one that rots. Unqualified, it becomes a dismissal button —
  and the eval already showed us reaching for it wrongly.

Also adopted: the anti-rubber-stamp check. Addy's phrasing is a checkable signal — across two or
more cycles with substantive findings, zero classified actionable means you are validating, not
doubting. Ours is the single-wave form: a wave classified entirely as noise is a signature, not an
outcome.

**Not adopted: telling the refuters about it.** A lens that knows how its findings will be
classified pre-classifies them — the same bias as passing it the builder's verdict, which the whole
four-input contract exists to prevent.

---

## What it changed in the design

Nothing in the agents. It changed the eval:

- `reviewer-x3` was already the control that separates mandate from compute. The literature confirms
  that is the comparison worth paying for, so it stays even though it is a third of the cost.
- The write-up must frame the result as replication, not discovery.

---

## Sources

- [Adversarial Review: Structured Disagreement for Grounded Agentic Code Review](https://arxiv.org/abs/2608.18167) — arXiv 2608.18167
- [Refute-or-Promote: An Adversarial Stage-Gated Multi-Agent Review Methodology](https://arxiv.org/pdf/2604.19049) — arXiv 2604.19049
- [LLM-Based Multi-Agent Systems for Code Generation: A Multi-Vocal Literature Review](https://arxiv.org/pdf/2604.16321) — arXiv 2604.16321
- [Adversarial Code Review: Why the Maker Shouldn't Grade the Checker](https://www.augmentcode.com/guides/adversarial-code-review) — practitioner write-up
- [LLM Consortium for Software Design Refinement: A Controlled Experiment on Multi-Agent Collaboration Topologies](https://arxiv.org/pdf/2606.01490) — arXiv 2606.01490
