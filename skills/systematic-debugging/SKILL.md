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

1. **Build the loop before any theory.** One command that goes red on *this* bug. No red-capable command, no hypothesis. If you catch yourself reading code to build a theory before that command exists, stop — that is the exact failure this skill prevents. Ways to build it, in order; take the first that reaches the bug:
   failing test at the seam that reaches it → HTTP/curl script against a running dev server → CLI invocation with a fixture input, diffed against a known-good snapshot → headless browser script asserting on DOM, console, or network → replay of a captured trace (request, payload, event log) through the code path in isolation → throwaway harness (a minimal subset of the system, one call) → property/fuzz loop for "sometimes wrong output" → bisection harness that `git bisect run` can drive → differential run, old version against new → a human-in-the-loop script, last: you run it, the person follows its prompts, their answers come back as parseable output.
   The loop is built when it is **red-capable** (asserts the user's exact symptom, not "did not crash"), **deterministic**, **fast** (seconds), **agent-runnable** unattended, and **already run once** — show the invocation and its output, secrets replaced with `<REDACTED>`. If you genuinely cannot build one, say so, list what you tried, and ask for environment access, a redacted captured artifact, or permission to add temporary instrumentation. Do not hypothesise without it.
2. **Reproduce and minimise.** Run it red. Confirm it is the failure the user described, not a nearby one. Cut inputs, callers, config, and steps one at a time, re-running after each cut, until every remaining element is load-bearing. The minimal repro is the regression test in waiting.
3. **Hypothesise — 3–5, ranked, falsifiable — before probing anything.** One hypothesis anchors on the first plausible idea. Each states its prediction: "if X is the cause, changing Y makes the bug disappear". No prediction → a vibe; sharpen it or drop it. Show the ranked list to the user before testing any of them — they often re-rank it instantly; proceed on your ranking if they are away.
4. **Probe one variable at a time.** Each probe maps to one prediction. A debugger or REPL beats logs; targeted logs sit at the boundaries that separate hypotheses; never "log everything and grep". Tag every debug log `[DEBUG-xxxx]` so cleanup is one grep — untagged logs survive. A performance regression is measured, never logged: baseline first (timing harness, profiler, query plan), then bisect.
5. **Trace to root cause.** Grep EVERY caller of the suspect function. The symptom names one path; the cause is almost always shared state or a shared function that all paths route through.
6. **Regression test before the fix — at a correct seam only.** A correct seam exercises the real bug pattern as it occurs at the call site. A shallow one (a single-caller unit test when the bug needs several callers, a unit that cannot replicate the chain) gives false confidence — do not write it. If no correct seam exists, that itself is the finding: record it in the ledger; the architecture is preventing the bug from being locked down. With a seam: turn the minimised repro into a test there, watch it fail.
7. **Fix once, at the root.** Patch the shared callsite, not each individual symptom path. One change covers all callers. Watch the regression test pass.
8. **Verify and clean up.** Re-run the original, un-minimised loop from step 1; if it still fails, you fixed a symptom, not the cause. `rg 'DEBUG-'` returns nothing; throwaway harnesses are deleted. The commit message names the hypothesis that turned out to be right, so the next debugger learns.

## When it will not reproduce

"No red-capable command" halts step 1; it does not end the method. For a flaky bug the goal is not a clean repro but a higher reproduction rate — loop the trigger 100×, parallelise, add stress — until the rate is high enough to debug against. Pick the branch that fits and go make a repro.

- **Timing** — timestamp the suspect region, insert artificial delays to *widen* the race window rather than close it, and run the path under load.
- **Environment** — diff runtime versions and data shape (empty store vs. populated). Reproduce in CI, where the environment is clean and nobody's local state is in it.
- **State** — hunt state leaked between tests or requests: globals, singletons, shared caches. Run the scenario in isolation *and* again after other operations; a pass in only one of the two names the cause.
- **Truly random** — defensive logging at the suspect site plus an alert on that specific error signature. Document the conditions observed and revisit with real data, rather than guessing at a fix you cannot verify.

## Anti-patterns

- A theory before a red command. Reading code to guess is the default a bug report invites; the loop is what replaces it.
- Patching the one caller you observed without checking whether other callers share the same bug.
- "Should be fixed" — re-run the repro. Observation beats confidence.

> Curated from vibecode vc-debug. Adapted from
> [mattpocock/skills](https://github.com/mattpocock/skills) diagnosing-bugs — the red-command
> gate, the loop ladder, ranked hypotheses, tagged probes, and the correct-seam rule.

## It's working if

- A command and its red output appear before the first sentence that names a cause.
- Three to five hypotheses are listed and ranked before any probe runs, each with the
  observation that would falsify it. Measured 2026-09-09: on a one-line bug the model skipped
  this 6/6 times; the gate above still held 3/3.
- `rg 'DEBUG-'` returns nothing when the fix is declared done.
- A regression test exists at a seam, or the report says why no correct seam exists.
- The commit names the hypothesis that turned out right.
