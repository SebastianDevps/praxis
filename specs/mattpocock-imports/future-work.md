# Matt Pocock Imports — Future Work

## Enhancements (each its own spec, per ADR-005)
- DFU-1: Git guard on `Bash` in `pre-tool-use` — `push --force`, `reset --hard`, `clean -f`,
  `checkout .`, `branch -D` — classified by executor (read tools inert), mutation-tested. Matt's
  script is a substring matcher; do not port it.
- DFU-2: `validate-resources.mjs` requires `## It's working if` once wave 1 has written them.
- DFU-3: Invocation policy: `disable-model-invocation: true` for skills that change state or run
  long (`learn-*`, `quality-bar`, `loop`); measured with `routing-audit` and a live cell before
  adoption. Not pruning: the skills stay; only who may reach them changes.
- DFU-4: Evalite's scorer contract (`[0,1]` + threshold → exit code) for `evals/value`.
- DFU-5: `design.md` User Stories with a `tested:` flag per story (ai-hero-cli `prd.json`).

## Not doing
- `implement` (unprompted commit), tracker-publishing skills, sandcastle engine, slopwatch,
  `ask-matt`, course tooling.
- DFU-6: `design.md` Technical Design gains a `Seams:` line the approval covers, so `tdd`'s seam
  confirmation rides the existing `ask` instead of a prose stop (ADR-006). Re-measure the `tdd` unit.
- DFU-7: `evals/value/run.mjs` gets a CLI (`--unit`, `--n`, `--rescore`) and per-replicate run
  names; today the n=3 driver lives in the git-ignored `runs/` and the ledger's verify line does
  not run as written.
- DFU-8: `## It's working if` for the skills fused in wave 1 (`brainstorming`, `writing-plans`)
  and, gradually, the rest — before DFU-2's validator can be turned on.
