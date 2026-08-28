# Eval — does the injection layer change what gets produced?

> 2026-08-28 · 24 real headless Claude Code sessions (3 tasks × 4 arms × n=2), Haiku 4.5, $2.92
> · Reproduce: `node evals/arms/run.mjs --selftest` then `--run --n 2`

## Headline

**Inconclusive on the thing it was built to test, and that is the finding.**

`SubagentStart` — where crafts and skill pointers are injected — fired in **0 of 6** `praxis`
cells. Two of the three tasks never dispatch by nature, and the one designed to require a dispatch
did not produce one either. So the larger half of the layer was never exercised. Reporting "no
effect" from this run would be reporting the absence of a test as the absence of an effect.

The task set is the defect, not the layer. A control (`router-only`) that differs from `praxis`
only in mechanisms that never fire cannot separate from it.

## Results

| task / metric | baseline | praxis | prompt | router-only |
|---|--:|--:|--:|--:|
| hero / font is not an AI default | 2/2 | 2/2 | 2/2 | 2/2 |
| hero / made a deliberate type choice | 0/2 | **0/2** | 0/2 | 0/2 |
| hero / input is labelled | 1/2 | 2/2 | 2/2 | 2/2 |
| delegate / dispatched a specialist | 0/2 | **0/2** | 1/2 | 0/2 |
| delegate / both deliverables exist (when it built) | 2/2 | 1/1 | 1/1 | 1/1 |
| delegate / clarified before building | 0/2 | 1/2 | 1/2 | 1/2 |
| vague / asked instead of building | 2/2 | 2/2 | 2/2 | 2/2 |

## What is actually supported

**1. The per-turn contract did not change delegation behaviour.** This one *was* tested: `praxis`
carries the contract, `router-only` does not, and the contract explicitly says to fan out disjoint
domains. Both dispatched 0/2 on a task built from two unrelated files. The instruction arrived —
verified in the transcripts — and did not move the behaviour at this task size on Haiku.

**2. Having Praxis at all correlates with asking before guessing.** Baseline built without asking
2/2; every Praxis arm asked once in two. But the twenty-word `prompt` arm matched it exactly, so
nothing here says a framework was required.

**3. Nobody made a deliberate type choice — 0/8, including `praxis`.** This survives the small
sample because it has a verified mechanism rather than only a count: `anti-slop` is injected on
`SubagentStart` alone, no `hero` cell dispatched, and the Inter ban appears in none of the
transcripts. **The taste layer does not reach the main thread.** Inline work depends entirely on
`frontend-design` activating by description-matching, which
[the activation audit](2026-08-28-activation-audit.md) already measured as the weak link.

**4. The one arm that dispatched was `prompt`, not `praxis`.** Once in two, using worktrees. A
framework whose orchestration craft is built on fan-out was out-delegated by twenty words of plain
instruction. n=2, so this is a direction to chase, not a rate.

## Two scoring defects found and fixed offline

Preserved workspaces meant both corrections cost nothing to re-apply — the API was paid once.

- **Asking was scored as failing to deliver.** Three cells produced no files because they asked
  *"which framework — Flask, FastAPI or Django?"* first. That is the behaviour Praxis exists to
  produce, and the only arm scoring full marks on delivery was the one that never asked. Delivery
  is now `n/a` for a cell that asked, and asking is its own metric.
- **Worktree copies were counted as produced files.** A subagent dispatched with worktree isolation
  leaves a full copy under `.claude/worktrees/`, so a delegating arm looked more productive than it
  was. Excluded from every file-based metric.

A third stands unfixed: seven of eight `hero` cells produced no `<img>` at all (CSS backgrounds
instead), so the alt-text metric is nearly inert and needs a task prompt that forces one.

## Next

The experiment must exercise the mechanism under test. That means tasks that reliably dispatch —
the live smoke test already shows an explicit instruction produces one every time. Until then,
`praxis` versus `router-only` compares two configurations that are identical in practice.

Raising `n` first would buy precision on a comparison that is not measuring the right thing.

---

# Second run — the mechanism fired, and no effect was measurable

> 32 cells (4 tasks × 4 arms × n=2), Haiku 4.5, $5.04. Tasks redesigned to force the dispatch.

## The test was valid this time

`dispatch-ui` produced a real dispatch in both Praxis arms (2/2 each), and the crafts verifiably
reached the specialist: two subagent transcripts contain `Craft — anti-slop`, and `router-only`'s —
which dispatched the same `praxis:design` agent — contain none. That is clean isolation: same task,
same dispatch, same agent, differing only in whether `SubagentStart` injected the craft.

Baseline and the twenty-word prompt did not dispatch at all (0/2 each) despite being told to.

## Result

| dispatch-ui metric | baseline | praxis | prompt | router-only |
|---|--:|--:|--:|--:|
| actually dispatched *(validity)* | 0/2 | **2/2** | 0/2 | **2/2** |
| made a deliberate type choice | 0/2 | 0/2 | 0/2 | 0/2 |
| no placeholder or startup-slop naming | 2/2 | 2/2 | 2/2 | 2/2 |
| no AI cliché copy | 2/2 | 2/2 | 2/2 | 2/2 |
| no round fake pricing | n/a | 1/1 | n/a | 1/1 |
| off-black and off-white, not pure | 0/2 | 0/2 | 2/2 | 2/2 |
| toggle is a real labelled control | 2/2 | 2/2 | 2/2 | 2/2 |

**The crafts arrived and no output difference was measurable.** On seven metrics the arms are
identical; on the eighth (`off-black`) `praxis` sits on the wrong side of `router-only`, which at
n=2 is noise, not evidence of harm.

The one real separation is upstream of the layer under test: **both Praxis arms honoured the
delegation instruction where baseline and the prompt ignored it.** `router-only` has only the
SessionStart router, so that is the router working — not the per-turn or per-subagent injection.

## A false positive, caught

The first scoring pass showed `praxis` 2/2 on deliberate type choice against 0/2 everywhere else —
a clean win on exactly the mechanism under test. It was the scorer. `praxis` had written
`font-family: var(--font-sans)`, and the metric read `var(--font-sans)` as the primary family
because it matched neither the AI-default list nor the system-stack list. The variable resolved to
`-apple-system, BlinkMacSystemFont, 'Segoe UI', 'Helvetica Neue', 'Ubuntu', 'Roboto', sans-serif` —
the same stack every other arm emitted.

`primaryFont` now resolves custom properties. The lesson is not the regex: it is that the defect
surfaced on the first result favouring the thing being tested, which is precisely where a scorer
deserves the least trust.

## What this does and does not license

- **Does not say the layer is useless.** It says no effect was measurable on these metrics, at n=2,
  on Haiku. n=2 carries almost no statistical power; this is a direction, not a rate.
- **Does say the delivery is not the bottleneck.** The context arrives — the live smoke test proves
  the chain, and the subagent transcripts prove the craft text is there. Whatever is limiting the
  effect sits after arrival, not before it.
- **Does suggest the metrics are too narrow, or the model too small.** Seven of eight rules produced
  identical output across arms including the no-plugin baseline, which means those rules describe
  behaviour Haiku already exhibits. A craft that forbids what the model was not going to do anyway
  cannot show an effect.

## Honest accounting

Two matrices, $7.96, and no validated effect claim. What was bought instead: a harness whose
instruments refuse to run until they catch their own bad references, three scoring defects found
and corrected offline for free, and a verified answer to a question that had been open all day —
the context does arrive at the specialist.

Raising n is the obvious next step and it is not obviously worth it. A cheaper one first: pick
rules where the arms plausibly diverge, on a model large enough to follow them.
