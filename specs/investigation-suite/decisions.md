---
title: Investigation Suite
---

# Investigation Suite — Decisions

## ADR-001 — The suite emits verdicts, so it cannot live inside `researcher`

**Status:** accepted

**Context.** `agents/researcher.md:3` declares "it reports facts, never verdicts", and its Hard Stops
(`:52-56`) forbid stating a claim without a citation and forbid conflating "not found" with "does not
exist". Three of the four new skills end in a judgement: adopt/avoid, risk/tradeoff, build/buy.

**Options.** (a) Widen `researcher` to allow verdicts. (b) A new agent that carries the verdict
contract. (c) No agent — the orchestrator runs the skills directly.

**Decision.** (b). A new `analyst` agent.

**Consequences.** `researcher` keeps the one property that makes it trustworthy: you can hand its
output to anyone because it contains no opinion. A reviewer of an `analyst` dossier knows to read it
as an argument. Cost: one more agent in a corpus of 11, and a boundary pair that must be written
carefully in both directions.

**Confirmation.** `agents/researcher.md` is unmodified in this change's diff except where a `NOT`
clause names `analyst`. A routing case asserts that a facts-only prompt routes to `researcher`.

---

## ADR-002 — Four skills, split by object, not by depth

**Status:** accepted

**Context.** The suite could be one skill with modes, two skills (reconstruct / judge), or four.
Praxis's routing is description-matching over a 51-resource corpus with 3.7 points of headroom on
its EN rank-1 floor, so skill count is not free.

**Options considered and rejected:**

- **One skill, four modes.** Its description would have to match "understand this repo", "should we
  use this package", "will this architecture hold" and "build or buy" — i.e. everything. A
  description that matches everything ranks first for nothing specific, which is the exact failure
  `docs/skill-doctrine.md` §1 exists to prevent.
- **Merge `dependency-adoption` into `buy-vs-build`.** Superficially attractive: both answer "source
  it or make it". Rejected because the evidence bases do not overlap at all. `dependency-adoption`
  computes from three public APIs and its decisive signals are maintenance and bus factor;
  `buy-vs-build` reasons about a capability's strategic position and its decisive signal is
  commodity-vs-differentiator. A merged skill would carry two disjoint method bodies and a verdict
  vocabulary that contradicts itself.
- **Merge `architecture-evaluation` into `project-teardown`.** Rejected for now because
  documentation and evaluation are different jobs — the external survey's central finding is that
  the ecosystem has the first and lacks the second, and merging them would reproduce the confusion.
  **Kept as the named fallback** if the routing audit shows dilution below the floor (design §4).

**Decision.** Four skills, one object each: a codebase you do not own · a package · an architecture
under quality requirements · a capability you must source.

**Consequences.** Four routing cases to write, four descriptions competing for headroom, and a
measurable risk to a metric that is currently passing by 3.7 points. Accepted because the split is
the one the router can actually learn: the objects are distinguishable in a sentence, the depths are
not.

**Confirmation.** `node scripts/routing-audit.mjs` after the change: EN rank-1 ≥ 65 and every new
skill rank-1 on its own `should_trigger` prompts. If either fails, the fallback merge is executed
and re-measured before the change ships.

---

## ADR-003 — Import the method as cited text, never as a summary

**Status:** accepted

**Context.** The same choice was made and measured in the previous change (`specs/mattpocock-imports/`,
ADR-001): the method goes in as text with its source, not paraphrased. The temptation here is larger
because the sources are longer — ATAM's technical report, a 2022 e-book, a 431-line dependency skill.

**Decision.** Every checklist, section list and criteria set is reproduced with its source URL, and
the source's own wording is kept where it is load-bearing. Three cases where the exact wording is the
value: ATAM's sensitivity/tradeoff definitions, `managing-dependencies`' "gameable" classification of
stars and downloads, and Thoughtworks' granularity warning.

**Consequences.** Longer skill bodies. Accepted: the alternative is a paraphrase that the model
cannot distinguish from its own priors, which is the failure this whole plugin exists to prevent.

**Confirmation.** Every imported list in a new SKILL.md carries a URL on the same page as the list.

---

## ADR-004 — Report contradictions between primary sources; do not resolve them

**Status:** accepted

**Context.** The survey found four places where authoritative sources disagree:

1. **ATAM phases** — SEI's own reports say two (TR-004 §9); the four-phase table is from the 2002
   book, verifiable only via a university-hosted reproduction.
2. **Bus factor** — three incompatible definitions (Avelino file-authorship, CHAOSS contributions,
   ecosyste.ms commit distribution) that return different numbers for the same repo.
3. **OpenSSF Scorecard** — `docs/checks.md` documents 20 checks; `scorecard.dev` says 18. The
   `Webhooks` check is `Critical` in the docs and `Experimental` in the README.
4. **MADR 4.0.0** — the rendered site and the template file disagree about which sections are optional.

**Decision.** Import the unambiguous part, state the disagreement, and name which side was
implemented. Concretely: ATAM's nine steps and five output types are imported, its phase model is
not; the bus factor is computed with CHAOSS's formula and cites Avelino for the definition; the
Scorecard list is taken from `docs/checks.md` with `Webhooks` marked experimental; MADR follows the
template file.

**Consequences.** The skills are longer and less tidy than a confident summary would be. That is the
point — a skill that silently picks one side of a documented contradiction teaches the model a fact
that a reader can disprove in one click.

**Confirmation.** Each of the four contradictions appears in the relevant SKILL.md as a stated
disagreement, not as a single asserted value.

---

## ADR-005 — Popularity is excluded as a selection signal, in the suite and in building it

**Status:** accepted

**Context.** Two independent findings pointed the same way. The survey's own conclusion: *"In this
ecosystem, stars are anti-correlated with depth"* — the two most rigorous artifacts had 16 and 22
stars, the 25k-star collection's flagship research agents were machine-generated, and the 12k-star
collection has no licence at all. And the primary dependency source classifies GitHub stars and
download counts as **"gameable"** in its own less-reliable-signals list.

**Decision.** Two consequences, one inward and one outward. Inward: what got imported into this
suite was chosen by reading the artifact, and the star counts are recorded only as evidence *against*
using them. Outward: `dependency-adoption` never states a star count as a reason, and when a user
offers one it says why it is weak and substitutes `dependent_repos_count` and maintainer count.

**Consequences.** Slower selection — reading a 431-line skill instead of trusting a star count. It is
also the only method that would have found it.

**Confirmation.** `rg -i 'stars' skills/dependency-adoption/SKILL.md` returns only the gameable-signal
warning, never a threshold.

---

## ADR-006 — A dossier with no `SKIP` on a partial target is a failure

**Status:** accepted

**Context.** The predictable failure of a research suite is a complete-looking report over an
incomplete investigation. Praxis already has the vocabulary: four states, PASS · FAIL · SKIP · GAP,
with the rule that "silence must never read as clean" (`docs/skill-doctrine.md` §3). An assessment
where every section is filled is either a complete target or a fabricating agent, and the reader
cannot tell which.

**Decision.** Every dossier section is one of: filled with cited evidence, or `SKIP` with the reason
it could not run, or `GAP` with what it had nothing to check against. The live-cell acceptance is
written to require at least one `SKIP` on a partial target, so the absence of `SKIP` is itself a
detectable defect.

**Consequences.** Dossiers look less impressive. A reviewer can tell in one pass what was actually
established.

**Confirmation.** The live cell in design §Acceptance asserts (d): at least one `SKIP` where the
target gave nothing to assess.

---

## ADR-007 — The boundary gate rewards deleting boundaries, so it is fixed here

**Status:** accepted

**Context.** `design.md` §Acceptance asserted that removing a new `NOT` clause would degrade the
boundary or routing audit. T07 ran the mutation in both directions and measured the opposite:

```
mutant (scout NOT clause removed):  boundary 7 · routing PASS · EN rank-1 70.2% · 257 pass / 6 fail
restored:                           boundary 7 · routing PASS · EN rank-1 69.6% · 257 pass / 6 fail
```

Nothing caught the deletion, and the gated metric **preferred** it by 0.6 points. Cause, checked
rather than inferred: `stripBoundaries` (`scripts/routing-audit.mjs:146`) removes clauses from the
*collision* text while the *ranking* text keeps them, so a `NOT` clause can only cost recall and
never earn it back; and nothing asserts a description **has** a clause — `boundary-audit.mjs` fires
only when a clause is contradicted by the body, never when one is absent.

A second, separate defect surfaced in the same pass: `boundary-audit.mjs:47` matches `NOT`
case-insensitively (`gi`), so the lowercase "not" in `project-teardown`'s prose ("a codebase you do
not own") was read as a boundary clause and swallowed the whole positive claim into the exclusion.
That is what produced two of the nine clashes. The labels it accused were innocent.

**Options.** (a) Record both as GAPs, correct the acceptance line, file the fix as future work.
(b) Fix both inside this change.

**Decision.** (b), and the acceptance line in `design.md` §Acceptance is corrected to the measured
truth rather than left as the prediction it contradicts.

**Why this is not scope creep.** The change's own acceptance depends on a gate that does not work.
Shipping four skills whose boundaries are held only by convention — while the instrument that is
supposed to hold them scores their removal as an improvement — would install exactly the failure
Praxis exists to prevent, and would do it in the file that teaches the rule. The fixes are surgical:
one regex flag, and one assertion that every `kind: skill` description carries a
`NOT … (that is \`sibling\`)` clause.

**Consequences.** The corpus-wide assertion will fail on any existing skill lacking a clause. That
is a finding, not a defect in the assertion — it is enumerated and either fixed or recorded, never
suppressed by weakening the assertion. The `gi` → case-sensitive change may alter the baseline
clash count in either direction; the new number is recorded as the baseline whatever it is.

**Confirmation.** After the fix, re-run the same mutation: removing a `NOT` clause must fail a named
gate, and restoring it must pass. Both outputs pasted. If it still does not fail, the fix did not
work and no amount of green elsewhere substitutes for it.

---

## ADR-008 — The eval went against the four skills, and what that does and does not license

**Status:** accepted — option (c), approved by the owner

**Context.** T09 ran the live cell and its negative control: `gajus/zod-compiler` @ `32d255b`, a repo
created after the model's cutoff and absent from this corpus by two orthogonal methods. Five cells,
n=1 per arm, $43.61.

```
treatment r2   $20.07   cites 21/21 · signal+call PASS · verdict PASS · 3 SKIPs   PASS (second attempt)
skills-off r2   $6.14   cites 27/30 · signal+call PASS · verdict PASS · 2 SKIPs   PASS (one run)
bare r1         $1.25   no artifact · 0 citations · 0 API calls · 0 SKIPs         FAIL
```

`skills-off` keeps `pipelines/investigation.md`, `agents/analyst.md` and `commands/investigate.md`
and **deletes the four skills**. It met all four acceptance criteria in one uninterrupted run for
$6.14. The treatment met them only on a second attempt after its budget ceiling went $8 → $20, which
it also hit. Both reached the same verdict by the same route — `zod-compiler` requires `zod ^4.5.0`,
and zod 4.5 ships `z.compile()` natively, so the package you must install makes the dependency
largely unnecessary — and **neither found it through a skill**. Both found it in `target/package.json`.

**What the measurement establishes.** The value that is demonstrated lives in the pipeline, the
agent and the command: against `bare`, they are the difference between a cited artifact and nothing.
The four skills did not pay for themselves on this target, and they cost 3.3× more.

**What it does not establish, stated so it is not overread.** Two of the four skills **never ran**.
`architecture-evaluation` and `buy-vs-build` both SKIPped, correctly, because the target has no
stated quality requirement — the precondition their own bodies demand. So this eval tested
`project-teardown` and `dependency-adoption`, on one target, at n=1, with one model, with Bash denied
throughout. Deleting four skills on that evidence would be a bigger inferential leap than the one
this ADR exists to prevent.

**Options.** (a) Ship as built and publish the negative. (b) Ship only the pipeline, agent and
command; drop the four skills. (c) Ship as built, publish the negative, and gate the skills' future
on an eval that actually exercises all four.

**Recommendation.** (c). The measured claim in the README becomes "the pipeline earns its keep
against no-suite; the four skills are unproven", which is what was observed, and the follow-up names
its own conditions: a target with a stated quality requirement and a real sourcing decision, so
`architecture-evaluation` and `buy-vs-build` are exercised rather than skipped; n≥3; Bash enabled.

**One thing the eval proved that was not its purpose.** ADR-006 earned its keep. `skills-off` r1 wrote
an 18.9 KB dossier with **zero** `SKIP`s over an investigation the budget had cut off mid-flight, and
passed every other criterion. Criterion (d) is the only check that caught it. A complete-looking
report over an incomplete investigation is exactly the failure ADR-006 was written against, and it
occurred on the first opportunity.

**Also recorded:** eight scorer defects were found and fixed, two by mutation before spending and six
by reading the raw streams against the numbers. And one defect in the proof itself — fixing a
false negative made the verdict mutation stop failing, so the mutation was rewritten. A check that
cannot fail is a GAP.

**Decision, recorded on approval.** Option (c). Ship as built, publish the negative in full, and
gate the four skills' future on an eval that exercises all four: a target with a stated quality
requirement and a real sourcing decision, n≥3, Bash enabled. The README's measured claim is "the
pipeline earns its keep against no suite; the four skills are unproven", which is what was observed.

---

## ADR-009 — The network calls stay, and the claim they falsified is rewritten rather than dropped

**Status:** accepted

**Context.** `.claude-plugin/marketplace.json` claimed "no network calls". This change made that
false: `dependency-adoption` reads `packages.ecosyste.ms`, `api.scorecard.dev` and `api.deps.dev`.
T10 caught it while updating the surface and correctly refused to treat it as a copy edit.

**Options.** (a) Keep the calls and rewrite the claim to say exactly what they are. (b) Make
`dependency-adoption` offline by default with the calls opt-in.

**Decision.** (a). The line now reads "no daemon, no database, no telemetry; the only network calls
are the public APIs that assessment reads".

**Why.** The calls are the skill. Its whole distinction from every other adoption checklist surveyed
is that it **computes** a verdict from live third-party data instead of asserting one — and the
measurement that made the point (`zod`: 122,785 dependent repos, one maintainer) is only available
over the wire. Offline-by-default would keep the promise intact and hollow out the feature, leaving
a skill that opines about maintenance it cannot see.

**What is given up, stated plainly.** "No daemon, no database, no port" is still true; "no network
calls" is not, and the README and marketplace copy must never quietly re-acquire it. The calls are
GETs to public endpoints about a package the user named, carry no identifiers, and happen only when
an assessment runs.

**Confirmation.** `rg -n 'no network' README.md AGENTS.md .claude-plugin/*.json` returns nothing that
claims the plugin makes none.
