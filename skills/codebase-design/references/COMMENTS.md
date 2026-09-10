# Comments

Ousterhout's comment chapters, in the skill that already carries his vocabulary — **module**,
**interface**, **implementation**, **seam** (`../SKILL.md`). Free primary source: [CS 190 — Comments](https://web.stanford.edu/~ouster/cgi-bin/cs190-winter18/lecture.php?topic=comments).

## The rule, and both ways to break it

> "Comments should describe things that are not obvious from the code."

Both failures are named, and both are failures — this is no argument for fewer comments:
*"Mistake #1: comments duplicate code"* · *"Mistake #2: non-obvious info is not described"*.

## Different level of detail

The operative test: a comment sits at a *different* level than the line below it, or it is Mistake #1.

- *"Lower level comments provide precision (especially for variables, arguments, return values)"* —
  the exact definition, the units, the boundary conditions (is null legal, are the range endpoints
  included), who owns freeing the memory, the invariants that hold.
- *"Higher-level comments capture intuition"* — the abstraction the code implements, the rationale
  for a design choice, how a caller picks configuration parameters.

## Interface vs implementation

> "Interface: what someone needs to know in order to use this class or method"
> "Implementation: how the method or class works internally"
> "Important to separate these: do not describe the implementation in the interface documentation!"

**Interface** as `../SKILL.md` defines it: invariants, ordering, error modes, configuration. Detail
leaking in from behind the seam widens it, and callers start depending on that.

> "document each thing exactly once"

One fact, one home. A fact documented twice is a fact that will disagree with itself.

## Comments first, as a design tool

Ousterhout writes the interface comment *before* the implementation, which makes it the first draft
of the interface: one too tangled to describe is caught while the **seam** can still move.

## Three red flags — widely reproduced, UNVERIFIED against the book

The appendix is not published free and the book is paywalled. These names, definitions and chapter
numbers come from two independent third-party reproductions that agree — secondary, never primary.

- **Comment Repeats Code** (13.2) — "If the information in a comment is already obvious from the
  code next to the comment, then the comment isn't helpful."
- **Implementation Documentation Contaminates Interface** (13.5) — interface documentation
  describing implementation details a caller does not need in order to use the thing.
- **Hard to Describe** (15.3) — "If you find it difficult to write such a comment, that's an
  indicator that there might be a problem with the design of the thing you are describing."

The third is why this file sits in `codebase-design` and not only in the `comment-discipline` craft:
a comment you cannot write is a **design** finding — the module is shallow, the seam is misplaced,
or the interface carries facts that belong behind it. Fix the design; the comment writes itself.

## One genuine disagreement, reported not resolved

Ousterhout's higher-level comments say what the code accomplishes and *why*. The
[Linux kernel style guide](https://www.kernel.org/doc/html/latest/process/coding-style.html), ch. 8,
says: *"you want your comments to tell WHAT your code does, not HOW"*. They agree on the target — do
not narrate mechanics — but use what/how/why inconsistently: the kernel's WHAT is Ousterhout's why.
