# Live smoke test

```bash
node evals/smoke/live-hooks.mjs [--keep]
```

Every other test executes a hook directly and inspects its stdout. That proves the script is
correct. It cannot prove Claude Code **invokes** it, nor that the emitted JSON **reaches the
model** — and those are different questions, as Cursor demonstrated: its `subagentStart` hook
accepts perfectly-formed output and shows it only to the human.

One real headless session answers both. It costs roughly $0.06 on Haiku.

## What it isolates

- a fresh temp workspace, `git init`, thrown away unless `--keep`
- `--setting-sources project,local` — the user's globally-installed plugins cannot contaminate
  the run, which is the contamination class that invalidated ponytail's first agentic benchmark
- `--plugin-dir <repo>` — the working tree, not whatever version sits in the plugin cache

## What it checks

| | where |
|---|---|
| all three hooks fired | trace file (`PRAXIS_HOOK_TRACE`) |
| a subagent was actually dispatched | parent transcript |
| router + per-turn contract reached the model | parent transcript |
| contract, crafts and skill pointers reached the specialist | **subagent transcript** |
| no Run Card and no skill bodies in the dispatch | subagent transcript |

The dispatch-side checks read the subagent's own `agent-*.jsonl`, never the parent's. SessionStart
context is parent-only, so finding it in the parent would prove nothing about what a specialist
receives.

**Transcripts are identified by `session_id`, never by size or by mentioning the workspace path.**
The first version took the largest file mentioning the workspace and picked up the developer's own
session — which quoted the injected text in tool output and would have reported a false pass.

## Not in CI

It spends money and needs an authenticated CLI. Run it before a release, and after any change to
`hooks/`.

## What it does not measure

Delivery, not effect. That the specialist *received* its crafts says nothing about whether they
changed what it produced. That is the paid arms comparison, and it comes after this — measuring the
effect of context that never arrived would measure nothing.
