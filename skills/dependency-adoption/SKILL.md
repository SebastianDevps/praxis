---
name: dependency-adoption
description: Use when deciding whether to take on a package, library, GitHub Action or plugin — computes maintainer count, adoption and bus-factor numbers from public APIs and returns adopt · adopt-with-guard · avoid, each with the call that produced it. NOT choosing between candidates you already vetted (that is `strategy-compare`), NOT the threat surface of your own code (that is `security`).
kind: skill
od:
  category: analysis
  triggers:
    - should we depend on this
    - adopt this package
    - vet a library
    - package health
    - bus factor
    - is this dependency maintained
---

## When to run

Before a package, library, GitHub Action or plugin enters the manifest. The object is one candidate
and the question is whether to take it on. Choosing among candidates already vetted is
`strategy-compare`; sourcing a *capability* rather than a package is `buy-vs-build`.

## Verdict vocabulary

- **adopt** — every threshold cleared, or the misses are named and immaterial.
- **adopt-with-guard** — take it, and the guard is written down: a pin, a wrapper at one seam, a
  vendored fallback, a scheduled re-check with the date.
- **avoid** — a red flag fired, or the numbers do not support the dependency.

Every verdict names **which layer produced it** and **the evidence that would overturn it**.

## Layer 1 — the ladder, before any evaluation

This is Praxis's own ladder applied to dependencies. Source, verbatim
([`andrew/managing-dependencies`](https://github.com/andrew/managing-dependencies), CC0-1.0, by
Andrew Nesbitt — founder of Libraries.io and ecosyste.ms; the same author runs the API Layer 3 calls):

> Check in order:
> 1. **Standard library** - Does the language already provide this? (e.g., date parsing, HTTP, JSON)
> 2. **Transitive cost** - How many dependencies does it bring? Check with `npm ls`, `pip show`, `bundle info`, `cargo tree`
> 3. **Smaller alternative** - Is there a focused package that does just what's needed?
> 4. **Inline it** - Can you write 20-50 lines instead of adding a dependency?
>
> When in doubt, don't add. PRs that only remove dependencies are usually good PRs.

The same source adds one classification worth keeping: state whether the dependency is
development-only (`--save-dev`, `group :development`, `[tool.poetry.group.dev.dependencies]`), which
keeps it out of the production attack surface.

Stop at the first rung that holds. A dependency that rung 1–4 removes never reaches Layer 2.

## Layer 2 — signals, classified by whether they can be gamed

The three-way split is the load-bearing part, and the source's own words carry it
([same source](https://github.com/andrew/managing-dependencies)):

> **Good signals:**
> - High dependent count (other packages trust it)
> - Few direct dependencies
> - Responsive issue tracker
> - Multiple maintainers
> - OSI-approved license
> - Provenance attestation
>
> **Less reliable signals:**
> - GitHub stars (gameable)
> - Download counts (gameable)
> - Commit frequency (stable packages don't need commits)
> - Contributor count
>
> **Red flags:**
> - Package less than 90 days old
> - Maintainer account created recently
> - Name similar to popular package (typosquatting)
> - No license or non-OSI license
> - Vendors copies of common dependencies
> - Very few downloads for claimed purpose
> - Runs code on install (postinstall scripts, setup.py)

**Never state a star count as a reason.** When someone offers one, say why the signal is weak — it
is gameable and the source classifies it as such — and substitute the two signals that are not:
`dependent_repos_count` (how many repositories actually depend on it) and the maintainer count.
Same for download counts.

A red flag does not lower a score. It sets the verdict to **avoid** until it is explained.

## Layer 3 — compute it

One call answers most of it. Registry is the ecosystem's registry host (`npmjs.org`,
`pypi.org`, `rubygems.org`, `crates.io`, …):

```bash
curl -s "https://packages.ecosyste.ms/api/v1/registries/<registry>/packages/<package>" | jq '{
  latest_release:      .latest_release_published_at,
  first_release:       .first_release_published_at,
  versions_count:      .versions_count,
  dependent_repos:     .dependent_repos_count,
  dependent_packages:  .dependent_packages_count,
  maintainers:         (.maintainers | length),
  advisories:          (.advisories | length),
  archived:            .repo_metadata.archived,
  dds:                 .repo_metadata.commit_stats.dds,
  license:             .normalized_licenses,
  repo:                .repository_url
}'
```

| Signal | Threshold | Reads as |
|---|---|---|
| `latest_release_published_at` | older than 2 years | possibly abandoned |
| `dependent_repos_count` | < 500 | low adoption |
| `first_release_published_at` | newer than 90 days | too new — red flag |
| `maintainers` | < 2 | bus-factor risk |
| `versions_count` | = 1 | immature |
| `repo_metadata.archived` | `true` | abandoned |
| `advisories` | non-empty | known vulnerabilities — read each one |
| `normalized_licenses` | empty or non-OSI | red flag |
| `repo_metadata.commit_stats.dds` | < 0.15 | single-contributor dominance |

A threshold is only crossed against a number the call returned. **A missing number is never a
passing number** — it is `SKIP`, and the verdict says so.

Security practice comes from OpenSSF Scorecard, and the same source gives the reading:

> Score below 5 warrants a closer look, though small or mature projects often score lower without
> being risky. If `Maintained` or `Dangerous-Workflow` scores are below 3, flag as higher risk.

The API calls, the Scorecard check table, `api.deps.dev`, and the bus-factor arithmetic:
`references/computed-signals.md`.

## The criteria layer

Above the computed layer sits the **OpenSSF Concise Guide for Evaluating Open Source Software** —
36 criteria in seven groups, vendor-neutral, already written as imperatives. It runs on every
assessment and it is the layer that still works when the computed one reports `SKIP`. Full text:
`references/openssf-criteria.md`.

Two of its criteria are the ones people skip and both are cheap: **Maintainer Diversity** —
*"Verify the presence of more than one maintainer, ideally from different organizations, to reduce
single-point-of-failure risk"* — and **Name Verification** — *"Check if a similar name is more
popular, which could indicate a typosquatting attack."*

## Output contract

Four states per line, never three: **PASS · FAIL · SKIP · GAP**. `SKIP` means the check could not
run; `GAP` means it ran and had nothing to check against. Silence never reads as clean.

```
LADDER          <the rung that held, or: none — a dependency is warranted because …>
COMPUTED        <signal = value | threshold | PASS/FAIL/SKIP>  — one line per row of the table
                <the exact command, so the reader can re-run it>
BUS FACTOR      <n> by CHAOSS Contributor Absence Factor  | SKIP <why>
CRITERIA        <the OpenSSF groups that fired, cited>     | GAP <what it had nothing to check>
RED FLAGS       <each one, or NONE — with what was checked>
VERDICT         adopt | adopt-with-guard | avoid
                produced by: computed layer | criteria layer | both
                overturned by: <the specific number or fact that would flip this>
GUARD           <only on adopt-with-guard: the pin, seam, fallback, or re-check date>
```

## It's working if

- Every threshold in the report is followed by the value it compared against and the command that
  returned it — never "actively maintained" on its own.
- A star count offered by the user comes back as a weak signal, with `dependent_repos_count` and the
  maintainer count put in its place.
- A package the APIs do not know still gets a verdict, and the verdict says the criteria layer
  produced it — not a shorter version of the same confidence.
- The bus factor is reported with the name of the definition that produced it.
- Someone can re-run the report a month later and see which line changed.

## Anti-patterns

- A star count used as a reason. It is gameable and the primary source says so.
- Filling a number the API did not return with a plausible one.
- Running the criteria layer and presenting the result as computed.
- One bus factor reported as *the* bus factor, with no definition named — three definitions exist
  and they disagree on the same repository.
- A verdict with nothing that could overturn it. That is a preference, not an assessment.

> Method imported as cited text per `specs/investigation-suite/decisions.md` ADR-003; contradictions
> between primary sources are stated, not resolved, per ADR-004.
