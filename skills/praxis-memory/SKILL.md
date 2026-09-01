---
name: praxis-memory
description: Use when reading or writing the project's accumulated Praxis memory (.praxis/memory/) — lessons and learned skills that persist across sessions. NOT promoting a candidate skill (that is `learn-graduate`), NOT curating what went stale (that is `learn-prune`).
kind: skill
od:
  category: memory
  triggers:
    - ".praxis/memory"
    - "what has this project learned"
    - "remember this convention"
    - "accumulated project knowledge"
---

# Praxis Memory — the per-project learning store

Layer 1 of Praxis learning: the agent LEARNS per project, accumulating knowledge in Markdown the
team shares via git. Memory lives in the USER's project at `.praxis/memory/` — never in the plugin.
It is created at runtime by `/praxis:learn`; do not scaffold it ahead of need.

## This is the TEAM store. It is not the only one.

Claude Code ships its own per-user memory (`~/.claude/projects/<project>/memory/`, an index loaded
at session start plus detail files on demand). That store is **personal**: it lives on one machine,
under one account, and no teammate ever sees it. Praxis does not compete with it and must never
duplicate it.

| | Where | What belongs there |
|---|---|---|
| **Personal** | the host's native memory | how *this person* works, corrections to their own style, machine-local setup |
| **Team** | `.praxis/memory/`, committed | conventions, decisions, and procedures a NEW TEAMMATE would need |

**The admission rule, one line: if a new teammate would not need it, it does not go in the team
store.** A lesson about the project belongs here. A lesson about you belongs in the personal one.
Writing personal preferences into a committed store is how a shared memory becomes noise everyone
else has to read and nobody else can act on.

On hosts with no native memory (Codex, Cursor, Gemini CLI, Copilot) the personal layer simply does
not exist. That is not a gap to fill here — the team store stays the team store.

## The five artifacts

```
.praxis/memory/
  .gitignore            # written on first capture: excludes sessions.jsonl
  index.md              # tiny, always-loaded retrieval index — the read path
  lessons.md            # detail for facts / corrections / conventions
  gaps.md               # append-only: sightings awaiting a second occurrence, and known holes
  sessions.jsonl        # raw capture, written by the SubagentStop hook — LOCAL, never committed
  skills/<name>/SKILL.md # a learned procedure (candidate → active)
```

Everything here is committed **except `sessions.jsonl`**: it is per-machine capture, it carries no
distilled value, and committing it would put one developer's dispatch log into everyone's diff. The
hook writes the `.gitignore` that excludes it, so nobody has to remember.

## Capture and consolidation are separate

```
CAPTURE       hooks/subagent-stop, automatic, deterministic
              -> appends one pending row per dispatch to sessions.jsonl
CONSOLIDATION /praxis:learn, invoked
              -> reads pending rows, decides what is durable, writes index.md,
                 marks the rows consumed
```

Capture is cheap — no LLM, no network, one append — so it runs on every dispatch without asking.
Consolidation costs a model call and a judgement, so it is deliberate. Running consolidation on
every subagent would charge for sessions that taught nothing; running capture only on request
loses the evidence before anyone asks for it.

**Capture is inert until this project has a `.praxis/` directory.** Praxis does not scaffold one
into every repo it touches. That is a real cost, not a footnote: until `/praxis:learn` runs once,
nothing is being recorded. Say so when reporting — an inert mechanism must never read as an armed
one that found nothing.

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
- Source: <what taught it — the session, the correction, the commit or PR>
- Recurrence: seen <N>x
- conf: <0.x>
- last_verified: <YYYY-MM-DD>
- last_used: <YYYY-MM-DD>
```

`Source` is not bookkeeping. Consolidation is lossy: it turns "the user corrected me twice in one
review" into a flat imperative, and once the origin is gone the claim reads with an authority its
evidence never earned. A lesson whose source cannot be named is a lesson nobody can re-check when
the codebase moves under it.

`last_used` is refreshed **when the lesson is actually applied**, not when it is written — that is
the difference between a lesson that is earning its line and one that has merely been sitting in
the index. It is the only signal `learn-prune` has for decay, so a lesson that is never refreshed
is exactly what pruning is looking for.

### `gaps.md` — what the memory does not know

Append-only. Each line is a hole someone noticed, and it is what gives `/praxis:learn` a work
queue instead of waiting for a lesson to arrive by accident.

```
- <YYYY-MM-DD> <the gap or the single sighting> · seen in <where it came up>
```

Four things belong here:

- **a first sighting** — something that looks reusable but has been seen exactly once;
- a question this memory could not answer when it was asked;
- a convention referenced repeatedly with no entry behind it;
- a lesson that was contradicted and left unresolved.

**The first sighting is what makes recurrence work across sessions.** A single occurrence is not a
lesson, so it cannot go in `lessons.md` — but if it is dropped entirely, the same insight seen once
next week is a first sighting again, forever. Recorded here, the second occurrence in ANY later
session finds it, and the pair promotes to a lesson. `gaps.md` is the recurrence buffer; without
it, the `≥2×` rule silently means "twice in one conversation".

Promotion is a move, not a copy: when a gap becomes a lesson, its line leaves this file.

A gap is not a lesson. It is the absence of one, recorded so it can be closed on purpose. Remove a
line only when the gap is closed or promoted — never to tidy the file.

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
