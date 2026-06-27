---
name: brainstorming
description: Use when a build, feature, or design request is ambiguous or underspecified, BEFORE writing any code — clarify scope and key decisions with the user one question at a time until the approach is clear.
kind: skill
od:
  triggers: ["clarify scope", "before building", "ambiguous request"]
---

# Brainstorming — clarify before building

When a substantial request leaves material decisions open, do NOT guess and start. A vague prompt
is where unexamined assumptions cost the most — you will build what *you* imagined, not what the
user wants. Clarify first.

## The rule: one question at a time

Ask ONE question, **stop**, wait for the answer, then ask the next. Never dump a list. Prefer
multiple-choice when you can — it is faster to answer than open-ended.

```diff
- ❌ "I have a few questions: framework? data? dark mode? auth? layout?"
+ ✅ "First — single self-contained HTML file, or a React component set?"  [wait]
```

## Clarify only what changes the outcome

Ask about decisions with real forks; skip anything whose answer would not change what you build.

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
rebuilding the wrong thing. When the request is genuinely unambiguous or a faithful replica,
proceed — but say what you assumed so the user can correct it.
