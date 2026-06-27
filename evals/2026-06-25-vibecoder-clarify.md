# Eval — Vibe-coder clarify gate (does it ask before guessing?)

> Date: 2026-06-25 · Under test: `using-praxis` (classify) + `brainstorming` (clarify gate) · Method: an agent given only the Praxis content receives a vague non-technical request; measured on whether it clarifies vs builds.

## What was tested
The UX moat: most agent tools assume you're a senior; Praxis must give a **vibe-coder** rails — ask the right question instead of guessing and building the wrong thing. Incoming message (deliberately vague): *"hazme algo para trackear mis plantas."* Pass = asks ONE clarifying question and STOPS before building. Building anything = the failure case.

## Measured behavior
| Check | Result |
|---|---|
| Classified the task | **Substantial** (build, scope open) ✅ |
| Asked vs guessed | **Asked, then stopped** — did not build ✅ |
| One question at a time (not a 5-question dump) | **One** question: "¿En qué querés usarlo — web / celular / lo más rápido?" ✅ |
| Right fork (changes the outcome) | Yes — surface (web vs mobile) defines stack, layout, data loading ✅ |
| Multiple-choice (easy for a non-technical user) | Yes (A/B/C) ✅ |
| Files written | **0** — building would have been the failure case ✅ |

First response (verbatim): *"Antes de construir nada necesito despejar UNA cosa que cambia TODO… te pregunto una cosa, paro, y seguimos."*

## Verdict
**PASS.** The clarify gate fires on a vague vibe-coder prompt, asks the single highest-leverage question first, and refuses to guess-and-build. This is the UX differentiation most agent tools don't provide.

## Honest caveat
Like the other content-following evals, this measures the discipline **when the content is in context**, not autonomous activation in a live primed session. The SessionStart hook is what should make this fire unbidden — confirm in a live primed re-run.
