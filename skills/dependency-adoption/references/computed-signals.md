# Computed signals — the three APIs, the check table, and the bus factor

Loaded from `SKILL.md` Layer 3. Everything here is a call you run, not a claim you make.
Every command below was executed against `npm:zod` on 2026-09-09; the outputs quoted are real.

---

## 1. `packages.ecosyste.ms` — one call, most of the answer

No key, no auth. `<registry>` is the ecosystem's registry host: `npmjs.org`, `pypi.org`,
`rubygems.org`, `crates.io`, `packagist.org`, `proxy.golang.org`, `hex.pm`, `nuget.org`.

The projection in `SKILL.md` is the one to run. Two fields in it are easy to get wrong:

- **`maintainers` is an array.** Project `(.maintainers | length)`, never `.maintainers`.
- **The distribution score is `.repo_metadata.commit_stats.dds`** — a sibling of
  `total_commits` / `total_committers` / `mean_commits`. It is *not* under
  `.repo_metadata.metadata`, which on npm holds only `files` and `funding`. Verified by
  `jq '.repo_metadata.metadata | keys'` → `["files","funding"]`.

Real output, `npm:zod`:

```json
{ "latest_release_published_at": "2026-08-29T17:55:42.775Z",
  "first_release_published_at": "2020-03-07T21:19:15.498Z",
  "versions_count": 1005, "dependent_repos_count": 122785,
  "maintainers": 1, "advisories": 1, "archived": false,
  "dds": 0.4439461883408071, "licenses": ["MIT"] }
```

Read it as the table in `SKILL.md` reads it: adoption enormous, licence clean, **`maintainers: 1`
fires the bus-factor row**, and one advisory to open. A package can be everywhere and still be one
person. That is the whole reason the computed layer exists.

**When the package is not there.** A 404, or `"status"` non-null (`removed`, `deprecated`), or a
`null` `repo_metadata` — the computed layer is `SKIP` with the HTTP status as the reason, the
criteria layer still runs, and the verdict names the criteria layer as its source.

`repo_metadata.scorecard.data` carries a **cached** Scorecard run with its own `date`. On `zod` it
read `4.5` dated `2025-08-11` while the live API read `5.4` dated `2026-09-07`. Quote the date with
the score, or fetch live.

---

## 2. `api.scorecard.dev` — security practice

```bash
curl -s "https://api.scorecard.dev/projects/github.com/<owner>/<repo>" | jq '{
  score, date, checks: [.checks[] | {name, score}]
}'
```

Real output, `github.com/colinhacks/zod`: `{"score": 5.4, "date": "2026-09-07"}`, with
`Code-Review: 0`, `Token-Permissions: 0`, `Maintained: 10`, `Dangerous-Workflow: 10`,
`Packaging: -1`. **`-1` means the check did not run** — that is a `SKIP` on that row, never a zero.

The three checks to read first are `Maintained`, `Dangerous-Workflow` and `Code-Review`.

### The 20 checks and their risk levels

From [`ossf/scorecard/docs/checks.md`](https://github.com/ossf/scorecard/blob/main/docs/checks.md).

| Check | Risk | Check | Risk |
|---|---|---|---|
| Binary-Artifacts | High | Packaging | Medium |
| Branch-Protection | High | Pinned-Dependencies | Medium |
| CI-Tests | Low | SAST | Medium |
| CII-Best-Practices | Low | SBOM | Medium |
| Code-Review | High | Security-Policy | Medium |
| Contributors | Low | Signed-Releases | High |
| Dangerous-Workflow | **Critical** | Token-Permissions | High |
| Dependency-Update-Tool | High | Vulnerabilities | High |
| Fuzzing | Medium | Webhooks | **Critical** — *experimental* |
| License | Low | Maintained | High |

### Three contradictions between primary sources — stated, not resolved

1. **20 or 18?** `docs/checks.md` documents **20** checks; `scorecard.dev` advertises **18**. The
   table above follows `docs/checks.md`, which is the file in the repository.
2. **`Webhooks` is `Critical` and experimental at once.** `docs/checks.md` line 711 reads
   ``Risk: `Critical` (service possibly accessible to third parties)``; the repository `README.md`
   marks the same check `EXPERIMENTAL` and notes it needs a maintainer PAT with
   `admin:repo_hook`. Report it as experimental; do not let a `Critical` label from a check that
   usually cannot run drive a verdict.
3. **The aggregate weighting** often quoted as Critical=10 / High=7.5 / Medium=5 / Low=2.5 is
   **UNVERIFIED** against a primary source. Do not quote it as fact, and do not recompute an
   aggregate score from the per-check scores.

---

## 3. `api.deps.dev/v3` — dependency graph and provenance

```bash
curl -s "https://api.deps.dev/v3/systems/<npm|pypi|cargo|go|maven|nuget>/packages/<name>" \
  | jq '{name: .packageKey.name, versions: (.versions | length)}'
```

Real output, `npm:zod`: `{"name":"zod","versions":1006}`. Use it for the **transitive cost** rung of
the ladder — the version's dependency graph — and for the advisory cross-check. It is the API the
OpenSSF Concise Guide names under *Security Scores*.

---

## 4. Bus factor — three definitions that disagree

There is no single bus factor. Three published definitions return different numbers for the same
repository, and the first of them says so in its own abstract.

### Avelino, Passos, Hora & Valente — the definition

*A Novel Approach for Estimating Truck Factors*, ICPC 2016 —
[arxiv.org/abs/1604.06766](https://arxiv.org/abs/1604.06766). A greedy algorithm over a
Degree-of-Authorship metric, computed from file authorship across a corpus of 133 popular GitHub
projects. Verbatim from the abstract:

> Altogether there is no consensus about how to calculate it, and no supporting evidence backing
> estimates for systems in the wild.

> we find that the majority of our target systems (65%) have TF <= 2.

Cite this for **what a bus factor means**. It needs full commit-authorship history to compute, which
a dependency assessment does not have.

### CHAOSS Contributor Absence Factor — the formula this skill implements

[chaoss.community/kb/metric-bus-factor](https://chaoss.community/kb/metric-bus-factor/) —
*"the smallest number of contributors responsible for 50% of total contributions."*

Ten lines of arithmetic:

1. Collect each contributor's contribution count.
2. Sort descending.
3. Threshold = total × 0.5.
4. Accumulate from the top until the running sum **exceeds** the threshold.
5. The factor is how many contributors that took.

Worked example from the source page — contributions `1000, 202, 90, 33, 332, 343, 42, 433`:

```
sorted:      1000, 433, 343, 332, 202, 90, 42, 33
total:       2475        threshold = 2475 × 0.5 = 1237.5
cumulative:  1000        (< 1237.5)  → keep going
             1433        (> 1237.5)  → stop
factor:      2
```

**This is the one to compute, and the report says that it did.** Contributor counts come from the
host API (`GET /repos/<owner>/<repo>/contributors?per_page=100` via `gh api`, which returns
`contributions` per user). If the list is truncated or unavailable, the row is `SKIP` — a truncated
list produces a factor that is too low, and a wrong number is worse than a missing one.

### ecosyste.ms Development Distribution Score — the cheap proxy

`.repo_metadata.commit_stats.dds`, a float in `0–1`, already in the Layer 3 call.

| Value | Reads as |
|---|---|
| < 0.15 | single-contributor dominance |
| 0.15 – 0.5 | moderate concentration |
| > 0.5 | well distributed |

It measures commit distribution, not the smallest set covering half the work. It answers a
different question from CHAOSS's and is not interchangeable with it — quote both, or quote one and
name it.

**Reporting rule.** One number, one name: `bus factor: 2 (CHAOSS Contributor Absence Factor)`. Never
`bus factor: 2` alone. When two definitions were computed and disagree, report both and say they
disagree — that disagreement is a finding, not an error to reconcile.
