---
name: brainstorming
description: Use when a build, feature, or design request is ambiguous or underspecified, BEFORE writing any code — clarify scope and key decisions with the user one question at a time until the approach is clear. NOT choosing between approaches you already have (that is `strategy-compare`), NOT writing the task list (that is `writing-plans`).
kind: skill
od:
  triggers: ["clarify scope", "before building", "ambiguous request"]
---

# Brainstorming — clarify before building

When a substantial request leaves material decisions open, do NOT guess and start. A vague prompt
is where unexamined assumptions cost the most — you will build what *you* imagined, not what the
user wants. Clarify first.

## The design tree and its frontier

Map the request as a **design tree**: every decision branches into the decisions that hang off it.
The **frontier** is every decision whose prerequisites are already settled — the questions you can
ask *now* without guessing at answers you have not heard yet. A question whose answer depends on
one still open belongs to a later round, not this one.

Work the tree in **rounds**. Each answer reshapes the tree: a settled decision pushes the frontier
outward and unblocks the questions that hung off it. Recompute the frontier, then ask the next
round.

Done when the frontier is empty: every branch visited, nothing left silently assumed. On a clear
task the frontier is empty at round 1 — exit without a question, say what you assumed, and proceed.
On an open tree, do not act until the user confirms the shared understanding.

## Facts are your job; decisions are the user's

Finding facts is your job, never the user's. When a frontier question needs a fact from the
environment — what the repo already has, which framework is installed, what an API returns —
dispatch a subagent (`scout`, `docs-seeker`) to find it; never ask the user for anything you could
look up. A running exploration is an unsettled prerequisite: only the questions downstream of it
wait for the report; ask the rest of the frontier now. Decisions are the user's: put each to them
and wait.

## The rule: one question at a time

Ask ONE question from the frontier, **stop**, wait for the answer, then ask the next. Never dump a
list. Every question carries your recommended answer — the user corrects a recommendation faster
than they compose an answer from nothing. Prefer multiple-choice when you can.

```diff
- ❌ "I have a few questions: framework? data? dark mode? auth? layout?"
+ ✅ "First — single self-contained HTML file, or a React component set?
+     I'd go single-file: no build step, and the source fits one screen."  [wait]
```

## Clarify only what changes the outcome

A node belongs in the tree only if its answer changes what you build. Prune the rest.

- **Scope** — what is in, what is out; how far does "done" reach?
- **Real forks** — framework, data source, real vs placeholder content, interactivity.
- **Constraints** — audience, density/tone, must-haves.

A faithful screenshot replica answers most of its own questions (fidelity = match the source) — ask
only what the image cannot tell you (framework, data, single-file vs components).

## Then align in one line, and proceed

State the approach back briefly and proceed on confirmation; adjust on correction:

> "Dashboard, single-file HTML, mock data, dark theme matching the source. Sound right?"

## Anti-pattern

"This is too simple to need clarifying." That thought is the trap. Ten seconds of a question beats
rebuilding the wrong thing. Compute the frontier before deciding it is empty; when it is, say what
you assumed so the user can correct it.

> Adapted from [mattpocock/skills](https://github.com/mattpocock/skills) grilling — the design
> tree, rounds, the frontier, facts via subagents, and the recommended answer per question.
