# Teardown with no repository access

Loaded when the target's source cannot be read: a closed competitor, a private repo, a SaaS product,
a plugin distributed as a build artifact. The dossier still gets written — it just gets much shorter,
and the shortness is the finding.

## The rule that does not relax

`path:line` is unavailable, so every claim carries a **URL plus a retrieval date** instead. The
invariant is unchanged: a reader must be able to go check. A claim with neither a `path:line` nor a
URL is not a claim, it is a guess, and it does not enter the dossier.

## Surfaces, and what each one can support

Ordered by how close it sits to the running system. Read down the list until the section is answered
or the list runs out.

| surface | supports | does not support |
|---|---|---|
| **Public API reference / OpenAPI spec** | C4 Level 2 containers, arc42 §3 Context and Scope, request entry points | anything about internal structure |
| **Client SDKs, published packages** | dependencies, language, supported platforms, versioning discipline | server-side architecture |
| **Product and developer docs** | capabilities, arc42 §3, §7 Deployment (regions, self-host options) | §5 Building Block, §6 Runtime |
| **Status page and incident history** | §7 Deployment, §11 Risks — observed failure modes, with dates | root causes, unless the postmortem states them |
| **Pricing and plan limits** | quotas, tenancy model hints, scale boundaries the vendor commits to | actual capacity |
| **Job postings** | stack names, team shape | how any of it is assembled — a posting lists what they want to hire, not what runs |
| **Changelog / release notes** | release cadence, breaking-change discipline, §11 debt the vendor admits to | anything unreleased |
| **Conference talks, engineering blog** | §4 Solution Strategy and §9 Decisions **as claimed** — the only surface that reaches intent | verification that the claim is still true |

## Grading a claim that came from the vendor

Everything on that list is published by the party being assessed. Mark each claim with its distance
from evidence:

- **observed** — you exercised it yourself (called the API, ran the client, hit the rate limit).
- **documented** — the vendor states it in reference material they maintain against their own product.
- **claimed** — the vendor says it in marketing, a talk, or a blog post. It may be aspirational, may
  be stale, may describe one service and imply the whole.

A dossier built entirely from **claimed** material says so at the top. That sentence is the most
useful line in it.

## What is always `SKIP` here

- **arc42 §5 Building Block View** and **§6 Runtime View** below the container level. Component
  boundaries are not observable from outside; a plausible internal diagram is the exact failure this
  skill exists to prevent.
- **C4 Level 3 Component** and **Level 4 Code**. Level 1 System Context and Level 2 Container are
  often reachable from an API surface; 3 and 4 are not.
- **§8 Crosscutting Concepts**, unless the vendor documents them (auth model and rate limiting
  frequently are; error handling, caching and observability rarely are).

Each one gets the same reason written next to it: *no source access — not observable from the public
surface*.

## Job postings deserve one warning of their own

They are the most over-read surface in competitive teardowns. A posting for a Kafka engineer is
evidence that someone wants Kafka in the future, on one team, possibly for one feature. It is not
evidence that Kafka is in the architecture. Cite postings for **vocabulary** — the names of things
the organization talks about — and never for topology.
