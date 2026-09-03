# Value A/B — screening pass, 2026-09-02

Question: does a skill produce something the model does not produce without it? Same fixture, same
task, twice — once with the plugin intact and the skill invoked, once against a plugin copy with
that skill's directory removed. Scored by a criterion computed from the fixture.

claude 2.1.259 · `--plugin-dir` · plan mode · n=1 per arm · $1.83 for the four units.

| Unit | Treatment | Control | Delta |
|---|---|---|---|
| `prose-tells` | 11/12 planted tells | 11/12 | none |
| `color-expert` | 4/4 hexes pass AA, worst 5.22:1 | 4/4, worst 5.68:1 | none (control marginally better) |
| `baseline-status` | 5/5 support facts | 5/5 | none |
| `apple-hig` | 3/4 HIG constraints | 3/4 | none |

Cost per pair: treatment $0.34–$0.57, control $0.28–$0.66. The control was cheaper in three of four.

## The selection bias, named rather than discovered later

These four were chosen because their criterion is objective — WCAG arithmetic, published Baseline
status, HIG numbers, a countable list of planted tells. That property is not independent of the
result: **a criterion is objective when the answer is well documented, and a well-documented answer
is exactly the kind a frontier model already carries.** Picking measurable units selected for the
cases where a skill has the least room to contribute.

So this pass says something narrow and real: on well-documented ground, these four skills add
nothing measurable. It does NOT say skills add nothing. The units where a skill plausibly earns its
place — visual system choice, editorial layout, deck structure, brand derivation — are the ones
whose criterion is judgment, and they are unmeasured here for the same reason they might matter.

## Scorer defect, recorded

`prose-tells` counts a detection by the presence of the tell's surface string in the output. One
planted tell is the em dash, and almost any output contains one, so both arms score a free point.
Net of it the pass is 10/11 against 10/11 — still a tie, but the marker should be replaced with a
quoted-line check before this unit is re-run.

## Not measured

n=1 per arm. Plan mode, one model. A tie at n=1 is weak evidence of no difference; it is strong
enough to stop spending on a unit and move to one with more room, which is what it was for.
