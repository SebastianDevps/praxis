---
description: Set how much process Praxis runs — fast, full, or deep. No argument reports the active level.
---

# /praxis:mode — the intensity dial

Praxis decides "trivial or substantial" on every turn. That call belongs to the person driving:
a typo fix should not cost a Run Card, and an architectural change should not be judged trivial
because the diff happens to be small. This sets it explicitly.

```
/praxis:mode fast     edit + verify. No Run Card, no ledger.
/praxis:mode full     the visible loop. Default.
/praxis:mode deep     + mandatory research, explicit approach comparison, adversarial review.
```

`/praxis fast` works too. The level persists across turns until changed — it is held in a flag
file, not in the conversation, so a long session cannot drift back to a level you did not pick.
Every injected turn states the active level in its first line.

## What the dial does NOT change

Only the ceremony. The crafts, the ladder, and the safety carve-outs (validation at trust
boundaries, error handling that prevents data loss, security, accessibility) are identical at
every level. `fast` means less process, never less care — if work classified as fast turns out
to be substantial, the contract instructs the agent to say so and ask before continuing.

## When to reach for each

| Level | Use it for |
|---|---|
| `fast` | a rename, a copy fix, a config tweak, a one-file bug with an obvious cause |
| `full` | ordinary feature work, anything multi-file, anything with a design surface |
| `deep` | an architectural decision, a security-sensitive path, work you will not revisit soon |

Setting `deep` on everything is the same mistake as setting `fast` on everything: the dial only
helps if it tracks the actual stakes.
