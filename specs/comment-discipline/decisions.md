---
title: Comment Discipline
---

# Comment Discipline — Decisions

## ADR-001 — Three tiers split by false-positive risk, not one policy

**Status:** accepted

**Context.** The owner's first framing, and mine, was a single question: does the hook block, ask, or
report? That framing is wrong, because the patterns it would apply to do not carry the same risk.
"This comment is a `// =====` divider" requires no understanding of the code. "This docstring merely
restates its function name" requires knowing whether the language mandates that docstring.

**Decision.** The tier decides the response.
- **Tier 1 — deny.** Commented-out code, banner/divider comments, chain-of-thought leakage, and a
  `TODO` with no owner or tracker. None requires reading the code to judge.
- **Tier 2 — report to the reviewer.** The restatement check.
- **Tier 3 — prose in the craft.** Level of detail, why-not-what, Fowler's escalation.

**Consequences.** Three mechanisms instead of one, and three places to keep true. Accepted because
the alternative is either a floor that blocks correct work or a rule with no teeth, and this repo has
already paid for both mistakes once.

**Confirmation.** The acceptance carries a false-positive gate per tier-1 pattern, and it is stated
there as mattering *more* than the detection gate.

---

## ADR-002 — Deny is proportionate only when the fix is one keystroke

**Status:** accepted

**Context.** The spec floor's deny works because the fix is cheap and mechanical: create a file. A
deny whose fix requires judgment turns into a retry loop that costs a turn and teaches nothing.

**Decision.** Tier 1 denies because its fix is "delete the line". Nothing else denies.

**Consequences.** The obvious escalation — "then deny the restatement check too, it is the real
problem" — is refused on purpose. Naming the refusal here so it is argued rather than re-proposed.

**Confirmation.** `rg -n 'deny' hooks/pre-tool-use` shows tier-1 patterns and the spec floor, nothing
from tier 2.

---

## ADR-003 — Density is the wrong instrument, and this is why it will not be proposed again

**Status:** accepted

**Context.** The intuitive gate is "flag files whose comment density exceeds X%". The largest
empirical study of AI-generated code in real repositories measured it directly
([arXiv 2603.27130v2](https://arxiv.org/html/2603.27130v2)): **18.01% for AI-generated code against
17.96% for human-written**. The survey also found no published maximum-density threshold in any tool
or paper — SonarQube publishes `comment_lines_density` and teams gate on a *minimum*.

**Decision.** No density threshold anywhere in this change. The defect is redundancy per comment, and
the checks are keyed to individual comments.

**Consequences.** A whole class of easy-looking checks is off the table. That is the point: they
would report clean on exactly the output this change exists to fix.

**Confirmation.** `rg -in 'density|ratio' crafts/comment-discipline/ hooks/pre-tool-use` returns
nothing that gates on one.

---

## ADR-004 — Every rule states what to write, never what to avoid

**Status:** accepted

**Context.** `docs/skill-doctrine.md:196` records the failure and its cure: *"`don't X` makes X more
available, not less"*. A craft opening with "do not write junk comments" would put the junk in the
model's context at the moment of writing.

**Decision.** Every rule in the craft is positive. The anti-patterns appear once, named, in a section
placed after the rules — never as the rule itself.

**Consequences.** Longer to write and harder to phrase than a list of prohibitions.

**Confirmation.** The craft's rule lines contain no leading "don't", "never", or "avoid"; the
anti-pattern section is a single named block below them.

---

## ADR-005 — Language convention outranks the sparseness rule

**Status:** accepted

**Context.** Go mandates a doc comment on every exported name (`go.dev/doc/comment`: *"Every exported
(capitalized) name should have a doc comment"*). Rust's API guidelines mandate an example on every
public item (C-EXAMPLE). Both necessarily echo the identifier, which is exactly what the tier-2 check
flags. PEP 257 and Google's pyguide scope their requirements to *public* entities and say nothing
about private ones.

**Decision.** Public and exported surfaces are carved out of tier 1 entirely and reported only under
tier 2. The craft names Go and Rust explicitly rather than leaving it to inference.

**Consequences.** Praxis will not make a Go file fail `revive` or a Rust crate fail its own
guidelines. The cost is that the noisiest surface in those languages is the one Praxis touches least.

**Confirmation.** The false-positive gate includes a Go exported doc comment and a Rust public item
with an example; both must be allowed.

---

## ADR-006 — A craft, not a skill

**Status:** accepted

**Context.** Crafts are always-on and injected into the dispatches they govern
(`crafts/*`, and the injection in `hooks/subagent-start`). Skills activate by winning a
description match. Comment discipline applies to every turn that writes code, and never as the
subject of the turn.

**Options.** (a) A craft. (b) A skill. (c) Extend `crafts/minimalism`.

**Decision.** (a). (b) would have to win a routing match against 44 siblings on a turn about
something else, which is the wrong mechanism for an always-on discipline. (c) was rejected because
`minimalism`'s unit of concern is code structure and dependencies throughout, and stretching it to
annotation volume would blur a craft that is currently sharp.

**Consequences.** A seventh craft, injected into every code dispatch, which is context cost on every
build turn. It must therefore be short — this is the one place where length is a direct tax.

**Confirmation.** `crafts/comment-discipline/comment-discipline.md` is at most as long as the longest
existing craft, and the routing audit's EN rank-1 is measured with the file moved out and back.

---

## ADR-007 — The craft ships unpaid, and the eval that would settle it names its own conditions

**Status:** accepted — approved by the owner

**Context.** T05 ran the craft against a control and against a bare model with no plugin loaded.
9 cells, 3 arms, 2,102 lines of emitted code, 125 comments, $13.98:

```
                lines  comments  restates  banner  CoT   redundant/100
treatment         706        42         0       0    0            0.00
control           645        37         0       0    0            0.00
bare              751        46         0       0    0            0.00
```

**Zero defects everywhere.** Not a tie — a **GAP**. The check ran and had nothing to fail with, so
there was nothing for the craft to remove. Reporting that as a clean PASS would be the exact failure
`docs/skill-doctrine.md` §3 exists to prevent.

**Why it did not reproduce, with evidence rather than a guess.** `node --test` was denied 22–36 times
per cell, in all nine, identically across arms. **No arm ever iterated against a failing test** — and
iteration is the channel [claude-code#65961](https://github.com/anthropics/claude-code/issues/65961)
describes the defect accumulating in. The run did not sample the condition the defect lives in. This
is the same shape as this repo's refuter-panel result: a metric every arm clears measures nothing.

**Decision.** The craft ships, recorded as **unmeasured, not proven** — and the README carries no
number for it, because there is none to carry.

**Why not cut it.** Deleting a craft on an eval that could not have detected its effect draws the
wrong conclusion from a correct datum. What failed here is the measurement's design, not the craft.

**What is given up, stated plainly.** The craft costs **4,685 bytes on every builder dispatch**, and
this run found nothing bought with it. That is a standing, recurring cost against no measured
benefit, and it stays visible in this ADR rather than fading once the change is shipped.

**What is NOT affected.** T02 proved the hook mechanically — four patterns, both directions, 22
legitimate comments allowed, and 0 false positives across a sweep of 71 real source files. That
evidence is independent of this result and stands.

**Confirmation — the eval that would settle it, named now so it is not invented later.** A long
session with `Bash` enabled, the model iterating against failing tests, n≥3 per arm, on the channel
where #65961 reports the defect. Until that runs, the craft's behavioural claim is unmeasured and no
surface may state otherwise.
