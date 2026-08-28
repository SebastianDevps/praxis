# Eval — do Praxis skills actually activate?

> Date: 2026-08-28 · Under test: the activation model itself ("descriptions are the router")
> · Method: two zero-API instruments over 961 real transcripts (52 Praxis-primed, 3124 human prompts)
> · Reproduce: `node evals/activation/report.mjs` and `node evals/activation/descriptions.mjs`

## Why this before a paid experiment

An experiment that measures whether a skill improves output is wasted on a skill that never runs.
Reach comes first, and reach is readable from transcripts the host already wrote — no API spend.

## Result 1 — the agent layer works, the skill layer barely fires

| | fired | of | invocations |
|---|--:|--:|--:|
| agents | 6 | 8 | 154 |
| skills | 2 | 34 | 3 |

`engineer` 91 · `backend` 24 · `researcher` 18 · `reviewer` 18 · `security` 2 · `design` 1.
Skills: `deep-research` 2 · `design-review` 1.

The difference between the two layers is not quality — it is **how each is reached**. Agents are
dispatched explicitly by the orchestrator. Skills are matched by `description`. The explicit
mechanism fires 50× more often than the inferred one.

## Result 2 — 71% of sessions ran unprimed

Of 42 sessions that invoked a Praxis resource, **30 had never been primed**. The Claude
`SessionStart` matcher was `startup|clear|compact`; the Codex sibling in the same repo was
`startup|resume|clear|compact`. Every resumed session ran without Praxis.

Fixed, and gated: a test now asserts every host config primes on the same four session types.
The rates in Result 1 were therefore measured against an incomplete denominator — real activation
is somewhat better than 3/34, but not by an order of magnitude.

## Result 3 — the silence is a routing gap, not absence of need

Cross-referencing each skill's curated `od.triggers` against real human prompts separates "the
task never arose" from "the task arose and the description did not match".

| skill | prompts matching its triggers | times it fired |
|---|--:|--:|
| web-testing | 39 | 0 |
| systematic-debugging | 27 | 0 |
| spec-lifecycle | 25 | 0 |
| security | 21 | 0 |
| data-visualization | 12 | 0 |
| frontend-design | 6 | 0 |

Inspected samples (`--show <skill>`) confirm these are real contexts, not keyword noise:

- **web-testing** — *"como yo hago para hacer test unitario netamente a una funcion"*, *"no me
  interesan esos test... hagamos verificaciones corridas en test por code"*
- **security** — *"la auth puede ir en el tenant? o el user?"*, *"organicemos lo de la auth de la api"*
- **systematic-debugging** — an `npm error code ebadengine` failure, a PR merge investigation, a
  validation objection with failure examples

Fourteen skills show zero trigger matches and genuinely were never needed in this corpus (months
of backend and plugin work): the four design systems, `apple-hig`, `deck-builder`, `brand`.
Those are sample bias, not dead weight.

## The cause the samples make visible

**Every skill description is in English. The user works in Spanish.** A router doing
description-matching sees *"como hago para hacer test unitario a una funcion"* and must connect it
to *"Playwright E2E, component, or visual-regression coverage"*. It does not.

This is the load-bearing assumption of the whole framework — the README states it plainly:
*"Descriptions are the router."* The audit says that router has a language gap, and the layer that
does not depend on it (explicit agent dispatch) is the layer that works.

## What this does NOT say

- **Not fired ≠ not valuable.** These counts reflect the work actually done in this corpus.
- **Reach, not effect.** Nothing here says a skill improves output when it does fire. That is the
  paid experiment, and it should now target the skills that actually activate.
- **The trigger cross-reference is a heuristic, not a proof.** Keyword overlap is not intent. The
  first version matched substrings and reported `ad-creative` at 986 hits — "ad" inside "ciudad",
  "recon" inside "reconcile", "auth" inside "author", "spec" inside "especificación". Fixed with
  Unicode word boundaries and by excluding compaction summaries, which quote the whole session and
  matched every trigger at once. Every count remains inspectable with `--show` before it is believed.
- **Recall is understated** for exactly the reason the finding names: English triggers against
  Spanish prompts under-match, so "never needed here" is a floor, not a verdict.

## Next

1. Re-run both instruments in two weeks, with `resume` fixed and the injection layer live. The
   pre-fix numbers above are the baseline; that A/B costs nothing.
2. Decide on the language gap — it is a design decision about who the framework is for, not a bug
   with an obvious fix.
3. Only then run the paid experiment, on skills known to activate.
