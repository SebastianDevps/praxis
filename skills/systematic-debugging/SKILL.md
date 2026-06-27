---
name: systematic-debugging
description: Use when investigating a bug, test failure, or not-working behavior, before proposing fixes — reproduce, isolate, trace to root cause, fix once at the root, verify, and add a regression test.
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

## Anti-patterns

- Patching the one caller you observed without checking whether other callers share the same bug.
- "Should be fixed" — re-run the repro. Observation beats confidence.

> Curated from vibecode vc-debug.
