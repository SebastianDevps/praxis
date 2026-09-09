# OpenSSF Concise Guide — the criteria layer

Loaded from `SKILL.md` § "The criteria layer". Source:
[best.openssf.org/Concise-Guide-for-Evaluating-Open-Source-Software.html](https://best.openssf.org/Concise-Guide-for-Evaluating-Open-Source-Software.html)
— OpenSSF Best Practices Working Group. Reproduced with the source's own criterion names and
wording; nothing here is paraphrased into a stronger claim than the page makes.

**36 criteria in seven groups.** This layer runs on every assessment, including the ones where the
computed layer reported `SKIP`. Report each group as one line: which criteria fired, and `GAP` for a
group that ran with nothing to check against.

---

## Initial Assessment (2)

- **Consider Necessity** — evaluate whether the dependency can be avoided by using components you
  already have. This is the same question as Layer 1 rung 1, reached from the other direction.
- **Verify Authenticity** — verify that the software being evaluated is the authentic version from
  the authorized source, not a personal fork nor an attacker-controlled fork. The guide names
  typosquatting here, where *"an attacker creates an 'almost-correct' name"*.

## Maintenance & Sustainability (5)

- **Activity Level** — confirm significant recent activity (e.g., commits) has occurred within the
  previous 12 months.
- **Communication** — verify the existence of recent releases or announcements from the project
  maintainer(s).
- **Maintainer Diversity** — *"Verify the presence of more than one maintainer, ideally from
  different organizations, to reduce single-point-of-failure risk"*.
- **Release Recency** — confirm that the last release was issued within the previous 12 months.
- **Version Stability** — assess whether the version string indicates instability (e.g., begins with
  `0`, includes `alpha` or `beta`).

> Note the tension with Layer 2: *Activity Level* asks for recent commits, while the dependency
> source discounts commit frequency because *"stable packages don't need commits"*. Both are right
> about different things — no commits in 12 months on a young, complex package is a signal; on a
> small, finished one it is not. Say which case this is rather than applying the rule blind.

## Security Practices (11)

- **Assessment Framework** — consider using established assessment methodologies.
- **Best Practices Certification** — determine whether the project has earned an OpenSSF Best
  Practices badge.
- **Dependency Management** — verify that the package dependencies are (relatively) up to date.
- **Repository Security** — confirm that developers use code hosting security features.
- **Security Audits** — identify existing security audits and verify vulnerabilities have been fixed.
- **Security Development** — confirm the project applies secure software development best practices.
- **Security Documentation** — verify the existence of documentation explaining why it is secure.
- **Security Response** — assess whether the project fixes bugs in a timely manner.
- **Security Scores** — examine information on `deps.dev`, including the OpenSSF Scorecard score.
- **Testing Practices** — evaluate whether automated tests are included in its CI pipeline.
- **Vulnerability Status** — confirm the current version is free of known important vulnerabilities.

## Usability & Security — the API as a security surface (5)

- **Interface Design** — verify that the interface/API is designed to be easy to use securely.
- **Interface Stability** — verify that the interface/API is stable, or that the project has a policy
  for handling breaking changes.
- **Secure Defaults** — confirm that the default configuration and *"simple examples"* are secure.
- **Security Guidance** — verify there is guidance on how to use it securely.
- **Vulnerability Reporting** — confirm there are instructions on how to report vulnerabilities.

> This group is the one an assessment usually drops, and it is the one that decides what the
> dependency costs after adoption. An API that is easy to misuse turns every future caller into a
> new chance to introduce a defect.

## Adoption & Licensing (4)

- **License Clarity** — verify that every component has a license that is widely used and consistent
  with your intended use.
- **Name Verification** — *"Check if a similar name is more popular, which could indicate a
  typosquatting attack"*.
- **Adoption** — assess whether the software has significant use.
- **Suitability** — choose software that is a good solution for your problem.

> *Adoption* is measured with `dependent_repos_count`, never with a star or download count — see
> `SKILL.md` Layer 2 and `specs/investigation-suite/decisions.md` ADR-005.

## Practical Testing (2)

- **Behavior Testing** — try adding the dependency as a test in an isolated environment.
- **Dependency Impact** — verify it does not add unexpected or unnecessary indirect dependencies.

## Code Evaluation (7)

- **Code Completeness** — evaluate whether there is evidence of insecure/incomplete software.
- **Malicious Code Check** — analyze whether there is evidence that the software is malicious.
- **Sandbox Testing** — consider running the software in a sandbox.
- **Security Implementations** — check for evidence of secure development practices in source code.
- **Security Reviews** — consult the OpenSSF's list of security reviews.
- **Static Analysis** — review the *"top"* problems reported by static analysis tools.
- **Test Validation** — consider running all defined test cases.

---

## How to report this layer

Seven lines, one per group, each `PASS · FAIL · SKIP · GAP`. A group is `GAP` when it ran and the
target offered nothing to check — an internal package with no public repository has no *Security
Practices* surface, and saying so is a finding. A group nobody looked at is `SKIP` and says why.

The criteria layer is a checklist, not a score. **Do not total it.** A single fired criterion —
a non-OSI licence, a name one character from a more popular package — carries the verdict to
**avoid** on its own, and no count of passing criteria offsets it.
