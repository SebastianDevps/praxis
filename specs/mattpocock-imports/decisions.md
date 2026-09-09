# Matt Pocock Imports — Decisions

## ADR-001: Import method as text inside the floor; never import his process ownership

### Context
Matt's thesis is that frameworks which own the process "take away your control". Praxis just
built a mechanical floor. The owner wants a senior engineer, not a second framework.

### Options Considered
1. Adopt his skill set wholesale (25 promoted skills, tracker integration, `/implement`).
2. Import the engineering method (tdd, design vocabulary, grilling, red-first debugging, two-axis
   review, slice sizing) as edits to Praxis resources, and keep the floor as the only enforcement.
3. Import nothing; keep Praxis's process-only shape.

### Decision
Option 2. His method and Praxis's floor are complementary by his own account: he has zero hooks and
zero evals; Praxis has both and thin method.

### Consequences
- Every import is a bounded edit with its source cited; nothing publishes or commits on its own.
- His skills that publish (`to-tickets`, `triage`, `wayfinder`) or commit (`implement`) stay out.

## ADR-002: The reviewer reads the standards; the implementer does not

### Context
sandcastle loads `CODING_STANDARDS.md` only in the review phase "so these standards are enforced
during review without costing tokens during implementation"; `retro` says the implementer carries
all the context pressure. Praxis's `/praxis:init` now scaffolds `agents/rules/`.

### Decision
`agents/rules/` (and `CONSTRAINTS.md` where present) are injected to `reviewer`, not to builders.
Builders get `tdd` and `codebase-design`; the reviewer gets the rules and the Fowler floor.

### Consequences
- `subagent-start` keeps injecting crafts to builders; the rules travel only with `reviewer`.
- A violation the implementer would have avoided costs one review round. Accepted: cheaper than
  paying the rules on every build turn.

## ADR-003: Refactor lives in review, not in the build loop

### Context
Matt removed refactor from red→green in June 2026 because agents did not do it; review owns it.
Praxis's `deep` mode already separates review into a fresh context (refuters).

### Decision
`tdd` is red→green. Refactoring is a Standards finding in `reviewer`, applied as its own task.
Measured, not assumed: the `tdd` value unit records whether a refactor step appears anyway.

## ADR-004: Two axes, never merged

### Context
`code-review` runs Standards and Spec as separate subagents and forbids reranking across them.
Praxis's reviewer has readability and architecture axes and no spec axis, while every change now
has a `design.md`.

### Decision
Reviewer = Standards (Fowler floor + repo rules) and Spec (against `design.md`), separate contexts,
separate sections, no cross-axis ranking. Readability and architecture fold into Standards.

## ADR-005: Mechanical follow-ups are their own specs

### Context
A git guard on `Bash`, a validator for `## It's working if`, and an invocation policy are each a
hook or a gate with a mutation test and, for the policy, a routing measurement.

### Decision
Kept out of this change. Text first, gates second, each with its own evidence — the repo's own
rule since the floor.

## ADR-006: The seam-confirmation stop is prose, and it did not hold unattended

### Context
`evals/value` unit `tdd`, n=3 vs control, $10.10: "seams named and confirmed before any test
file exists" held 0/3 in treatment (the model declared its seam and built); vertical slicing held
3/3 vs 0/3, and "no refactor in the loop" 6/6. Same class as the approval stop before ADR-006 of
`spec-driven-workflow`: a stop the model may skip is a stop it skips in `-p`.

### Options Considered
1. Accept: interactive behaviour unmeasured; the slice discipline is the measured win.
2. Make the first test-file write at `stage: planned` an `ask`, like the design approval.
3. Fold seam confirmation into `design.md` (a "Seams" line the approval already covers).

### Decision
Option 3, as a follow-up (`future-work.md` DFU-6): the seam belongs to the design the person
approves, not to a second prompt. Nothing changes in this change; the negative is recorded.

### Consequences
- `tdd`'s first "It's working if" bullet stays, marked as unmeasured interactively.
