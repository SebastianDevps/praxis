---
name: systematic-debugging
description: Use when investigating a bug, a test failure, flaky or intermittent behavior, or a regression that keeps coming back, before proposing fixes — reproduce, isolate, trace to root cause, fix once at the root, verify, and add a regression test. NOT deciding what to test for new work (that is `test-coverage-plan`) — this starts from an observed failure.
kind: skill
od:
  category: engineering
  triggers:
    - debug
    - bug
    - "not working"
    - "root cause"
    - "investigate failure"
---

## Method

1. **Reproduce reliably.** No repro → no fix. Write the exact input/state that triggers the symptom before touching any code.
2. **Isolate.** Bisect (binary-search commits, or comment out code) until you have the minimal repro. Fewer moving parts → root cause is unambiguous.
3. **Trace to root cause.** Grep EVERY caller of the suspect function. The symptom names one path; the cause is almost always shared state or a shared function that all paths route through.
4. **Fix once, at the root.** Patch the shared callsite, not each individual symptom path. One change covers all callers.
5. **Verify.** Re-run the original repro. If it still fails, you fixed a symptom, not the cause.
6. **Add a regression test.** The repro becomes the test. If the bug was reachable before, it must be tested after.

## When it will not reproduce

"No repro → no fix" halts step 1; it does not end the method. Pick the branch that fits and go make a repro.

- **Timing** — timestamp the suspect region, insert artificial delays to *widen* the race window rather than close it, and run the path under load.
- **Environment** — diff runtime versions and data shape (empty store vs. populated). Reproduce in CI, where the environment is clean and nobody's local state is in it.
- **State** — hunt state leaked between tests or requests: globals, singletons, shared caches. Run the scenario in isolation *and* again after other operations; a pass in only one of the two names the cause.
- **Truly random** — defensive logging at the suspect site plus an alert on that specific error signature. Document the conditions observed and revisit with real data, rather than guessing at a fix you cannot verify.

## Anti-patterns

- Patching the one caller you observed without checking whether other callers share the same bug.
- "Should be fixed" — re-run the repro. Observation beats confidence.

> Curated from vibecode vc-debug.
