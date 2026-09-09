---
name: investigation
description: Assessment lifecycle for a target you do not own — scoped sweep, cited dossier, one verdict that names what would overturn it.
kind: pipeline
phases:
  - scope
  - sweep
  - assess
  - synthesize
  - verdict
od:
  triggers:
    - "take apart this repo"
    - "should we adopt this"
    - "will this architecture hold"
    - "build or buy"
    - "assess this project"
---

## Phases

- **scope** — `analyst`; classifies the query as *depth-first*, *breadth-first* or *straightforward*, declares the tool-call budget with its floor and its ceiling, and names the target precisely enough that the sweep knows what it is pointed at. The classifier and the budget are the agent's — `agents/analyst.md` owns both, and nothing here restates them. If the target is ambiguous — a bare package name that exists in three registries, "the competition" with no product named — one question, then STOP.
- **sweep** — `analyst`; the applicable producing skills in ONE parallel wave: `project-teardown` and `dependency-adoption`. They are disjoint by construction — the teardown reads code, adoption calls public APIs — so the wave is safe and nothing in it is sequenced.
- **assess** — `analyst`; the verdict-bearing skills, `architecture-evaluation` and `buy-vs-build`, over what the sweep produced. Neither re-reads the target: the reconstruction and the computed signals are their input.
- **synthesize** — `analyst`; writes the dossier from the sections the previous two phases returned. Synthesis only — no citation is attached here.
- **verdict** — `analyst`; the separate citation pass, then the single recommendation. Two steps, in that order, and the first may not alter the second's input.

The methods are the skills'; nothing here restates them.

## How `sweep` decides what runs

**Not every target earns all four skills.** The phase picks by what the target *is*, before anything is dispatched:

| The target | `project-teardown` | `dependency-adoption` |
|---|---|---|
| a repo you can read | runs | runs when it resolves to a published package |
| a package with no readable source | `SKIP` — no source to read | runs |
| a product with no repo and no package | degrades to the observable surface (docs, public API, pricing) | `SKIP` — nothing to resolve in a registry |
| a capability or a technology, not an artifact | `SKIP` — no codebase under the lens | `SKIP` — no package under the lens |

`assess` picks the same way. `architecture-evaluation` runs when there is an architecture description of sufficient detail *and* a stated quality requirement to judge it against — the skill stops on one question when the second is missing, and that stop is the pipeline's stop. `buy-vs-build` runs when the ask is how a capability comes to exist; when the ask is only "what is this", it does not run.

**A skill that does not run is reported `SKIP` with the reason, in the dossier, by name.** It is never omitted, and a phase that dispatched two skills instead of four says so where the reader sees it. The reason is a fact about the target — "no public repository", "not published to any registry", "no stated SLO" — and it is as much a finding as anything the skills returned.

## Output contract — the dossier

Per `specs/investigation-suite/decisions.md` ADR-006. Every section of the dossier is exactly one of three things:

- **filled** — with a `path:line` for a claim about code, or a URL for a claim about the world;
- **`SKIP`** — with the reason it could not run;
- **`GAP`** — with what it had nothing to check against.

**A dossier with no `SKIP` on a partial target is a defect, not a success.** Every section filled means either a complete target or a fabricating agent, and the reader cannot tell which. The four states are `docs/task-model.md`'s, and `GAP` never sets the failure flag: it reports.

The `verdict` phase closes with one recommendation, in the shape `skills/buy-vs-build/SKILL.md` established and every skill in the suite matches:

```
VERDICT        <the recommendation, in the vocabulary of the skill that produced it>
OVERTURNED BY  <the specific finding that would flip this verdict>
```

`OVERTURNED BY` is a finding, never a confidence level. A verdict nobody can disprove is a preference.

**The citation pass may not alter the synthesis text.** It attaches sources to prose that is already written; it does not rewrite prose to fit the sources it found. That ordering is the whole point of splitting the two phases — reverse it and the citations select the argument.

## Artifacts

Every phase writes into `specs/<change>/`. The mode decides which files are mandatory (`spec-lifecycle`); the task line format is `docs/task-model.md`.

| Phase | Writes |
|---|---|
| scope | `design.md` — Problem Statement (the target and the question asked of it), Scope In/Out, the query classification and the declared budget; `implementation.md` — one task per applicable skill, each with its `verify:` line |
| sweep | `implementation.md` — task `state:`, Completed with `[cmd] → [output]`; `design.md` — the reconstruction and the computed signals, each claim carrying `path:line` or the API call that produced it |
| assess | `design.md` — Technical Design: risks, non-risks, sensitivity and tradeoff points, the sourcing criteria; `decisions.md` — one ADR per verdict, naming the alternative it rejected |
| synthesize | `design.md` — the dossier assembled, every section filled · `SKIP` · `GAP` |
| verdict | `decisions.md` — the single recommendation with its `OVERTURNED BY` line; `implementation.md` — verify evidence: PASS · FAIL · SKIP · GAP |

At `fast` the ceremony drops and the citations do not: `implementation.md` alone, carrying the verdict and its evidence.

The orchestrator renders a **Run Card** per phase (spec · phase · approach · research · verify; their meaning is in `docs/task-model.md`) — every run is inspectable.
