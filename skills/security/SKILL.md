---
name: security
description: Use when code touches auth, input, secrets, payments, or user data, or when asked about OWASP, injection, or vulnerabilities — security checklist and threat-modeling framing to run before merge. NOT generic code review (that is the `reviewer` agent) — this is the threat surface only.
kind: skill
od:
  category: security
  triggers:
    - security
    - owasp
    - vulnerability
    - secrets
    - auth
    - injection
---

## Decision Rule

Any path that touches auth, payments, or PII → review against this checklist before merge, no exceptions.

## OWASP Top-10 Quick Checklist

- [ ] **Injection** — all DB/OS/LDAP input goes through parameterized queries or an ORM. Zero string concatenation into queries.
- [ ] **Broken Auth** — tokens short-lived; refresh rotation on every use; revocation on logout.
- [ ] **Sensitive Data** — PII encrypted at rest; never logged; stripped from error messages.
- [ ] **XXE / Insecure Deserialization** — disable external entity resolution in XML parsers; validate before deserializing.
- [ ] **Broken Access Control** — every endpoint checks authorization, not just authentication. Test ownership boundary (IDOR: can user A fetch user B's resource?).
- [ ] **Cache keys** — every input that changes the response is in the key: tenant, locale, permissions, feature flags. A key that omits the viewer is how one user's data gets served to another, and it ships disguised as a performance win. Same for memoized responses.
- [ ] **Security Misconfiguration** — no debug mode in prod; CORS restricted to known origins; security headers present (CSP, HSTS, X-Frame-Options).
- [ ] **XSS** — output encoded; CSP in place; no `innerHTML` with untrusted data.
- [ ] **SSRF** — allowlist the scheme and host, then resolve **all** DNS records and reject unless every resolved address is **publicly routable**. Reject explicitly: loopback, unspecified (`0.0.0.0`, `[::]`), link-local (`169.254.0.0/16` — the cloud metadata endpoint lives here), private (`10/8`, `172.16/12`, `192.168/16`), CGNAT (`100.64/10`), and IPv6 unique-local (`fc00::/7`). **Do not phrase the test as "is it unicast".** Go's `net.IP.IsGlobalUnicast()` returns true for RFC 1918 and says so in its own doc comment, so that predicate lets `10.0.0.5` straight through. A denylist of `localhost` / `10.*` fails the other way, missing decimal-encoded IPs and every IPv6 form. Set `redirect: 'error'`. Honest caveat: `fetch` re-resolves at connect time, so a short-TTL DNS rebind survives a check-then-fetch — pin the resolved IP, or front the call with a filtering proxy.
- [ ] **Vulnerable Components** — the ecosystem's audit command (`npm audit`, `pip-audit`, `govulncheck`, …) in CI; fail on high/critical.
- [ ] **Logging & Monitoring** — auth failures and access-control failures are logged; no secrets or PII in logs.

## Secrets — Never Commit

Patterns to block at pre-commit (or grep before review):
- API keys, bearer tokens, `sk-`, `ghp_`, `xoxb-` prefixes.
- Any `.env` file with real values.
- Private keys (`-----BEGIN`).

Use environment variables or a secrets manager. Rotate immediately if committed.

## Input Validation

Validate at the boundary (controller/handler), not deep in the service layer. Reject unknown fields (`whitelist` strategy); never trust shape, type, or range from external input.

## When the Code Calls a Model

A chatbot, summarizer, agent, or RAG pipeline inherits a surface the checklist above does not cover.

- **The system prompt is not a security boundary.** Anything in the context window — a user message, a fetched page, a PDF — can carry instructions. Enforce permissions in code.
- **Model output is untrusted input.** Never into `eval`, SQL, a shell, `innerHTML`, or a file path. Validate and encode it exactly as you would raw user input.
- **Bound consumption.** Cap tokens, request rate, and loop/recursion depth, so a crafted input cannot run up cost or hang the process.
- **Partition RAG embeddings per tenant.** The vector store is a trust boundary: one user must not retrieve another's documents.

## STRIDE (Threat Modeling Frame)

When reviewing a new feature: Spoofing, Tampering, Repudiation, Information Disclosure, Denial of Service, Elevation of Privilege. Walk each letter; note which apply; address before shipping.

> Curated from vibecode vc-security.
