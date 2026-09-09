# Investigation Suite — Design

Two parallel investigations ran before this document: an inventory of Praxis's own research surface,
and a survey of published prior art plus the professional methods being imitated. Both are cited
inline. Nothing below is written from training memory.

## Overview

A suite that lets Praxis investigate something it does not own — a repository, a project, a
dependency, a competitor's product, a technology choice — and produce a **cited technical
assessment with a verdict**, at the altitude a staff engineer works at: stack, reconstructed
architecture, alternatives landscape, project health, and a build-or-source recommendation.

Four skills, one agent, one pipeline, one command. The unit of output is a dossier whose every
claim carries either a `path:line` (for code) or a URL (for the world), and whose every verdict
names the evidence that would overturn it.

## Problem Statement

**Praxis can research. It cannot assess.** The inventory found 40 skills and 11 agents; the
research-adjacent ones divide cleanly and leave a hole:

| resource | object | output |
|---|---|---|
| `scout` (`skills/scout/SKILL.md:20-21`) | *this* repo, "and only this repo" | findings note, "never a decision" |
| `deep-research` (`skills/deep-research/SKILL.md:15-33`) | a question | cited answer, Findings/Gaps/Disagreements |
| `docs-seeker` (`skills/docs-seeker/SKILL.md:17-26`) | one library's docs | current API facts |
| `strategy-compare` (`skills/strategy-compare/SKILL.md:16`) | 2–4 options **that already exist** | a pick |
| `decision-challenge` (`skills/decision-challenge/SKILL.md:28`) | a decision already made | proceed / hold / stop |
| `researcher` (`agents/researcher.md:3`) | codebase or docs | facts, "never verdicts" |

Nothing in the corpus takes a **foreign artifact** as its object and returns a **structured
judgement**. Verified three ways: reading all 40 skill descriptions, all 11 agent descriptions, and
the full bodies of the seven research/decision-adjacent skills. There is also no
`/praxis:research`-shaped command (`fd . commands -t f` → the 9 existing files).

The same hole exists outside Praxis. The external survey's closing finding, after examining
Anthropic's first-party prompts and every large public agent collection:

> across every collection surveyed, no published skill or agent does architecture *evaluation* —
> as opposed to architecture *documentation*. C4 documentation exists, repo reconnaissance exists,
> and dependency evaluation exists. Tradeoff analysis and buy-vs-build do not.

Anthropic's own `Explore` subagent prompt is 45 lines of file-search specialist with a hard
read-only block and no output schema (`Piebald-AI/claude-code-system-prompts`,
`system-prompts/agent-prompt-explore.md`, `ccVersion 2.1.235`). It locates code. Everything above
that is unbuilt at the first-party level.

**And popularity is a false guide here.** The two most operationally rigorous artifacts found have
16 and 22 stars; the 25k-star collection's three flagship research agents are 286 lines each of
machine-generated keyword bullets with degenerate grammar. Selection by stars would have imported
the worst of it.

## User Stories

- As an engineer evaluating a library, I want computed maintenance and bus-factor numbers with the
  API call that produced them, not an assertion that the project "looks healthy".
- As an engineer handed an unfamiliar repo, I want its stack, entry points and request lifecycle
  reconstructed with `path:line` citations I can click, so I can check the reconstruction.
- As a tech lead facing a build-or-buy call, I want the capability classified as commodity or
  differentiator first, because that classification decides the answer more than any feature table.
- As an architect, I want the tradeoff points named — the properties that pull two quality
  attributes in opposite directions — because those are the decisions that are expensive to reverse.
- As the plugin maintainer, I want routing measured before and after, because four new skills
  landing in a 51-resource corpus is the most likely way this change makes Praxis worse.

## Scope

### In
- Four skills: `project-teardown`, `dependency-adoption`, `architecture-evaluation`, `buy-vs-build`.
- One agent: `analyst` — dispatches sections, synthesizes, runs a separate citation pass.
- One pipeline `pipelines/investigation.md` and one command `/praxis:investigate`.
- Routing cases for each new skill; routing and boundary audits re-run and reported.
- The cross-cutting investigation discipline (query classification, declared budget, source-quality
  catalogue, citation invariance) lives in the pipeline and the agent, not duplicated per skill.

### Out
- Any change to `scout`, `deep-research`, `docs-seeker`, `strategy-compare` or `decision-challenge`
  beyond adding a `NOT` clause where a new sibling needs one. Their bodies stay as they are.
- Wiring `evidence-discipline` into `agents/researcher.md`. The inventory found `researcher` is the
  only agent requiring `minimalism` alone (`agents/researcher.md:11-12`) while all eight other domain
  agents require both. That is a real gap and a separate change → `future-work.md`.
- Executing any of the third-party APIs at build time. The skills carry the calls; a live cell runs
  them once to prove the projections are right.
- Diagram rendering, HTML reports, `.tour` files. Markdown with Mermaid where a diagram earns its
  place; nothing that needs a renderer.

## Technical Design

### 1. The four skills, and why four

The decomposition follows the **object under investigation**, because that is what the router can
actually discriminate on. Each skill owns one object and one verdict vocabulary.

| skill | object | verdict vocabulary | method source |
|---|---|---|---|
| `project-teardown` | a codebase you do not own | none — it reconstructs, it does not judge | ECC `codebase-onboarding` sweeps + C4 levels + arc42 sections |
| `dependency-adoption` | a package / library / action / plugin | adopt · adopt-with-guard · avoid | `andrew/managing-dependencies` + OpenSSF Concise Guide + Scorecard |
| `architecture-evaluation` | an architecture under quality requirements | risk · non-risk · sensitivity point · tradeoff point | ATAM (CMU/SEI-2000-TR-004) |
| `buy-vs-build` | a capability you must source | build · buy · bounded-buy · extend-what-exists | Thoughtworks build-vs-buy e-book (2022) + Fowler |

Merging any pair was considered and rejected — see `decisions.md` ADR-002. The short version:
`project-teardown` produces no verdict and the other three each produce a *different* one; a single
skill would have to carry four incompatible output contracts and would match everything.

#### 1.1 `project-teardown`

Reconstructs a foreign codebase. Phase 1 is six **parallel** sweeps with concrete globs, lifted from
ECC `codebase-onboarding` (https://github.com/affaan-m/ECC/blob/main/skills/codebase-onboarding/SKILL.md):
package manifests · framework fingerprints · entry points · directory snapshot (2 levels, ignoring
`node_modules, vendor, .git, dist, build, __pycache__, .next`) · config and tooling · test structure.

Phase 2 is a four-question data-flow probe — where a request enters, how it is validated, where the
business logic lives, how it reaches the database — which is the cheapest way to get from "files
exist" to "this is how it works".

Output sections map to **C4** levels and **arc42** sections, taking only what the target earns.
C4 ships its own escape clause and we ship it too: *"you don't need to use all 4 levels of diagram;
only those that add value"* (https://c4model.com/diagrams). A missing level is reported `SKIP`,
never faked.

Every claim about the code carries `path:line`. That format is lifted from `docs-architect`
(https://github.com/wshobson/agents `plugins/code-documentation/agents/docs-architect.md`) and it is
the direct analogue of a source URL: the mechanism that makes a repo analysis *checkable* rather
than plausible. It is also already the contract `agents/researcher.md:35-42` enforces, so the suite
inherits a house convention rather than inventing one.

Degradation rule, copied verbatim because it is exactly right: *"If the repo has no commits yet or
only a shallow history (e.g. `git clone --depth 1`), skip this section and note 'Git history
unavailable or too shallow to detect conventions'."*

#### 1.2 `dependency-adoption`

The one skill in the suite that **computes** its verdict instead of asserting it. Three layers:

**Layer 1 — the ladder**, which is Praxis's own ladder applied to dependencies
(https://github.com/andrew/managing-dependencies, CC0, by the founder of Libraries.io/ecosyste.ms):
standard library → transitive cost → smaller alternative → *"Can you write 20-50 lines instead of
adding a dependency?"* Closing rule: *"When in doubt, don't add."*

**Layer 2 — signals, classified by whether they can be gamed.** This is the part most evaluations
get wrong, and the source names it outright: stars and download counts are listed under *less
reliable* as **"gameable"**; commit frequency is discounted because *"stable packages don't need
commits"*. Good signals: dependent count, few direct dependencies, responsive tracker, multiple
maintainers, OSI licence, provenance attestation. Red flags: under 90 days old, recently-created
maintainer account, name similar to a popular package, vendored copies of common dependencies.

**Layer 3 — executable thresholds** against `packages.ecosyste.ms`, `api.scorecard.dev` and
`api.deps.dev/v3`, with the `jq` projections inline: last release >2y → possibly abandoned ·
`dependent_repos_count` <500 → low adoption · first release <90d → too new · `maintainers` <2 →
bus-factor risk · `versions_count` = 1 → immature · `archived` → abandoned · non-empty `advisories`.

Bus factor gets a named definition, because there are three incompatible ones and they disagree on
the same repo: Avelino et al. (ICPC 2016, file-authorship coverage, and the authors themselves
concede *"there is no consensus about how to calculate it"*), CHAOSS Contributor Absence Factor
(cumulative contributions past 50%), and ecosyste.ms Development Distribution Score (<0.15 = single
contributor dominance). **The skill implements CHAOSS's formula, states that it did, and cites
Avelino for the definition.** Ten lines of arithmetic with a worked example on the source page.

The criteria layer above the computed one is the **OpenSSF Concise Guide** (~36 imperative criteria
in seven groups, https://best.openssf.org/Concise-Guide-for-Evaluating-Open-Source-Software.html) —
already written as a checklist, vendor-neutral, and it chains into Scorecard and deps.dev.

#### 1.3 `architecture-evaluation`

ATAM's nine steps and, more importantly, its five output *types* — which are defined sharply enough
in CMU/SEI-2000-TR-004 §7 that an agent can apply them while reading a system:

- **risk** — a potentially problematic decision, recorded as the decision + the quality-attribute
  response it affects + the rationale for the effect.
- **non-risk** — a good decision resting on an assumption that is usually implicit, carrying the
  standing condition *"the assumptions must not change"*.
- **sensitivity point** — a property critical to one quality attribute; *"yellow flags: 'Use caution
  when changing this property of the architecture.'"*
- **tradeoff point** — a sensitivity point for **more than one** attribute; *"the most critical
  decisions that one can make in an architecture."*
- **utility tree** — business context → quality-attribute drivers → concrete stimulus/response
  scenarios, prioritized twice: by importance and by perceived risk.

ATAM's *phase* model is deliberately **not** imported. SEI's own reports say two phases
(TR-004 §9); the widely-cited four-phase table is from the 2002 book and is verifiable only through
a university-hosted reproduction. Encoding "four phases" would encode a contradiction between two
primary sources. The steps and the output types are unambiguous; the phases are not.

The skill also inherits ATAM's own boundary, which keeps it honest about what it is not:
*"We do not do extensive formal modeling in an ATAM… The ATAM's primary goal is in determining
where sensitivity points and tradeoffs exist."*

#### 1.4 `buy-vs-build`

Step one is the classifier, and it decides more than everything after it. Thoughtworks calls it
commodity vs differentiator; Fowler calls it utility vs strategic; Moore is cited everywhere as core
vs context. The survey's finding is that these are **one axis under three names**, and that Moore's
is unverifiable against any primary source. So the skill asks the question **once** — *is this
function how we beat competitors?* — and cites Fowler for the framing
(https://martinfowler.com/bliki/UtilityVsStrategicDichotomy.html), whose risk asymmetry is the
useful part: utility's biggest risk is catastrophic error and cost; strategic's is *not doing
something before your competitors do*.

Paired with it, the **granularity warning**, because it is the failure mode this skill exists to
prevent: *"A common mistake is to scope at the level of the package resulting in capabilities which
are too broadly defined"* — a system is rarely all-commodity or all-differentiator, and scoping the
question at product level guarantees a wrong answer.

Then four scored criteria sets from the Thoughtworks e-book, used as checklists, not as a spreadsheet:
18 developer-experience criteria · 7 technical-needs criteria (each of which must carry a metric or
service level) · 5 operability criteria · 9 vendor criteria. And the TCO rule that people skip:
*"plan for strategic obsolescence and reduce the expected lifetime."*

Lock-in mitigation is a required output, not an optional one: **bounded buy** — *"Only select vendor
products that are modular and decoupled and can be contained within the Bounded Context of a single
business capability"* (Thoughtworks Radar, Trial, Nov 2018) — which exists to prevent the **Vendor
King** anti-pattern. Fowler's `PackageCustomization` supplies the two concrete checks: customization
volume as a risk signal, and the upgrade trap where *"the customizations will break"*.

When the assessment surfaces an alternatives landscape, the verdict vocabulary is the Thoughtworks
radar's four rings — **Adopt · Trial · Assess · Caution**. Note *Caution*, not *Hold*: the rename
landed in Vol 34 (April 2026) and is verified twice, from the FAQ and from the BYOR README.

### 2. The `analyst` agent

`researcher` cannot do this job and should not be stretched to. Its contract is explicit —
*"it reports facts, never verdicts"* (`agents/researcher.md:3`) — and every skill in this suite
except `project-teardown` ends in a judgement. Stretching `researcher` would break the one boundary
that makes it trustworthy.

`analyst` is a new agent: read-mostly, produces a cited assessment **with** a verdict. It requires
both `minimalism` and `evidence-discipline` (unlike `researcher`, see Scope/Out). Its boundaries:
NOT facts without a verdict (that is `researcher`), NOT judging a diff's quality (that is `reviewer`).

It owns the cross-cutting discipline, all four items lifted from Anthropic's own multi-agent research
prompts (`anthropics/claude-cookbooks`, `patterns/agents/prompts/`):

**Query classification, stated before planning.** Every request is one of three:
*depth-first* (*"multiple perspectives on the same issue"* — plan 3–5 methodological angles),
*breadth-first* (*"distinct, independent sub-questions"* — plan sub-questions with *"extremely clear,
crisp, and understandable boundaries between sub-topics to prevent overlap"*), or *straightforward*
(one focused investigation). Then the four-question test on every plan element: can it be split ·
would multiple perspectives help · what specific output is expected · is it strictly necessary.

**A declared budget with a floor and a ceiling.** Floor: *"Execute a MINIMUM of five distinct tool
calls."* Ceiling: 20 tool calls, ~100 sources, then stop. Plus the diminishing-returns stop:
*"when you are no longer finding new relevant information and results are not getting better, STOP."*
A budget stated up front is what stops an investigation from becoming a hobby.

**Subagent ladder:** simple 1 · standard 2–3 · medium 3–5 · high 5–10, never more than 20.
*"Prefer fewer, more capable subagents over many overly narrow ones."*

**A separate citation pass with an invariance constraint.** Synthesis and citation are two steps, and
the citation step may not alter a byte: *"Do NOT modify the synthesized text in any way… If the text
is not identical, your result will be rejected."* This is what stops citations from being written to
fit the prose instead of the prose being constrained by the sources.

Plus the source-quality catalogue as a named list to flag against: speculation markers (predictions,
"could"/"may", future-tense narrative, quoted superlatives, financial projections) and
problematic-source markers (aggregators over originals, false authority, passive voice with nameless
sources, marketing language, cherry-picked data). Conflicts that cannot be reconciled are **reported
as conflicts**, not resolved silently.

### 3. Pipeline and command

`pipelines/investigation.md`, phases: `scope → sweep → assess → synthesize → verdict`.
`commands/investigate.md` is a thin trigger over it, matching the convention in `templates/command.md`
and the four existing pipeline commands. Command frontmatter carries `description:` only — no `name:`,
no `kind:` — per the shape verified in `commands/mode.md`.

`scope` classifies the query and declares the budget. `sweep` fans out the applicable skills in one
parallel wave (disjoint by construction: teardown reads code, adoption calls APIs, the other two read
what those two produced). `assess` runs the verdict-bearing skills. `synthesize` writes the dossier.
`verdict` is the separate citation pass plus the single recommendation.

### 4. Routing: the risk this change actually carries

Four new skills enter a 51-resource corpus whose EN rank-1 is **68.7%** against a floor of **65**
(`scripts/routing-audit.mjs` FLOORS, run recorded in the inventory). That is 3.7 points of headroom.
Dilution is the failure mode, and it is measurable before and after.

The existing tightest pair is already in this neighbourhood: `scout ↔ deep-research` at **0.136**
boundary-stripped (0.334 with `NOT` clauses), ceiling 0.38. Both descriptions contain the literal
phrase *"prior art"*.

Three rules follow, and they constrain the descriptions:

1. **No new skill description may contain "prior art", "investigate", or "research".** Those three
   phrases are what `scout` and `deep-research` already own. The new skills say *teardown*,
   *adopt*, *evaluate*, *source* instead.
2. **Every new description names its sibling explicitly** per `docs/skill-doctrine.md` §1, and the
   positive claim stays inside the 250-character budget.
3. **`scout` and `deep-research` each gain one `NOT` clause** naming the relevant new sibling. That
   is the minimum edit to their files and the only one.

If the post-change audit drops EN rank-1 below 65, the change does not ship as designed — the
fallback is to merge `architecture-evaluation` into `project-teardown` as a second mode and re-measure.
That fallback is written down now, before the number is known, so it is not invented under pressure.

### 5. Files touched

```
new:      skills/project-teardown/SKILL.md (+ references/)
          skills/dependency-adoption/SKILL.md (+ references/)
          skills/architecture-evaluation/SKILL.md (+ references/)
          skills/buy-vs-build/SKILL.md (+ references/)
          agents/analyst.md
          pipelines/investigation.md
          commands/investigate.md
          evals/routing/cases/{project-teardown,dependency-adoption,architecture-evaluation,buy-vs-build}.yaml
modified: skills/scout/SKILL.md            one NOT clause
          skills/deep-research/SKILL.md    one NOT clause
          skills/using-praxis/SKILL.md     one route-by-task row
          README.md, AGENTS.md, CHANGELOG.md, .claude-plugin/marketplace.json
```

Every new SKILL.md carries `## It's working if` per `docs/skill-doctrine.md` §4 — a doctrine
requirement that `validate-resources.mjs` does **not** yet enforce, so it is on the author.

## Edge Cases

- **A private or unreachable repo.** `project-teardown` reports `SKIP` per section with the reason;
  it never infers architecture from a README.
- **A package with no ecosyste.ms entry.** The computed layer reports `SKIP`, the criteria layer still
  runs, and the verdict says which layer produced it. A missing number is never a passing number.
- **All three bus-factor definitions disagree.** Expected. Report the one computed and name it.
- **"Investigate the competition" with no repo access.** The teardown degrades to observable surface —
  docs, pricing, public API, job posts — and every unobservable section is `SKIP`, not inferred.
- **The target is a Claude Code plugin.** Falls out of `project-teardown` plus `dependency-adoption`;
  the star-count warning matters most here, given the survey's finding that the most-starred
  collection was machine-generated.
- **`fast` mode.** The suite is substantial by construction. In `fast` it still writes
  `specs/<change>/implementation.md` with the dossier's verdict and its evidence; the ceremony drops,
  the citations do not.
- **A skill fires on this repo instead of a foreign one.** That is the `scout` boundary; the routing
  cases include it as an explicit `should_not_trigger` with `route_to: scout`.

## Acceptance (EAG)

Every gate below runs and is reported in four states — PASS · FAIL · SKIP · GAP — per
`docs/skill-doctrine.md` §3. Numbers in brackets are today's, measured during the inventory.

- [x] `node scripts/validate-resources.mjs` → **67 passed, 0 failed** — PASS
- [x] `node --test tests/*.test.mjs` → **tests 271 · pass 271 · fail 0** — PASS
- [x] `node scripts/routing-audit.mjs` → **PASS**, EN rank-1 **69.6%** (floor 65), collision 0.32, claim
      max 250 — PASS. Measured cost of the two new `NOT` clauses: 70.2% → 69.6%, recorded not absorbed.
      ADR-002's fallback merge is **not** triggered. Original line, for the record: EN rank-1 ≥ 65
      [today: 68.7%], max collision ≤ 0.38
      [today: 0.32], every new claim ≤ 250 chars
- [x] `node scripts/boundary-audit.mjs` → **7** — PASS. The `gi` fix in ADR-007 moved it by nothing
      today, because T07 had already reworded the labels the false positives accused; it is prospective
      and a fixture test holds it.
- [x] Each new skill has a routing case with ≥5 bilingual `should_trigger`, ≥4 `should_not_trigger`
      each naming an existing `route_to`, and ≥1 `capability` scenario
- [x] Mutation, per `docs/skill-doctrine.md` §"gate-verification": remove one new skill's `NOT`
      clause → boundary or routing audit degrades; restore → recovers. Both directions shown.
      **This prediction was wrong and the measurement is recorded instead of the prediction.** Run in
      both directions: nothing degraded — boundary held at 7, routing stayed PASS, the suite was
      byte-identical — and the gated metric *preferred* the mutant, 70.2% against 69.6%. The gate does
      not guard what this line assumed. See ADR-007; the fix is in scope and this line is re-verified
      after it.
- [x] Post-ADR-007: the same mutation must fail a **named** gate and recover on restore, with both
      outputs pasted. Nothing else substitutes for this one.
- [x] **Live cell** → PASS on the second attempt ($20.07 after the ceiling went $8 → $20); all four
      criteria met, 21/21 citations resolving. Original line: run `/praxis:investigate` against one real public repo. The dossier must contain
      (a) at least one `path:line` citation that resolves, (b) at least one computed signal with the
      API call that produced it, (c) a named verdict, and (d) at least one `SKIP` where the target
      gave nothing to assess. A dossier with no `SKIP` on a partial target is a failure, not a success.
- [x] **Negative control** → **the suite did not beat it.** `skills-off` met all four criteria in one
      run for $6.14 against the treatment's $20.07 on a second attempt. Published in full as
      `evals/value/RESULTS.md` Unit 8; disposition in ADR-008. Two of the four skills never ran, so
      this is n=1 over half the suite — stated, not smoothed. Original line: the same run with the four skills removed from the corpus, to show what
      the suite added. If the control produces a comparable dossier, that is the honest result and it
      goes in `RESULTS.md` — `evals/value/` already exists for exactly this, and has already recorded
      units that measured no difference.
