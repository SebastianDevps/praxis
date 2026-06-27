---
name: baseline-status
description: Use whenever you emit modern CSS/JS (:has(), container queries, backdrop-filter, color-mix(), View Transitions) or ask is this feature safe / can I use it — checks web platform Baseline status (Widely, Newly, Limited) and picks a fallback.
kind: skill
od:
  surface: web
  category: web-platform
  triggers:
    - baseline
    - browser support
    - can i use
    - is this feature safe
    - modern css
    - frontend output
---

## When to Run (proactively)

Run this WHENEVER you emit web code with non-trivial modern CSS/JS — not only when the user says "baseline". Any frontend deliverable MUST include a short Baseline table: each modern feature used → status (Widely / Newly / Limited) → fallback decision. If you wrote `text-wrap`, `:has()`, container queries, `backdrop-filter`, `color-mix()`, `margin-inline`, View Transitions, or scroll-driven animations, this skill applies — surface the table without being asked.

## What Baseline Means

| Status | Meaning | When to use |
|---|---|---|
| **Widely available** | Supported in all major browsers for 2.5+ years | Use freely, no fallback needed |
| **Newly available** | Recently interoperable (all majors, but <2.5 years) | Use with graceful fallback or progressive enhancement |
| **Limited availability** | Not yet interoperable across all majors | Polyfill, feature-detect, or avoid |

Major browsers: Chrome, Edge, Firefox, Safari (desktop + mobile).

## Decision Rule

1. Look up the feature on [web.dev/baseline](https://web.dev/baseline) or [MDN Baseline](https://developer.mozilla.org/en-US/docs/Glossary/Baseline/Compatibility).
2. Apply:
   - **Widely** → use it.
   - **Newly** → use it with a fallback (e.g. `@supports`, feature detection, or CSS fallback value).
   - **Limited** → use a polyfill, pick an alternative, or explicitly accept the support gap and document it.

## Fallback Patterns

- CSS: provide a fallback value before the modern one; use `@supports` for layout differences.
- JS: feature-detect with `if ('featureName' in target)` before calling.
- Web APIs: check MDN compat table; wrap in try/catch or `if (typeof X !== 'undefined')`.

## Data Source

Web Platform Baseline — governed by the W3C WebDX Community Group. Data published at `web-platform-dx/web-features` on GitHub and surfaced on web.dev and MDN.

## Notes

- This skill provides guidance only — no bundled CLI or automated check.
- When in doubt, treat an unknown feature as Limited.
- CSS Container Queries, `has()`, `subgrid`, View Transitions, and Scroll-driven Animations are common "Newly available" features as of 2024–2025 — verify before assuming.
