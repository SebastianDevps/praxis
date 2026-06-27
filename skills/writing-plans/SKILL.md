---
name: writing-plans
description: Use when about to build something substantial, multi-file, or multi-step, BEFORE writing code — break the work into a written checklist of bite-sized, independently-testable tasks saved to a ledger.
kind: skill
od:
  triggers: ["write a plan", "plan this", "break this down", "before building"]
---

# Writing Plans — bite-sized, testable, written down

A four-bullet plan like "build the backend, add the UI, wire it up, test" is not a plan — it is a
restatement of the task. It hides every real decision and gives the build nothing to check off. The
delta a plan must add: each task is ONE reviewable unit with a concrete done-criterion.

## Each task names three things

1. **Files to touch** — the concrete paths, not "the relevant files".
2. **The check** — the test or acceptance gate that proves THIS task is done. Observable, runnable.
3. **Order / dependencies** — what must land first. A task that can't be verified alone is too big;
   split it until it can.

```diff
- ❌ - [ ] Build the auth backend
+ ✅ - [ ] Add POST /login route — files: src/routes/auth.ts, test: `npm test auth` green — after: user model
```

## The plan IS a ledger file

Write it as a `- [ ]` checklist to a durable file (e.g. `PROGRESS.md` or `plan.md`), NOT into chat.
The build reads it and checks items off (`- [x]`) as it goes. This is what survives compaction and
what `subagent-driven-development` and `/praxis:loop` consume — the filesystem is the memory, not
the context window.

## Rules

- No vague verbs. "Handle", "support", "improve" hide scope — name the concrete change.
- One done-criterion per task. If you can't write the check, you don't understand the task yet.
- Smallest viable slices. Many small testable tasks beat few large ones — small tasks fail loud and
  early; large ones fail late and ambiguous.
- Sequence by dependency, then let disjoint tasks run in parallel.

## Anti-pattern

Starting to code with the plan "in your head". The plan that isn't written can't be reviewed,
can't be checked off, and is gone after the next compaction. Write it first.
