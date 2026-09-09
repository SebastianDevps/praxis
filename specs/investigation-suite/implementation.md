---
title: Investigation Suite
stage: implemented  # new → designed → planned → implemented → shipped
owner: Sebastian
---

# Investigation Suite — Implementation

## Tasks
- [x] T01 · phase: build · state: done · `skills/project-teardown/` — foreign-codebase reconstruction
      files:  skills/project-teardown/**, evals/routing/cases/project-teardown.yaml
      verify: node scripts/validate-resources.mjs && node scripts/routing-audit.mjs
- [x] T02 · phase: build · state: done · `skills/dependency-adoption/` — computed adoption verdict
      files:  skills/dependency-adoption/**, evals/routing/cases/dependency-adoption.yaml
      verify: same as T01, plus one live API call proving each jq projection resolves
- [x] T03 · phase: build · state: done · `skills/architecture-evaluation/` — ATAM outputs
      files:  skills/architecture-evaluation/**, evals/routing/cases/architecture-evaluation.yaml
      verify: same as T01
- [x] T04 · phase: build · state: done · `skills/buy-vs-build/` — sourcing verdict
      files:  skills/buy-vs-build/**, evals/routing/cases/buy-vs-build.yaml
      verify: same as T01
- [x] T05 · phase: build · state: done · `agents/analyst.md` — verdict-bearing agent, owns the
      query classifier, the declared budget, the subagent ladder and the citation pass
      files:  agents/analyst.md
      verify: node scripts/validate-resources.mjs && node --test tests/*.test.mjs
- [x] T06 · phase: build · state: done · `pipelines/investigation.md` + `commands/investigate.md`
      files:  pipelines/investigation.md, commands/investigate.md
      verify: node scripts/validate-resources.mjs && node --test tests/links.test.mjs
- [x] T07 · phase: build · state: done · Boundaries: one `NOT` clause each in `scout` and
      `deep-research`; one route row in `using-praxis`
      files:  skills/scout/SKILL.md, skills/deep-research/SKILL.md, skills/using-praxis/SKILL.md
      verify: mutation — remove a new NOT clause → boundary/routing audit degrades; restore → recovers
- [x] T08 · phase: verify · state: done · Run every gate; if EN rank-1 < 65, execute the ADR-002
      fallback merge and re-measure before proceeding. Per ADR-007 also: fix the two gate defects
      T07 found — `boundary-audit`'s case-insensitive `NOT`, and nothing asserting a clause exists
      files:  scripts/boundary-audit.mjs, tests/boundary.test.mjs
      verify: validate-resources · tests · routing-audit · boundary-audit, all four states reported;
              and the T07 mutation must now FAIL a named gate and pass on restore
- [x] T09 · phase: verify · state: done · Live cell against one real public repo, plus the
      negative control with the four skills removed
      files:  evals/value/units.mjs, evals/value/RESULTS.md
      verify: dossier has a resolving path:line, a computed signal with its call, a named verdict,
              and ≥1 SKIP; control result recorded whatever it says
- [x] T10 · phase: ship · state: done · Identity surfaces
      files:  README.md, AGENTS.md, CHANGELOG.md, .claude-plugin/marketplace.json
      verify: node --test tests/manifest.test.mjs

Waves: {T01, T02, T03, T04} parallel (disjoint dirs) → {T05, T06} parallel → T07 → T08 → T09 → T10.

## Completed
- T05 · `agents/analyst.md` — read-mostly, verdict-bearing. Positive claim 241 chars (ceiling 250),
  free of "prior art" / "investigate" / "research"; boundaries name `researcher` and `reviewer`.
  Requires both `minimalism` and `evidence-discipline`, closing the gap `agents/researcher.md:11-12`
  leaves open. `VERDICT` / `OVERTURNED BY` taken from `skills/buy-vs-build/SKILL.md:132-133` rather
  than re-invented; the four Anthropic cookbook items imported as quoted text per ADR-003.
  `node scripts/validate-resources.mjs` → `67 passed, 0 failed`.
  `node scripts/routing-audit.mjs` → `PASS`, `56 resources · 412 prompts`, EN rank-1 `70.2%`
  (n=181, floor 65) — measured before and after adding the file: **70.2% both times, unmoved**.
  Max positive claim `250` unchanged; `analyst` appears in no collision pair.
  `node scripts/boundary-audit.mjs` → `boundary clashes: 9`, identical with and without this file
  (all nine are skills). Still above the design's `≤ 7` — pre-existing, owned by T01–T04.
  `node --test tests/*.test.mjs` → `# pass 256 # fail 7`; measured with the file removed →
  `# pass 256 # fail 6`. The one added failure is `README inventory table does not misstate the
  agents count` — the README says 11 agents and disk now has 12. That is T10's file, not this task's.
  One real defect found and fixed by the gate: `tests/invocation.test.mjs` flagged six bare resource
  mentions in the routing table; the column header was renamed `run` → `route to`, which is what the
  column actually is, and the test went red → green.
- T06 · `pipelines/investigation.md` (phases `scope → sweep → assess → synthesize → verdict`, with the
  sweep applicability table, the ADR-006 three-state section rule, and the `OVERTURNED BY` shape taken
  from `skills/buy-vs-build/SKILL.md` rather than re-invented) + `commands/investigate.md` (thin
  trigger per `templates/command.md`; `description:` only, naming repo URL · package · product ·
  technology as the target). Confirmed against `scripts/routing-audit.mjs` `loadCorpus` that the
  corpus is `skills/*/SKILL.md` + `agents/*.md` only, so `commands/` is unranked and the
  "prior art"/"investigate" description constraint does not reach it.
  `node scripts/validate-resources.mjs` → `67 passed, 0 failed` (`PASS pipelines/investigation.md`).
  `node --test tests/links.test.mjs` → `# pass 5 # fail 0`.
  `node --test tests/references.test.mjs` → `# pass 10 # fail 1`; the single failure is
  `the README resource table matches what is on disk` (`40 !== 44`), pre-existing and owned by a
  later task — not this one.
- T03 · `skills/architecture-evaluation/SKILL.md` + `references/{utility-tree,phases-disagreement}.md`
  + `evals/routing/cases/architecture-evaluation.yaml`. ATAM imported as cited text per ADR-003:
  the nine steps, the five §7 output definitions verbatim, TR-004's own no-formal-modeling boundary.
  Phases left out and stated as a two-source disagreement per ADR-004. Four states with a per-scenario
  mapping and a no-silent-omission contract per ADR-006.
  - `[node scripts/validate-resources.mjs]` → `PASS skills/architecture-evaluation/SKILL.md` · `65 passed, 0 failed` — PASS
  - `[node scripts/routing-audit.mjs]` → `PASS` · EN rank-1 `69.7%` (floor 65) · claim `248` chars (ceiling 250) — PASS
  - `[node scripts/boundary-audit.mjs]` → `boundary clashes: 9`, `architecture-evaluation` not among them — PASS
  - Case set: 6 `should_trigger` (2 ES), 5 `should_not_trigger` all resolving, 1 `capability` — PASS
  - Own-prompt rank-1 on the lexical proxy: EN 3/4, ES 0/2. The two ES misses are the documented
    proxy limit (`docs/skill-doctrine.md` §1 — ES tracked, not gated). The one EN miss is the
    tradeoff-point prompt ("caching helps latency but hurts consistency…"), whose content words are
    absent from every description by construction — recorded rather than fixed, because the fix is
    either keyword-stuffing the description or rewriting the eval prompt to fit it. GAP.
- Research wave: two parallel investigations. Internal inventory of the 40 skills, 11 agents,
  9 commands, the doctrine contract, the three audit scripts and the measured collision table.
  External survey of published prior art (Anthropic first-party prompts, the large public agent
  collections) and of the professional methods — ATAM, C4, arc42, ADR/MADR, OpenSSF Scorecard and
  Concise Guide, CHAOSS, Thoughtworks build-vs-buy and the radar rings.
- Two corrections came out of the research and are recorded because they change what we trust:
  the external agent had concluded "no published skill does rigorous dependency evaluation" from a
  single search method, and was wrong — `andrew/managing-dependencies` does exactly that. And the
  first research brief in the previous change had nine skill names that did not exist. Both are the
  same failure mode: a negative concluded from one method.
- `design.md` and `decisions.md` (ADR-001..ADR-006) written. Stage set to `designed`.
- T01 · `skills/project-teardown/SKILL.md` + `references/no-repo-access.md` + routing case.
  Evidence: `node scripts/validate-resources.mjs` → `65 passed, 0 failed` — PASS. Positive claim 240
  chars (budget 250) — PASS. Routing case: 6 `should_trigger` (4 EN, 2 ES), 5 `should_not_trigger`
  including the own-repo → `scout` boundary, 2 `capability` scenarios — PASS. Mutation of the `NOT`
  clause — SKIP, it is a change-level gate and the corpus was moving under four parallel writers.
  Two decisions the builder measured rather than asserted:
  (a) The banned-word rule and doctrine §1 conflict head-on: "research" is forbidden in a description,
  and naming the sibling `deep-research` is mandatory. Resolved toward doctrine — the word appears
  once, inside a `NOT` clause, which `routing-audit.mjs` strips via `stripBoundaries` before measuring
  collision. It costs nothing on the gated number and the positive claim stays clean.
  (b) `C4 levels` was added to the description after a measurement, not before: without it EN rank-1
  68.5% and 4/6 of its own prompts rank 1; with it 69.1% and 5/6, owner-at-1 flat at 6.7%. Recall up
  with precision unchanged is doctrine §1's signature of a closed gap rather than stuffed keywords.
  One miss left unchased, and the reason recorded: a Spanish prompt loses to `buy-vs-build` and
  `docs-seeker`. ES is tracked and not gated because a lexical ranker cannot cross languages; the only
  fix available was stuffing Spanish tokens into an English description. Instrument, not defect.
- T02 · `skills/dependency-adoption/SKILL.md` + `references/{computed-signals,openssf-criteria}.md`
  + routing case.
  Evidence: `node scripts/validate-resources.mjs` → `65 passed, 0 failed` — PASS.
  `node scripts/routing-audit.mjs` → `PASS`, EN rank-1 **70.2%** (n=181, floor 65; 69.6% before this
  skill), claim 240 chars (ceiling 250) — PASS. `node scripts/boundary-audit.mjs` → `9`, unchanged by
  this task; both extra clashes over the ≤7 contract remain `project-teardown`'s, carried to T08 —
  PASS for this task. `node --test tests/routing.test.mjs` → `56 pass, 0 fail` — PASS.
  ADR-005 confirmation: `rg -i 'stars' skills/dependency-adoption/SKILL.md` → one line,
  `> - GitHub stars (gameable)`, inside the quoted less-reliable-signals block. No threshold — PASS.
  Gate verified in both directions on this task's own file: `route_to: "strategy-compare"` mutated to
  `"no-such-skill"` → `not ok 46 - every route_to resolves to a real resource`; restored →
  `56 pass, 0 fail`. Fail then pass, same command.
  **The jq projections were executed, not asserted** (the task's second verify step). Live against
  `npm:zod`, the exact projection printed in Layer 3 → `maintainers: 1`, `advisories: 1`,
  `dependent_repos: 122785`, `dds: 0.4439461883408071`, `versions_count: 1005`, `archived: false`.
  `api.scorecard.dev/projects/github.com/colinhacks/zod` → HTTP 200, `score 5.4`, `date 2026-09-07`.
  `api.deps.dev/v3/systems/npm/packages/zod` → HTTP 200, 1006 versions. The `SKIP` path was exercised
  too: a nonexistent package → HTTP 404, which is the branch the skill routes to the criteria layer.
  **A field path in the brief was wrong and the live call caught it.** The Development Distribution
  Score is at `.repo_metadata.commit_stats.dds`, NOT `.repo_metadata.metadata.development_distribution_score`
  — `jq '.repo_metadata.metadata | keys'` returns `["files","funding"]`. Had the projection been
  transcribed instead of run, every bus-factor proxy would have silently returned `null`, which under
  ADR-006 is the exact failure the four-state rule exists to catch. The corrected path plus that
  gotcha are recorded in `references/computed-signals.md`.
  Five primary sources were re-read rather than trusted: `andrew/managing-dependencies` (431 lines,
  CC0-1.0, confirmed via `gh api`) — the ladder, the three-signal split and the Scorecard reading are
  verbatim, and it yielded one red flag the brief omitted (*"Runs code on install"*); `ossf/scorecard`
  `docs/checks.md` — 20 checks, every risk level confirmed; CHAOSS — the worked example
  (`1237.5` → `1433` → factor `2`); Avelino et al. — both quotes confirmed against the abstract;
  the OpenSSF Concise Guide — 36 criteria across 2+5+11+5+4+2+7 groups.
  Three source contradictions stated, not resolved, per ADR-004: 20 checks in `docs/checks.md` vs 18
  advertised on `scorecard.dev`; `Webhooks` `Critical` in the docs and `EXPERIMENTAL` in the README
  (both located and quoted); and the Critical=10/High=7.5/Medium=5/Low=2.5 aggregate weighting marked
  **UNVERIFIED** with an instruction not to recompute a score from it. A fourth was found in the
  sources themselves and recorded: *Activity Level* asks for commits in 12 months while the dependency
  source discounts commit frequency because *"stable packages don't need commits"*.
  One description word was changed **after** a measurement, not before: `maintenance` →
  `maintainer count`. Before, own-prompt rank-1 4/6 and EN 69.6%; after, 5/6 and EN 70.2% with
  `owner-at-1` flat at 6.5% and ES flat at 27.7%. Recall up, precision unchanged — doctrine §1's
  signature of a closed gap rather than stuffed keywords. Reverted-and-remeasured would have been the
  action if precision had moved.
  One miss left unchased and reported as a **GAP**, not a pass: the ES prompt *"¿Conviene depender de
  esta librería de validación?…"* ranks `ad-creative` first. That is the near-random Spanish behaviour
  doctrine §1 already documents by name; ES is tracked, not gated, and the only available fix was
  stuffing Spanish tokens into an English description. Instrument, not defect.
  Two clauses, not three: ADR-002's merge temptation is `dependency-adoption` ↔ `buy-vs-build`, and
  T04 already names this skill from its side. Naming it back would have spent 250-char budget to
  restate a boundary that is already carried, so the description keeps the two the brief specified
  and the body plus a `should_not_trigger` → `buy-vs-build` case carry the third.
- T04 · `skills/buy-vs-build/SKILL.md` + `references/{criteria,lock-in}.md` + routing case.
  Evidence: `validate-resources` → `65 passed, 0 failed` — PASS. `routing-audit` → PASS, EN rank-1
  69.1% (n=178), claim 244 chars — PASS. `boundary-audit` → 0 clashes attributable to this skill.
  Gate verified in both directions, incidentally but for real: the boundary audit fired on the first
  draft with 3 clashes (the `decision-challenge` exclusion sharing *decision* / *made* with body
  labels), and cleared to 0 after three labels were reworded. Fail then pass, same file, same command.
  Precedent set and recorded: three `NOT` clauses instead of two. `dependency-adoption` was added
  beyond the brief because ADR-002 names that exact pair as the merge temptation — both answer
  "source it or make it" — making it the highest-value boundary in the suite. No resource in the
  corpus previously named three siblings. Routing did not degrade.
  Enforced in the body: the granularity guard runs before anything else, the differentiator question
  is asked once with Fowler / Thoughtworks / Moore named as one axis under three names and Moore's
  marked UNVERIFIED (ADR-004), Thoughtworks' build-side advocacy is disclosed twice, and `OVERTURNED
  BY` is a required output line rather than a confidence level.
- T07 · `skills/scout/SKILL.md` + `skills/deep-research/SKILL.md` one `NOT` clause each,
  `skills/using-praxis/SKILL.md` four route rows, `skills/project-teardown/SKILL.md` two label
  rewordings.
  Evidence: `node scripts/validate-resources.mjs` → `67 passed, 0 failed` — PASS.
  `node scripts/boundary-audit.mjs` → `9` before, `7` after — PASS, back to the pre-change baseline
  and to `tests/boundary.test.mjs`'s seven-entry BASELINE, which now matches exactly.
  `node scripts/routing-audit.mjs` → PASS both times; EN rank-1 **70.2% → 69.6%** (n=181), top-3
  77.6 → 77.2, declared-route top-3 81.1 → 80.0, claim max 250 (unchanged — a `NOT` clause is
  stripped before the budget is measured, verified by the audit rather than assumed).
  `node --test tests/*.test.mjs` → 257 pass / 6 fail, identical before and after; all six are the
  README inventory-count tests (177, 178, 180, 181, 182, 207), which are T10's.
  **Recorded regression, not hidden:** the 0.6-point EN rank-1 drop is the documented cost of the
  doctrine — `scripts/routing-audit.mjs:202` states that `NOT x (that is \`y\`)` injects y's
  vocabulary into x. Two clauses were added, so two descriptions now carry a sibling's words. Still
  4.6 points above the 65 floor. The ADR-002 fallback is not triggered.
  The two `boundary-audit` clashes cleared were **not** what they looked like. `project-teardown`'s
  description says "a codebase you do **not** own", and the audit matches `NOT` case-insensitively,
  so it read that prose "not" as a boundary clause and swallowed the entire positive claim into the
  excluded phrase — which is why *levels* and *dossier*, both words of the positive claim, appeared
  as exclusions. Fixed on the label side as instructed and as T04 did: `## Output — C4 levels` →
  `C4 abstractions` (also the more faithful term — the cited page is c4model.com/**abstractions**,
  and line 69 already says "the abstraction hierarchy"), and "the dossier states behaviour" → "the
  teardown states behaviour". Both labels got more precise, and no `NOT` clause was weakened.
  **GAP — the mutation found the gate does not guard what we assumed.** Removing the `NOT` clause
  added to `scout` and re-running every gate: `boundary-audit` stayed at `7`, `routing-audit` stayed
  `PASS`, `node --test` stayed 257/6 with the same six names. Nothing caught it. Worse than silent:
  the gated metric *rewards* the deletion — EN rank-1 reads 70.2% without the clause and 69.6% with
  it, because `stripBoundaries` (`scripts/routing-audit.mjs:146`) removes clauses from the collision
  text but the ranking text keeps them. Cause: no gate in the set asserts that a description carries
  a boundary clause — `validate-resources.mjs` has no `NOT` rule (`rg 'NOT|boundary|that is'` over it
  returns nothing) and `boundary-audit.mjs` only fires when a clause is *contradicted by the body*,
  never when one is absent. `tests/boundary.test.mjs`'s "baseline does not rot" test would catch the
  deletion of a clause that produces a baseline entry; neither new clause does. The clause was
  restored and every number returned to the post-edit reading. Owner: not T07 — the fix is a new
  assertion in `validate-resources.mjs` or `tests/`, outside this task's files.
- T08 · `scripts/boundary-audit.mjs` (the `gi` fix) + `tests/boundary.test.mjs` (the presence
  assertion). ADR-007 discharged; no SKILL.md needed a clause added.
  **The acceptance, both directions.** Mutation: remove one `NOT` clause from `dependency-adoption`.
  `[node --test tests/boundary.test.mjs]` → `not ok 8 - a recorded boundary is never silently
  deleted` · `+ [ 'skill:dependency-adoption -> strategy-compare' ]` · `# pass 11 # fail 1` — FAIL,
  by name, naming the deleted boundary. Restored (`git diff` on the file → empty, byte-identical):
  `[node --test tests/boundary.test.mjs]` → `# tests 12 # pass 12 # fail 0` — PASS. The gate T07
  proved absent now exists and fires.
  **The "at least one" assertion alone did not discharge it, and that is measured, not assumed.**
  With only "every `kind: skill` description carries at least one clause", the same mutation ran
  fully green: `validate-resources` 67/0, `boundary-audit` 7, `routing-audit` PASS at 69.6%, boundary
  tests `# pass 9 # fail 0`. `dependency-adoption` declares two boundaries, so deleting one leaves it
  compliant — a "has at least one" check cannot see a boundary disappear. Three assertions ship
  instead: presence (at least one, or an enumerated router exemption), sibling existence, and a
  **no-erosion ratchet** — the recorded boundary graph, 54 rows keyed `kind:id`, asserted as a subset
  of what is declared today. One-directional on purpose: adding a boundary passes silently, deleting
  one fails and can only be made to pass by editing the table, which is the argued act ADR-007 forces.
  **Enumerated: every resource that fails the presence check.** Three, and only two are genuine.
  - `skills/security/SKILL.md` — *"…NOT generic code review (that is the `reviewer` agent) — this is
    the threat surface only."* Not a missing clause: **the pattern was wrong**. It names a real
    sibling and the bare-backtick regex rejected it for the article and the kind noun. Five
    descriptions use that shape and at least one MUST — a `security` skill and a `security` agent
    both exist, so `agents/refuter-security.md`'s "(that is the `security` skill)" cannot say which
    it means without the noun; `apple-hig` and `decision-challenge` name a family glob. The pattern
    was relaxed to accept an optional article and kind noun, and relaxed for that reason only. What
    did not move: a real sibling must be named, and it must resolve to a resource on disk.
  - `skills/using-praxis/SKILL.md` — *"NOT any single discipline — this is the router that dispatches
    to them."* Genuinely has no sibling, exactly as ADR-007 anticipated. What it excludes is every
    specialist at once; naming one would be a false discrimination that also ranks.
  - `agents/orchestrator.md` — *"NOT an implementer — it dispatches and never writes production code
    itself."* The same shape for the same reason.
  The last two are an enumerated `ROUTERS` map with the clause quoted, not a hole in the pattern: a
  third cannot join silently, and a rot test deletes an entry the moment it gains a real clause.
  **Scope: skills and agents.** Agents are included because `routing-audit.mjs` ranks all 56
  resources against one another, so an agent competes for the same prompt, and because 10 of 11
  already comply — the convention was there, unasserted. Crafts and pipelines are excluded on the
  evidence, not by preference: 0 of 11 carry a clause, since a craft is always-on and a pipeline is
  invoked by name. Asserting it there would invent a convention rather than hold one.
  **Location: `tests/boundary.test.mjs`, not `validate-resources.mjs`.** That script validates each
  file in isolation against a frontmatter *shape*; it holds no corpus registry, and sibling existence
  needs one. It also has no way to express a reviewed exception — its output is per-file `PASS <path>`
  lines. The repo's convention for a reviewed ratchet is a test (`BASELINE` in this same file, the
  floors in `routing.test.mjs`), and the assertion belongs beside the other boundary-clause
  assertions rather than in a second place that would define "clause" differently.
  **The `gi` fix changes no number today, and the fixture test is the only thing that holds it.**
  `boundary-audit` reads 7 with the old regex and 7 with the new one, because T07 had already
  reworded the two innocent labels the false positives accused. Proven live rather than reasoned:
  under `/gi`, `project-teardown`'s excluded phrase for `scout` parses as *"own — an unfamiliar repo,
  a competitor's product … cited dossier: st…"* — its own positive claim; under `/g` it parses as
  *"recon of the repo you already own"*. A regression test pins it, and the test is armed: with the
  old `/gi` regex restored, `node --test tests/boundary.test.mjs` → `not ok 12 - prose \`not\` is not
  a boundary clause` · `# pass 11 # fail 1`.
  **Four gates, four states.**
  - `[node scripts/validate-resources.mjs]` → `67 passed, 0 failed` — **PASS**
  - `[node scripts/routing-audit.mjs]` → `PASS` · `56 resources · 412 prompts` · EN rank-1 **69.6%**
    (n=181, floor 65) · max collision 0.32 (ceiling 0.38) · claim max 250 (ceiling 250) — **PASS**.
    Unchanged from T07's restored reading to the tenth of a point: this task edited no description,
    so the 0.6-point regression T07 recorded (70.2% → 69.6%, the documented cost of naming a sibling)
    neither grew nor shrank. 4.6 points of headroom. **ADR-002's fallback merge is not triggered** —
    it fires below 65.
  - `[node scripts/boundary-audit.mjs]` → `boundary clashes: 7` — **PASS**. This is the new recorded
    baseline and it equals the old one, so design §Acceptance's "≤ 7" is re-stated as true rather
    than forced back. The stale "9 of today's hits" in the script header was corrected to 7.
  - `[node --test tests/*.test.mjs]` → `# tests 271 # pass 265 # fail 6` — **PASS** for this task.
    All six failures are T10's README inventory counts and none is new: `184`/`185` skills and agents
    counts, `187`/`188` pipelines and commands counts, `189` full-inventory presence, `214` the README
    resource table against disk. Total rose 263 → 271 because this task added eight tests; the pass
    count rose by the same eight, 257 → 265.
  **GAP — two definitions of "a boundary clause" now coexist, deliberately and recorded.**
  `boundary-audit.mjs`'s `CLAUSE_RE` stays bare-backtick, per ADR-007's "surgical: one regex flag";
  the presence assertion accepts the qualified shape. Consequence, measured not inferred: broadening
  the clash detector the same way yields **9**, the two extra being `security::code` — its `reviewer`
  exclusion sharing the word "code" with `## When the Code Calls a Model` and one bold label. Both
  read, both benign. Not applied here because it moves the recorded baseline for a second, unasked
  reason inside the task that re-records it. Owner: a follow-up, not T08.
  **GAP — `docs/skill-doctrine.md:29` states "`tests/routing.test.mjs` checks that `Y` exists".**
  It does not. `tests/routing.test.mjs:85` checks the `route_to` field of the eval-case YAML, a
  different thing; nothing in that file reads a description's `NOT` clause. The sibling inside a
  description was unchecked until this task — the same defect class ADR-007 names. The doctrine file
  is outside this task's scope, so this is reported, not edited.
- T10 · `README.md`, `AGENTS.md`, `CHANGELOG.md`, `.claude-plugin/marketplace.json`.
  **Every count came from the filesystem, not from `design.md`.** The design says 40 skills and 11
  agents; both were already stale when it was written. Counted the way each test counts:
  `fd -t f SKILL.md skills | wc -l` → **44** (and 44 directories, so `manifest.test.mjs`'s
  SKILL.md-carrying count and `references.test.mjs`'s directory count agree), `agents` **12**,
  `crafts` **6**, `pipelines` **5**, `commands` **10**. The README's five-row inventory and its
  agent and command lists now carry those numbers.
  **README — the suite got a section, not a bullet.** "What it does with code you don't own",
  placed after "How it engineers" (which is about code you do own) and before "Why Praxis":
  the pitch, the verified external gap (no published skill or agent does architecture *evaluation*
  as opposed to *documentation*; Anthropic's `Explore` prompt is 45 lines of file-search specialist
  with no output schema), the cited imports per ADR-003, `dependency-adoption` computing rather than
  asserting and never using a star count (ADR-005), the four reported contradictions (ADR-004), and
  ADR-006's rule that a dossier with no `SKIP` on a partial target is a defect.
  **The measurements section got ADR-007, which is the most interesting thing this change found.**
  Three sentences in the section that already publishes results that went against the project: the
  boundary gate rewarded deleting boundaries, the gated metric preferred the mutant by 0.6 points,
  and the fix is the one-directional ratchet over 54 recorded boundaries in
  `scripts/boundary-audit.mjs` + `tests/boundary.test.mjs`.
  **The eval paragraph carries no number, on purpose.** T09 is running in parallel and its result is
  unknown, so the paragraph states that the negative control is the measurement and that the result
  goes there whatever it says, with `<!-- T09 result pending -->` as the drop-in marker. No sentence
  in it assumes the suite won.
  **`AGENTS.md` has no agent roster**, checked rather than assumed —
  `rg -n 'researcher|reviewer|refuter|backend|platform|engineer' AGENTS.md` returns only prose about
  memory and `git show 49eaefe -- AGENTS.md` shows the `platform` agent's own commit added no roster
  either. So `analyst` went where the file actually points at resources: the "Pointers only here"
  line at the end of Workflow, which now also names the four skills, the pipeline, the command, and
  why the agent is not `researcher`.
  **No version bumped.** `git show b9c7de5 --stat` (the 0.7.0 release) shows the convention: the
  feature commit writes bullets under `## [Unreleased]` and a separate `chore(release)` commit cuts
  the heading and bumps all four manifests. `git show 5df815a -- CHANGELOG.md` confirms the feature
  side. The entry is therefore `### Added` + `### Fixed` under `[Unreleased]`, and
  `git diff -U0 .claude-plugin/marketplace.json | rg 'version'` → none. This matters mechanically:
  `plugin.json` is outside this task's files, and `manifest.test.mjs` asserts all three versions
  agree, so a bump here would have gone red.
  **`marketplace.json` — one claim was made false by this change and was fixed, not carried.**
  "no network calls" is no longer true now that `dependency-adoption` reads `packages.ecosyste.ms`,
  `api.scorecard.dev` and `deps.dev`; it now reads "no daemon, no database, no telemetry; the only
  network calls are the public APIs that assessment reads", plus a sentence on assessing what you do
  not own. No count was added to that description — `manifest.test.mjs`'s own comment says a gate
  should not dictate copy, and a stated count there would be a fourth surface to keep true.
  **Gates.**
  - `[node --test tests/manifest.test.mjs]` → `# tests 12 # pass 12 # fail 0` — **PASS**
  - `[node --test tests/*.test.mjs]` → `# tests 271 # pass 271 # fail 0` — **PASS**. The six README
    inventory failures T08 recorded (`184`/`185` skills and agents, `187`/`188` pipelines and
    commands, `189` full-inventory presence, `214` the resource table against disk) are all gone;
    no test was edited to get there — `git diff --stat` shows `tests/` untouched by this task.
  - `[node scripts/validate-resources.mjs]` → `67 passed, 0 failed` — **PASS**
  - `[node -e "JSON.parse(...marketplace.json)"]` → `marketplace.json valid` — **PASS**
  **GAP — nothing gates the prose, only the numbers.** `manifest.test.mjs` and `references.test.mjs`
  check that a stated count is true and `links.test.mjs` checks that a prose path resolves; no gate
  reads whether the new README section describes what ships. The section's factual claims are
  traceable to `design.md` and `decisions.md`, which is provenance, not verification.
- none. Approval landed and was verified, because two builders reported it differently: T04 said the
  marker existed, T03 said it did not. Checked two ways rather than trusting either —
  `ls -la .praxis/approved/` → `investigation-suite` at 15:23, and `test -f` → EXISTS. T03 read it
  before 15:23, when the first approved edit had not yet fired `post-tool-use`. `hooks/hooks.json:52`
  registers `PreToolUse` → `hooks/pre-tool-use`, so the floor was armed. The mechanism behaved as
  designed: the record was written by the hook, not by any model.

## Carried into T08 — two numbers currently outside the contract
- `boundary-audit` → **9**, and design §Acceptance says ≤ 7. Neither of the two extra clashes belongs
  to `buy-vs-build` or `architecture-evaluation`; both are `project-teardown` (`levels`, `dossier`
  sharing a word with its `scout` exclusion). T04 showed the fix is a label rewording, and showed it
  fail-then-pass on its own file.
- `architecture-evaluation` own-prompt rank-1 is **EN 3/4, ES 0/2 — a GAP, not a clean pass**, and
  T08 must read it that way against ADR-002's confirmation. The unmatched EN prompt is the
  tradeoff-point case, which is the skill's most distinctive output: *"Caching everything in the edge
  layer helps latency but hurts consistency. What else does that decision pull on?"* Its content words
  appear in no description in the corpus, so the lexical proxy cannot see it. The only two fixes are
  keyword-stuffing the description or rewriting the eval prompt to fit the artifact; both make the
  corpus worse, so neither was done.
- Wave-level `node --test` failures, re-measured after T02 landed — **4, not three, and the
  attribution above was wrong**: T02's routing case did not clear any of them. Three are the README
  inventory (`176`, `181`, `206` — 40 on the page, 44 on disk) which T10 owns; one is
  `not ok 6 - no skill body takes on work its own description excludes`, the two `project-teardown`
  clashes (`levels`, `dossier`) already carried to T08. Nothing here is attributable to T02:
  `node --test tests/routing.test.mjs` → `56 pass, 0 fail`.

## Session Notes
- Measured baselines to beat, taken during the inventory and recorded before any edit:
  `validate-resources` 61 passed / 0 failed · `node --test tests/*.test.mjs` 258 pass ·
  `routing-audit` PASS with EN rank-1 68.7% against a floor of 65 · `boundary-audit` 7.
- The routing headroom is 3.7 points and this change adds four skills. That is the single largest
  risk in the design, which is why §4 names the fallback merge before the number is known.

- T09 · `evals/value/units.mjs` (the `investigation` unit: fixture, target, four-criterion scorer,
  exported `resolveCitations` / `scoreSignals` / `scoreVerdictAndSkips` / `scoreDossier`) +
  `evals/value/RESULTS.md` (Unit 8) + `evals/value/runs/t09-driver.mjs`, `t09-scorer-proof.mjs`,
  five raw streams, five `.state.json`, `investigation-snapshot.json`, `investigation-results.json`.
  Target: `gajus/zod-compiler` @ `32d255b` — repo created 2026-06-10 (post-cutoff), absent from this
  corpus by two orthogonal methods, 803 stars against `maintainers: 1` / `dependent_repos_count: 0`,
  and partial in three places (`api.scorecard.dev` 404, no stated SLO, no request lifecycle).
  Evidence, dossier files only, n=1 per arm, `[node runs/t09-driver.mjs rescore]` →
  `treatment r2  $20.07  cut off at the $20 cap  a 21/21 · b yes · c yes · d 3  → PASS`
  `skills-off r2 $6.14   completed               a 27/30 · b yes · c yes · d 2  → PASS`
  `bare r1       $1.25   completed               a  0/0  · b no  · c yes · d 0  → FAIL`
  (`treatment r1 $8.00` and `skills-off r1 $8.14` both cut off at an $8 cap → FAIL; total $43.61.)
  **The suite tied its own control and lost on cost.** `skills-off` — pipeline, `analyst` and
  command intact, the four skills deleted — met all four acceptance criteria in one uninterrupted
  run for a third of the price, and reached the same verdict by the same route (`z.compile()` in
  zod 4.5 makes the dependency largely unnecessary). The treatment met them only after the ceiling
  was raised to $20, which it also hit. The measured value sits in `pipelines/investigation.md` +
  `agents/analyst.md` + `commands/investigate.md`: the `bare` arm wrote no artifact and produced
  zero resolving citations, zero API calls and zero `SKIP`s. Recorded as a negative in `RESULTS.md`.
  ADR-006 earned its place: `skills-off` r1 wrote an 18.9 KB dossier with **zero** `SKIP`s over a
  truncated investigation and passed every other criterion — (d) is the only check that caught it.
  Gate proven both directions before and after the spend (`runs/t09-scorer-proof.mjs`): nine
  mutations each fail their own criterion, restored baseline passes. Eight scorer defects found and
  fixed — two pre-spend by mutation, six by reading the streams against the numbers — plus one
  defect in the proof itself, where a fix made the (c) mutation stop failing and the mutation had to
  be rewritten. All enumerated in `RESULTS.md` § "Scorer defects".
  Not measured: n=3 (n=1 per arm, at $6–20 a cell); `architecture-evaluation` and `buy-vs-build`
  were never exercised — this target has no stated quality requirement, the condition their own
  bodies require. Bash was denied throughout, identically in every arm: the fixture's allow rules do
  not cover a compound command opening with a variable assignment or `cd target && …`.

- Close-out, orchestrator. Owner approved ADR-008 option (c) and, with it, ADR-009. Recorded:
  `design.md` §Acceptance rewritten from predictions to measurements — including the one prediction
  that was wrong (the mutation gate) and the one result that went against the change (the negative
  control). Final gates, all four run at close:
  `node scripts/validate-resources.mjs` → `67 passed, 0 failed` — PASS
  `node --test tests/*.test.mjs` → `tests 271 · pass 271 · fail 0` — PASS
  `node scripts/routing-audit.mjs` → `PASS`, EN rank-1 69.6% (floor 65), collision 0.32, claim max 250 — PASS
  `node scripts/boundary-audit.mjs` → `7` — PASS
  ADR-009 confirmation: `rg -n 'no network' README.md AGENTS.md .claude-plugin/*.json` → empty — PASS
