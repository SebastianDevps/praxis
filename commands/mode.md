---
description: Set how much process Praxis runs — fast or full. No argument reports the active level.
---

# /praxis:mode — the intensity dial

Praxis decides "trivial or substantial" on every turn. That call belongs to the person driving:
a typo fix should not cost a Run Card, and an architectural change should not be judged trivial
because the diff happens to be small. This sets it explicitly.

```
/praxis:mode fast     edit + verify. No Run Card, a five-line ledger.
/praxis:mode full     the cycle: spec → build → review → approve → PR. Default.
```

`deep` is gone (ADR-004, `specs/factory-cycle/decisions.md`): review and ship are always on in
`full`, and the diff decides which lenses run. `/praxis:mode deep` maps to `full` with a notice,
for one release.

`/praxis fast` works too. The level persists across turns until changed — it is held in a flag
file, not in the conversation, so a long session cannot drift back to a level you did not pick.
Every injected turn states the active level in its first line.

## What the dial does NOT change

Only the ceremony. The crafts, the ladder, and the safety carve-outs (validation at trust
boundaries, error handling that prevents data loss, security, accessibility) are identical at
every level. `fast` means less process, never less care — if work classified as fast turns out
to be substantial, the contract instructs the agent to say so and ask before continuing.

## When to reach for each

| Level | Use it for | Stops for your approval |
|---|---|---|
| `fast` | a rename, a copy fix, a config tweak, a one-file bug with an obvious cause | no |
| `full` | ordinary feature work, anything multi-file, anything with a design surface, anything you will not revisit soon | once, on the spec; again only if two review rounds could not converge |

A question is answered at every level without entering any of this — the dial scales ceremony, and
a question has none to scale.

The approval column is the handshake: at `full`, the spec-writer's `spec.md` sets the Run Card to
`Needs your decision` and the first source edit asks; after that the cycle runs without asking.
**A file count is not a reason to stop and never was** — being unsure what to build is.

Setting `fast` on a feature is the same mistake as setting `full` on a typo: the dial only helps if
it tracks the actual stakes.
