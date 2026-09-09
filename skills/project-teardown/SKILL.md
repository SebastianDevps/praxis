---
name: project-teardown
description: Use when taking apart a codebase you do not own — an unfamiliar repo, a competitor's product, a plugin under consideration — and mapping it into a cited dossier: stack, entry points, request lifecycle, C4 levels, `path:line` on every claim. NOT recon of the repo you already own (that is `scout`), NOT one question answered from outside sources (that is `deep-research`).
kind: skill
od:
  category: analysis
  triggers:
    - teardown
    - reconstruct architecture
    - unfamiliar repo
    - foreign codebase
    - competitor product
---

## When to run

The object under the lens is a codebase **you do not own**: a repo you inherited, an open-source
project you are sizing up, a competitor's product, a plugin someone proposed. You have no author to
ask and no convention you already know.

The boundary against `scout` is the **subject, not the depth**. `scout` covers this repo, and only
this repo. A shallow pass over a foreign repo is still a teardown; an exhaustive pass over your own
is still recon.

## Scope

This skill **reconstructs**. It does not judge. The verdict lives downstream and reads this dossier
as its input: `architecture-evaluation` for risks and tradeoff points, `dependency-adoption` for the
packages the teardown named, `buy-vs-build` for the capability behind the whole thing.

## Phase 1 — six sweeps, in one parallel wave

Lifted from ECC `codebase-onboarding`
(https://github.com/affaan-m/ECC/blob/main/skills/codebase-onboarding/SKILL.md). Each sweep is a
glob, not a question. Fire all six at once; do not read a file before all six have returned.

1. **Package manifests** — `package.json, go.mod, Cargo.toml, pyproject.toml, pom.xml, build.gradle, Gemfile, composer.json, mix.exs, pubspec.yaml`
2. **Framework fingerprints** — `next.config.*, nuxt.config.*, angular.json, vite.config.*, django settings, flask app factory, fastapi main, rails config`
3. **Entry points** — `main.*, index.*, app.*, server.*, cmd/, src/main/`
4. **Directory snapshot** — top 2 levels, ignoring `node_modules, vendor, .git, dist, build, __pycache__, .next`
5. **Config and tooling** — `.eslintrc*, .prettierrc*, tsconfig.json, Makefile, Dockerfile, docker-compose*, .github/workflows/, .env.example`
6. **Test structure** — `tests/, test/, __tests__/, *_test.go, *.spec.ts, *.test.js, pytest.ini, jest.config.*, vitest.config.*`

A sweep that runs and finds nothing is a `GAP`, not an omission: "no test structure found" is a
fact about the target and belongs in the dossier.

## Phase 2 — the four-question data-flow probe

Same source. Four questions get you from "these files exist" to "this is how it works", and they
are the cheapest four in the sweep:

- Where does a request **enter**? (router / handler / controller)
- How is it **validated**? (middleware / schemas / guards)
- Where does the **business logic** live? (services / models / use cases)
- How does it reach the **database**? (ORM / raw queries / repositories)

Each answer carries `path:line`. An unanswerable question is `SKIP` with the reason.

## Git history, and when to stop asking it

Conventions are readable from history — commit shape, branch naming, review habits. The degradation
rule is the source's own, kept verbatim because it is exactly right:

> "If the repo has no commits yet or only a shallow history (e.g. `git clone --depth 1`), skip this
> section and note 'Git history unavailable or too shallow to detect conventions'."

## Output — C4 abstractions, arc42 sections

**C4 supplies the altitude.** The abstraction hierarchy, verbatim
(https://c4model.com/abstractions):

> "A software system is made up of one or more containers (applications and data stores), each of
> which contains one or more components, which in turn are implemented by one or more code elements."

Four levels — **1 System Context · 2 Container · 3 Component · 4 Code** — plus three supplementary
views: **System Landscape · Dynamic · Deployment** (https://c4model.com/diagrams). C4 ships its own
escape clause and this skill ships it too:

> "you don't need to use all 4 levels of diagram; only those that add value."

A level the target does not earn is `SKIP` with the reason. Never a diagram drawn to fill a slot.

**arc42 supplies the section vocabulary** (https://arc42.org/overview), twelve sections:
1 Introduction and Goals · 2 Constraints · 3 Context and Scope · 4 Solution Strategy ·
5 Building Block View · 6 Runtime View · 7 Deployment View · 8 Crosscutting Concepts ·
9 Architecture Decisions · 10 Quality Requirements · 11 Risks and Technical Debt · 12 Glossary.

A teardown of a project you do not own can only fill the **observable** subset. Say which, and mark
the rest `SKIP` — the reason is almost always the same one, and it is worth writing down:

| arc42 section | from outside |
|---|---|
| 3 Context, 5 Building Block, 6 Runtime, 7 Deployment, 8 Crosscutting, 12 Glossary | observable — reconstruct from code, cite `path:line` |
| 11 Risks and Technical Debt | partially observable — only what the code shows (dead paths, pinned versions, TODOs), never inferred severity |
| 1 Goals, 2 Constraints, 4 Solution Strategy, 9 Decisions, 10 Quality Requirements | `SKIP` unless the target published them — these are **intent**, and intent is not recoverable from code |

§9 is where `architecture-evaluation` plugs in and §10 is its input. Leaving them `SKIP` with the
reason is what lets the next skill know it must elicit them, rather than inheriting a guess.

## Citation format

Every claim about the code carries `path:line`.

It is the direct analogue of a source URL: it makes the reconstruction **checkable** rather than
plausible — a reader clicks the line and either sees what you said or does not. Format lifted from
`docs-architect` (https://github.com/wshobson/agents,
`plugins/code-documentation/agents/docs-architect.md`), and it is already the house contract in
`agents/researcher.md:35-42`, so this inherits a convention rather than inventing one.

**Never infer architecture from a README.** A README states intent; the teardown states behaviour. If
the code was not read, the section is `SKIP` — not a paraphrase of the marketing.

## Output contract — four states, per section

Per `docs/skill-doctrine.md` §3. Every section carries exactly one:

| state | means |
|---|---|
| `PASS` | established, with `path:line` on each claim |
| `FAIL` | the code contradicts what the target says about itself — quote both sides |
| `SKIP` | could not be established, and **why** (no access, shallow clone, intent not in code) |
| `GAP` | the sweep ran and the target had nothing there (no tests, no CI, no container) |

A section is never omitted and never inferred. **A dossier with no `SKIP` on a partial target is a
defect** — every section filled means either a complete target or a fabricating agent, and the
reader cannot tell which.

## No repository access

"Take apart the competition" usually arrives with no source to read. Degrade to the observable
surface — docs, public API, pricing, job posts — and mark every unobservable section `SKIP`. The
method, the source ladder and what each surface can and cannot support:
`references/no-repo-access.md`.

## It's working if

- Every architectural claim in the dossier clicks through to a line of the target's code, and the
  reader who follows one sees what it said.
- The dossier has `SKIP`s on it, with reasons, and a reader can tell in one pass what was actually
  established versus what the target never exposed.
- Someone who has never opened the target can restate its request lifecycle from the dossier and be
  right when they finally do open it.
- `architecture-evaluation` runs next without re-reading the target: it finds §10 either stated or
  explicitly `SKIP`, and does not have to guess which.

## Anti-patterns

- Reading one file deeply before the six sweeps have returned — the sweeps are what tell you which
  file matters.
- Drawing all four C4 levels because there are four of them.
- A section quietly missing from the dossier instead of marked `SKIP` with its reason.
- Ranking, recommending, or concluding "we should use this" — that is the next skill's job, and it
  needs an unopinionated reconstruction to do it.
