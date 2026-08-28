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
