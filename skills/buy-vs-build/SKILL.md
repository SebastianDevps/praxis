---
name: buy-vs-build
description: Use when deciding whether to build a capability in-house or source it — SaaS, vendor, or open source — classifying it as commodity or differentiator before comparing anything, and naming a build · buy · bounded-buy · extend-what-exists verdict. NOT scoring options already narrowed to a shortlist (that is `strategy-compare`), NOT attacking a decision already made (that is `decision-challenge`), NOT one package's adoption (that is `dependency-adoption`).
kind: skill
od:
  category: reasoning
  triggers:
    - build or buy
    - buy vs build
    - vendor
    - "in-house or SaaS"
    - source this capability
---

# Buy vs build — sourcing a capability

A capability has to exist. This decides how it comes to exist: built by us, bought from a vendor,
bought inside a boundary, or grown out of something already here.

**Source disclosure, because it changes how you read what follows.** The classifier and the criteria
sets below come from Thoughtworks, *"Build vs. buy: A strategic framework for evaluating third-party
solutions"* (2022) —
https://www.thoughtworks.com/content/dam/thoughtworks/documents/e-book/tw_ebook_build_vs_buy_2022.pdf.
Thoughtworks sells build-side consulting. Its **"shift toward build" thesis is advocacy** and should
be argued with, not adopted. Its **criteria tables are product-neutral** and are the reason this
skill cites the e-book at all. Read the first as an argument and the second as a checklist.

## When to use

Someone asks whether to build something or get it from outside, and no shortlist exists yet. If the
candidates are already picked and the ask is which one, that is `strategy-compare`. If the object is
a single npm or pip package, that is `dependency-adoption`. If the vendor is already signed and the
ask is whether to go ahead, that is `decision-challenge`.

## Step 1 — Scope the capability, not the product

This step decides more than the criteria do, and it is where the answer is usually lost.

> *"A common mistake is to scope at the level of the package resulting in capabilities which are too
> broadly defined."*

A system is rarely all-commodity or all-differentiator. "Should we buy a CRM" cannot be answered;
"should we buy contact de-duplication" can. Split the ask until every piece carries its own verdict —
a piece that needs two verdicts is still two capabilities.

**Done when** each scoped capability fits in one sentence with no "and" in it, and you could hand any
one of them to a different person and get a verdict back.

## Step 2 — Ask the question once

> **Is this function how we beat competitors?**

Ask it once. Fowler's *utility vs strategic*, Thoughtworks' *commodity vs differentiator* and Moore's
*core vs context* are **one axis under three names**, not three frameworks — running them as three
passes produces three restatements of the same answer and reads as rigour. Moore's version
(*Dealing with Darwin*, 2005) is cited constantly second-hand and is **UNVERIFIED** here: the primary
source is not retrievable online. Cite Fowler.

The two ends, verbatim from the e-book:

> *"**Commodity capabilities** are required by your company but aren't unique to you. Common examples
> include payment and payroll tools. These capabilities offer little to no competitive advantage"*

> *"**Differentiator capabilities** are how your company differentiates itself in the market."*

The load-bearing part is Fowler's **risk asymmetry**
(https://martinfowler.com/bliki/UtilityVsStrategicDichotomy.html) — the labels change nothing on
their own, the asymmetry changes what you optimise:

| | utility / commodity | strategic / differentiator |
|---|---|---|
| default move | *"for a utility function you buy the package and adjust your business process to match the software"* | *"you don't want the same software as your competitors because that would cripple your ability to differentiate"* |
| biggest risk | *"some kind of catastrophic error"* | not doing something before your competitors do |
| optimise for | minimising cost | time to the differentiating capability |

So on a utility function, an over-run budget is the failure. On a strategic one, a competitor
shipping first is — and a cheaper, later answer is the worse answer.

## Step 3 — Extend what exists, before build or buy

Stage one of the framework asks whether you can **replace or extend existing solutions** before
sourcing anything new. When that holds it wins outright: no vendor, no new surface, no migration.
It is a verdict in its own right — `extend-what-exists` — not a preamble to the real question.

## Step 4 — Evaluate candidates over one consistent criteria set

Checklists, not a spreadsheet. Nothing here computes a weighted score; the criteria exist to make
missing evidence visible, and a total hides exactly that.

**Seven stakeholder groups** decide who has to answer, so the call is not owned by engineering alone:
Finance · Product managers · End users (or a proxy) · Engineers · Infrastructure and IT operations ·
Back-office operations · Compliance and security.

The four criteria sets — **18 developer-experience** · **7 technical needs** · **5 operability** ·
**9 vendor** — and the **4 TCO/ROI rules** are in `references/criteria.md`. Two of their rules are
non-negotiable and belong here:

- Every technical need carries a number: *"Ideally, you'll want to assign metrics and service levels
  to each one."* "Good availability" is not a criterion; `99.9% monthly, measured at the edge` is.
- SaaS, on-prem and a custom build are compared *"over a consistent set of criteria including (but
  not limited to) availability, resiliency, recoverability, service-level agreements (SLAs) and
  cost."* Scoring a vendor on features and your own build on effort is not a comparison.

## Step 5 — Lock-in mitigation is an output, not an option

Any verdict that ends in a vendor ships with its mitigation named in the same breath.

**Bounded buy** — Thoughtworks Radar, Trial, November 2018,
https://www.thoughtworks.com/radar/techniques/bounded-buy:

> *"Only select vendor products that are modular and decoupled and can be contained within the
> Bounded Context of a single business capability."*

It exists to prevent the **Vendor King** anti-pattern, where the product's model becomes the
company's model. (That name is verified only from the e-book's own text; a standalone Radar blip
page for Vendor King is **UNVERIFIED** — do not cite one.)

The floor is coupling: *"put it behind an API to limit direct exposure."* The rest — flexible
pricing, open networks and open architecture, the two `PackageCustomization` checks, and the radar
rings used when the answer needs an alternatives landscape — is in `references/lock-in.md`.

## Output contract

```
CAPABILITY     <one sentence, no "and">
AXIS           commodity | differentiator — the answer to the one question, with its reason
EXISTING       what could be extended or replaced instead | NONE (methods: …)
CANDIDATES     <each, tagged: SaaS | on-prem | open source | in-house build>
CRITERIA       <criterion → PASS | FAIL | SKIP (why it could not be checked) | GAP>
STAKEHOLDERS   <groups consulted; the rest listed as SKIP with the reason>
LOCK-IN        <the mitigation, or why none is needed>
VERDICT        build | buy | bounded-buy | extend-what-exists
OVERTURNED BY  <the specific finding that would flip this verdict>
```

**Four states, never a neutral score.** A criterion with no evidence is `SKIP` carrying the reason —
not a middle number, not a blank. A vendor who never answered and a vendor who answered "no" are
different findings, and a score column erases the difference. `GAP` is for a criterion that ran and
had nothing to fail against: no compliance requirement exists, so the vendor's compliance posture
had nothing to be measured against. A `GAP` reports; it does not fail.

**The verdict names what would overturn it.** Not a confidence level — a finding: *"buy, overturned
by the vendor declining a data-export API"*, *"build, overturned by any candidate meeting the 7
technical needs under 12 weeks of integration."* A verdict nobody can disprove is a preference.

## Do not cite these

Checked and found wanting, so the model does not reach for them from memory:

- **a16z** — only AI-era survey data, no evaluation structure.
- **Gartner** — paywalled. Treat any blog quoting "Gartner's build-vs-buy criteria" as second-hand.
- **MIT CISR** — nothing on this topic.
- **Thoughtworks' "Buy versus Build Shift" blog series** — advocacy essays, no evaluation structure.
- The labels **"opportunity cost"**, **"switching cost"** and **"time-to-market"** appear as named
  criteria in none of the primary sources here. Their substance lives under coupling, lock-in and
  resource focus. Use the substance; do not attribute the labels.

## It's working if

- The first artefact produced is a scoped capability, not a vendor comparison table.
- Someone can read the output and say which single finding would change the answer.
- Sections the target gave nothing for read `SKIP` with a reason, so a short report is legibly short
  rather than quietly incomplete.
- A `buy` or `bounded-buy` verdict never appears without a mitigation next to it.
- The differentiator question is asked once and answered once, in the words of one source.

## Anti-patterns

- Scoring vendors before the capability is scoped — the granularity error, and no amount of scoring
  recovers from it.
- Running commodity-vs-differentiator, utility-vs-strategic and core-vs-context as three passes.
- Averaging criteria into a single number, so an unanswered question becomes a middling score.
- `buy` with no boundary and no mitigation — the shape Vendor King arrives in.
- Comparing the vendor on its feature list and the build on a sprint estimate.
