---
name: praxis-memory
description: Use when reading or writing the project's accumulated Praxis memory (.praxis/memory/) — lessons and learned skills that persist across sessions.
kind: skill
od:
  category: memory
  triggers:
    - "praxis memory"
    - ".praxis/memory"
    - "read memory"
    - "project lessons"
    - "learned skill"
---

# Praxis Memory — the per-project learning store

Layer 1 of Praxis learning: the agent LEARNS per project, accumulating knowledge in Markdown the
team shares via git. Memory lives in the USER's project at `.praxis/memory/` — never in the plugin.
It is created at runtime by `/praxis:learn`; do not scaffold it ahead of need.

## The three artifacts

```
.praxis/memory/
  index.md              # tiny, always-loaded retrieval index — the read path
  lessons.md            # detail for facts / corrections / conventions
  skills/<name>/SKILL.md # a learned procedure (candidate → active)
```

### `index.md` — the only thing read every session

```
# Praxis Memory — <project>
## Lessons
- <one-line lesson> · conf <0.x> · verified <YYYY-MM-DD>
## Learned skills (active)
- `<skill-name>` — <one-line trigger> · verified <YYYY-MM-DD>
## Candidates (in probation — not yet trusted)
- `<skill-name>` — <one-line>
```

Keep it small. It is loaded in full at session start, so every line costs context — one line per
lesson, one line per skill. Detail lives in `lessons.md` and the skill files, not here.

### `lessons.md` — detail behind each index line

One entry per lesson:

```
### <one-line lesson>
- What: <the fact / correction / convention>
- Why: <why it holds — the non-obvious reason>
- Recurrence: seen <N>x
- conf: <0.x>
- last_verified: <YYYY-MM-DD>
```

### `skills/<name>/SKILL.md` — a learned procedure

Standard skill frontmatter PLUS a `metadata` block:

```yaml
---
name: <skill-name>
description: Use when <trigger> — <what it does>.
kind: skill
metadata:
  status: candidate   # candidate until pressure-tested, then active
  confidence: 0.x
  last_verified: YYYY-MM-DD
  source: "<what taught it — a corrected mistake, a repeated pattern>"
---
```

## The three non-negotiables

These are rules, not preferences. Memory that breaks any one is worse than no memory.

1. **Retrieval guarantee.** `index.md` IS the read path — nothing else is loaded by default. A lesson
   or skill that is not in the index does not exist to the agent. **Never write a lesson or learned
   skill without adding its line to `index.md` in the same pass.** Write to detail and index together
   or not at all.

2. **Recurrence trigger.** Capture only what was seen **≥2×** — a mistake corrected twice, a pattern
   that recurred, a convention re-stated. **Never capture a one-off.** A single event is noise; memory
   stores signal. If you cannot point to the second occurrence, do not write it down.

3. **Probation.** A learned skill is born `status: candidate` and stays there until pressure-tested by
   `learn-graduate`. A candidate is a hypothesis, not a trusted procedure — it sits under `## Candidates`
   in the index and is NOT applied as settled practice. Only graduation flips it to `active`.

## Confidence

`conf` / `confidence` rises with recurrence and successful re-verification; it falls when a lesson is
contradicted or goes stale. It is a signal for `learn-prune`, not a vanity number — set it from the
evidence (how many times seen, how recently confirmed), never by feel.
