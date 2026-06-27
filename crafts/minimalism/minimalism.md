---
name: minimalism
description: Laziest solution that works. YAGNI. No speculative abstractions.
kind: craft
---

## Intensity

`lite | full | ultra` — default `full`.

- `lite`: apply the ladder; skip deletion pass.
- `full`: ladder + delete anything obsolete.
- `ultra`: full + enforce one-liner budget; challenge every symbol's existence.

## The Ladder

Stop at the first rung that holds:

1. Does this need to exist? (YAGNI — if no caller uses it yet, skip it)
2. Already in the codebase? Reuse it.
3. Stdlib does it? Use stdlib.
4. Native platform feature? Use it.
5. Already-installed dependency covers it? Use it.
6. Can it be one line? Write one line.
7. Only then: minimum code that works.

## Rules

- Bug fix = root cause, not symptom. Fix once where all callers route through; don't patch each call site.
- No unrequested abstractions: no interface with one implementation, no factory for one product, no base class with one subclass.
- Deletion over addition. When two approaches exist, pick the one that removes more lines.
- Shortest working diff — but only after you understand the problem. Speed without comprehension produces the wrong solution faster.
- No "future-proofing" unless the future is concrete and imminent.
