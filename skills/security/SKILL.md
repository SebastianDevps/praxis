---
name: security
description: Use when code touches auth, input, secrets, payments, or user data, or when asked about OWASP, injection, or vulnerabilities — security checklist and threat-modeling framing to run before merge.
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
- [ ] **Security Misconfiguration** — no debug mode in prod; CORS restricted to known origins; security headers present (CSP, HSTS, X-Frame-Options).
- [ ] **XSS** — output encoded; CSP in place; no `innerHTML` with untrusted data.
- [ ] **SSRF** — validate and allowlist URLs before outbound requests. Reject `localhost`, `169.254.*`, `10.*`.
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

## STRIDE (Threat Modeling Frame)

When reviewing a new feature: Spoofing, Tampering, Repudiation, Information Disclosure, Denial of Service, Elevation of Privilege. Walk each letter; note which apply; address before shipping.

> Curated from vibecode vc-security.
