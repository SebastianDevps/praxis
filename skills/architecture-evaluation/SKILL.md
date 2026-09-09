---
name: architecture-evaluation
description: Use when judging whether an architecture will hold under its quality requirements — latency, availability, cost, security, change — naming which architectural decisions are risks or non-risks and which properties are sensitivity or tradeoff points. NOT drawing what the architecture is (that is `project-teardown`), NOT designing one module's seam (that is `codebase-design`).
kind: skill
od:
  category: research
  triggers:
    - architecture evaluation
    - ATAM
    - tradeoff analysis
    - quality attributes
    - sensitivity point
---

# Architecture evaluation — will it hold?

The method is ATAM, imported as text from its primary source: **CMU/SEI-2000-TR-004**, *ATAM: Method
for Architecture Evaluation*, Kazman, Klein & Clements, August 2000
(https://www.sei.cmu.edu/documents/629/2000_005_001_13706.pdf).

> *"The purpose of the ATAM is to assess the consequences of architectural decisions in light of
> quality attribute requirements."*

> *"The ATAM is meant to be a risk identification method."*

Risk identification, not a score. The output is a named list of decisions and the attributes they
pull on, each with the evidence and the condition that would overturn it.

## Before you start — three inputs, and the stop

The evaluation runs on three things, all of which come from the target, none of which you supply:

1. **Business drivers** — what the system is for, and what "doing well" means to whoever paid for it.
2. **An architecture description of sufficient detail** — components, their relationships, and the
   decisions behind them. A README is not one.
3. **The quality-attribute requirements** — the latency, availability, cost, security and
   modifiability the system is actually held to.

**When the target is a foreign system with no stated quality requirements, stop.** Ask one question
naming the attribute you need a number for, and wait. If the answer cannot be had — a public repo
with no stated SLO — the affected sections are `SKIP` with that reason. An evaluation against
invented requirements is worth less than no evaluation, because it reads exactly like a real one.

## The nine steps

Verbatim from TR-004 §8:

1. Present the ATAM
2. Present Business Drivers
3. Present Architecture
4. Identify Architecture Approaches
5. Generate Quality Attribute Utility Tree
6. Analyze Architecture Approaches
7. Brainstorm and Prioritize Scenarios
8. Analyze Architecture Approaches
9. Present Results

Steps 6 and 8 share a name deliberately: **6** runs the analysis against the utility-tree scenarios
you derived from the business drivers; **8** re-runs the same analysis against the scenarios
stakeholders brainstormed in step 7. The second pass is where the scenarios nobody planned for
surface.

The order is a sequence, not a gate chain — TR-004: *"Although the steps are numbered, suggesting
linearity, this is not a strict waterfall process."* Return to step 5 when step 7 exposes a driver
the tree missed.

## The five outputs

These definitions are the method. Reproduce them when applying them — a paraphrase turns a
sensitivity point into "an important thing", and the distinction from a tradeoff point is what
carries the value. All from TR-004 §7.

**Risk** — *"potentially problematic architectural decisions"*. Document in three parts:

- the architectural decision — **or a decision not made**;
- the specific quality-attribute response being addressed, and the consequences of the predicted
  response level;
- a rationale for the positive or negative effect on meeting the requirement.

**Non-risk** — *"good decisions that rely on assumptions that are frequently implicit in the
architecture"*. Carries a standing condition, and the condition is what makes it actionable later:
*"for a non-risk to remain a non-risk the assumptions must not change."* State the assumption
explicitly, so that the day it changes, someone can find this line.

**Sensitivity point** — *"a property of one or more components (and/or component relationships) that
is critical for achieving a particular quality attribute response"*. *"They serve as yellow flags:
'Use caution when changing this property of the architecture.'"*

**Tradeoff point** — *"a property that affects more than one attribute and is a sensitivity point
for more than one attribute"*; *"the most critical decisions that one can make in an architecture."*
Every tradeoff point names the two or more attributes it pulls against, and appears in the
sensitivity list once per attribute.

**Utility tree** — *"used to translate the business context first into quality attribute drivers and
then into concrete scenarios that represent each business driver. Each scenario is described in terms
of a stimulus and the desired response. These scenarios are prioritized in terms of how important
they are to the overall mission of the system and the perceived risk in realizing them."*

Construction and the dual prioritization: `references/utility-tree.md`.

## Output contract

One section per quality attribute in the utility tree, plus the four cross-cutting lists. **No
section is omitted.** A report where every section is filled is either a complete target or a
fabricating agent, and the reader cannot tell which.

Each utility-tree scenario is reported in one of four states:

| State | Meaning here |
|---|---|
| `PASS` | analyzed, and the architecture meets the response — record it as a **non-risk**, with its assumption |
| `FAIL` | analyzed, and the response is not met or is at hazard — record it as a **risk**, in its three parts |
| `SKIP` | could not analyze — no architecture detail, or no stated requirement to analyze against. Say which |
| `GAP` | analyzed, and **no architectural decision bears on this attribute at all**. Report it in those words |

```
DRIVERS         <business drivers, as stated by the target>       | SKIP (reason)
UTILITY TREE    <attribute → refinement → scenario (stimulus/response), (importance, risk)>
APPROACHES      <the architectural approaches identified in step 4>
RISKS           <decision | response + consequence | rationale>
NON-RISKS       <decision | the assumption it rests on>
SENSITIVITY     <property → the one attribute it is critical for>
TRADEOFFS       <property → the attributes it pulls against, both ways>
SKIPPED         <every section that could not run, with the reason>
```

`GAP` never means failure. It means the architecture is silent where a requirement is loud, which is
a finding worth more than most risks — report it, do not quietly leave the row out.

## Where the output lands

arc42 **§9 Architecture Decisions** takes the risks, non-risks and tradeoff points; **§10 Quality
Requirements** takes the utility tree. The sibling `project-teardown` produces the arc42-shaped
dossier this plugs into — hand it these sections rather than restating the architecture around them.

## What this is not

ATAM ships its own boundary, and it is imported because it keeps the method honest:

> *"We do not do extensive formal modeling in an ATAM; this is not the intention of the method. The
> ATAM's primary goal is in determining where sensitivity points and tradeoffs exist."*

So: no queueing model, no simulation, no capacity projection. If a number is needed to settle a
scenario, name the measurement someone would have to run, and mark the scenario `SKIP` until they do.

**The phase model is deliberately not imported, and this is a stated disagreement between two primary
sources.** TR-004 §9 is titled *"The Two Phases of ATAM"* — *"The first phase is
architecture-centric… The second phase is stakeholder-centric"*. The widely-cited four-phase (0–3)
model comes from a different source: Clements, Kazman & Klein, *Evaluating Software Architectures*
(Addison-Wesley 2002), Table 11.2, verifiable only through a university-hosted reproduction.
Encoding "four phases" would encode a contradiction. The nine steps and the five output types are
unambiguous in one source; the phases are not, so they are left out. Full sourcing:
`references/phases-disagreement.md`.

## It's working if

- The report names at least one **non-risk with its standing assumption**, not risks alone — a report
  of pure risk is unbalanced, and the assumption is what someone re-checks a year from now.
- Every tradeoff point names the two or more attributes it pulls against, and each of those
  attributes also carries it in the sensitivity list.
- Sections the target gave nothing for read `SKIP` with the reason, so the report is visibly partial
  where the target was partial.
- When the system had no stated quality requirements, the run stopped on one question instead of
  producing a full-looking evaluation.
- Each finding says what would overturn it — the assumption that must not change, or the measurement
  that would settle it.

## Anti-patterns

- Inventing quality-attribute requirements because the target did not state any.
- Reporting risks only, so the architecture reads worse than it is and no assumption gets recorded.
- Calling a property a tradeoff point without naming a second attribute — that is a sensitivity point.
- Building a formal model to settle a scenario, when the method's own scope stops at naming where
  the sensitivities are.
- Describing the architecture instead of judging it — that reconstruction is `project-teardown`'s job,
  and this skill consumes it rather than redoing it.
