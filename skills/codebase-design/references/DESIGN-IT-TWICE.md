# Design it twice

When the user wants to explore alternative interfaces for a chosen deepening candidate, use this
parallel-dispatch pattern. Based on "Design It Twice" (Ousterhout): the first idea is unlikely to
be the best one.

Uses the vocabulary in `../SKILL.md`: **module**, **interface**, **seam**, **adapter**,
**leverage**, **locality**.

## Process

### 1. Frame the problem space

Before dispatching anyone, write a user-facing explanation of the problem space for the chosen
candidate:

- The constraints any new interface has to satisfy
- The dependencies it relies on, and which category each falls into (see `DEEPENING.md`)
- A rough illustrative code sketch that grounds the constraints — not a proposal, a way to make
  the constraints concrete

Show this to the user, then proceed straight to step 2. The user reads and thinks while the
specialists work in parallel.

### 2. Dispatch specialists in parallel

Dispatch three or more specialists in one turn (the `orchestration` craft: one message, multiple
dispatches — that is what makes it a wave). Each must produce a **radically different** interface
for the deepened module.

Give each one a separate technical brief: file paths, coupling details, the dependency category
from `DEEPENING.md`, what sits behind the seam. The brief is independent of the user-facing
explanation in step 1. Give each a different design constraint:

- Specialist 1: "Minimize the interface: 1–3 entry points at most. Maximize leverage per entry
  point."
- Specialist 2: "Maximize flexibility: support many use cases and extension."
- Specialist 3: "Optimize for the most common caller: make the default case trivial."
- Specialist 4 (when it applies): "Design around ports and adapters for cross-seam dependencies."

Include the `SKILL.md` vocabulary and the project's domain glossary (`CONTEXT.md` where one
exists) in every brief, so each design names things consistently with the architecture language
and the domain language.

Each specialist returns:

1. The interface — types, methods, params, plus invariants, ordering, error modes
2. A usage example showing how callers use it
3. What the implementation hides behind the seam
4. Dependency strategy and adapters (see `DEEPENING.md`)
5. Trade-offs: where leverage is high, where it is thin

### 3. Present and compare

Present the designs one at a time so the user can absorb each, then compare them in prose.
Contrast by **depth** (leverage at the interface), **locality** (where change concentrates), and
**seam placement**.

Then give your own recommendation: which design is strongest and why. If elements from different
designs combine well, propose a hybrid. Be opinionated — the user wants a strong read, not a menu.

Adapted from `codebase-design/DESIGN-IT-TWICE.md` in mattpocock/skills (3cca18b).
