# Activation report

**Zero API cost.** Reads the transcripts the host already wrote and answers the question that has
to come before any paid experiment: *which Praxis resources actually fire in real sessions?*

```bash
node evals/activation/report.mjs                    # ~/.claude/projects
node evals/activation/report.mjs --transcripts DIR  # elsewhere
node evals/activation/report.mjs --json             # machine-readable
```

## Method

A session counts as **primed** when the SessionStart hook's framing sentence appears in it.
Activation rates are computed over primed sessions only — a skill cannot fire from a framework
that was never loaded, and counting unprimed sessions would deflate every rate.

Both the plugin-namespaced form (`praxis:scout`) and the bare form (`scout`) are counted: a host
may register a plugin resource either way, and matching only one undercounts silently.

**Priming coverage** is reported separately: of the sessions that actually invoked a Praxis
resource, how many had the framework primed. A gap there means the hook is not firing on some
session type, and every rate below it is measured against an incomplete denominator. That number
is what exposed the `resume` matcher gap.

## What it cannot tell you

- **Not fired ≠ not valuable.** The counts reflect the work that was actually done. A design skill
  reads as silent in months of backend work; that is a statement about the sample, not the skill.
  Read it alongside what you were building.
- **It measures reach, not effect.** A skill that fires often is not thereby good. Whether firing
  *changed the output* is the paid experiment this report comes before.
- **Silence has two causes** and this cannot separate them: the task never arose, or the task arose
  and the description failed to match. The second is a routing bug; the first is nothing. Read a
  silent skill against sessions where its trigger plausibly applied.

---

# Description audit

```bash
node evals/activation/descriptions.mjs            # trigger matches vs. actual invocations
node evals/activation/descriptions.mjs --show web-testing   # inspect the matched prompts
```

Separates the two causes of silence the activation report cannot tell apart: the task never arose,
or the task arose and the description failed to route. Only the second is a bug.

**Heuristic, not proof.** Keyword overlap is not intent. Matching is Unicode word-boundary (an
earlier substring version reported `ad-creative` at 986 hits — "ad" inside "ciudad") and compaction
summaries are excluded (they quote the whole session, so every trigger matched at once). A
single-word trigger still over-matches; those rows are marked low precision. Always inspect with
`--show` before believing a count.
