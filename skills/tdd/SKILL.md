---
name: tdd
description: Use when building a behavior or fixing a bug test-first — TDD, red-green, write the failing test first — one pre-agreed seam, one failing test, just enough code to pass, repeated in vertical slices; mocks only at system boundaries. NOT choosing what to cover for a change (that is `test-coverage-plan`), NOT diagnosing an observed failure (that is `systematic-debugging`).
kind: skill
od:
  category: engineering
  triggers:
    - tdd
    - "test-driven"
    - "test first"
    - "red-green"
    - "failing test first"
---

# TDD — red → green at a pre-agreed seam

A reference for the loop, not a driver. Whatever runs the build — you, a pipeline, a dispatched
engineer — applies these rules on every cycle.

## Seams: where a test goes

A **seam** is the public boundary you test at: the interface where you observe behavior without
reaching inside. Tests live at seams, never against internals.

**Test only at pre-agreed seams.** Before writing any test, write down the seams under test and
confirm them with the user. No test is written at an unconfirmed seam. Effort is finite; agreeing
the seams up front spends it on the critical paths instead of every edge case. Ask: "What is the
public interface, and which seams should we test?" — with the trade-off of each candidate (what
the narrower seam misses, what the wider one costs).

When the shape of that interface is itself the question — how deep the module is, where the seam
belongs, what it exposes — invoke `codebase-design` for the vocabulary. It is a reference to
consult, not a session to run.

## The loop

- **Red before green.** Write the failing test first, watch it fail for the right reason, then
  only enough code to pass it. No anticipating the test after next.
- **One slice at a time.** One seam, one test, one minimal implementation per cycle. The first
  cycle is a **tracer bullet**: one narrow path proven end to end through every layer; each later
  test responds to what the last cycle taught you.
- **Refactoring is not part of the loop.** It belongs to the review stage — a Standards finding
  from `reviewer`, applied as its own task — not the red → green cycle.

## Anti-patterns

- **Implementation-coupled**: mocks internal collaborators, tests private methods, or verifies
  through a side channel (querying the database instead of using the interface). The tell: the
  test breaks when you refactor but behavior has not changed.
- **Tautological**: the assertion recomputes the expected value the way the code does, so it
  passes by construction. The tell: no independent source of truth. Expected values come from a
  known-good literal, a worked example, the spec.
- **Horizontal slicing**: all the tests first, then all the implementation. Bulk tests verify
  imagined behavior and commit you to a test structure before you understand the implementation.
  The tell: a batch of tests landed before any code. Work in vertical slices instead.

Mocks belong at system boundaries only — external APIs, time, randomness, sometimes the filesystem
or the database — never around your own modules. Test shape: `references/tests.md`; mocking:
`references/mocking.md`.

## It's working if

- The seams are named and confirmed before any test file exists.
- One test appears, goes red, gets just enough code to pass, and only then does the next appear —
  never a batch of tests followed by a batch of code.
- Test names read as capabilities ("user can checkout with valid cart"), not internals
  ("checkout calls paymentService.process").
- Expected values are literals traceable to the spec, not recomputed the way the code computes them.
- Renaming an internal function breaks nothing in the suite.
- Mocks appear only at external boundaries (the payment API, the clock), never around your own modules.
- No refactor step appears inside the loop; the refactor arrives as a review finding.

Adapted from `tdd` in mattpocock/skills (3cca18b).
