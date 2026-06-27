---
name: web-testing
description: Use when setting up or expanding tests for a web app with Playwright E2E, component, or visual-regression coverage — pyramid balance, a11y checks, and flakiness control.
kind: skill
od:
  category: testing
  surface: web
  craft:
    requires:
      - a11y-baseline
  triggers:
    - test
    - e2e
    - playwright
    - "visual regression"
    - "test coverage web"
---

## Pyramid Balance

- Many unit tests (pure logic, no DOM).
- Fewer integration tests (component + real dependencies, no browser).
- Few E2E tests (full browser, only critical user paths). Over-E2E-ing is a flakiness factory.

## Playwright

- E2E and component tests both run in Playwright. One runner, two scopes.
- Visual regression: `expect(page).toHaveScreenshot()`. Commit baseline snapshots; review diffs in CI.
- A11y: `@axe-core/playwright` — run `checkA11y` on every key page/component. Failing rule → fix before merge (see `a11y-baseline` craft).
- Core Web Vitals: measure LCP, CLS, INP in CI via `web-vitals` or Lighthouse CI. Set budget thresholds; fail the build when exceeded.

## Cross-browser Checklist

Run the critical-path suite on chromium + firefox + webkit. Don't run the full suite on all three — cost vs. signal ratio is poor.

## Flakiness Mitigation

- No `page.waitForTimeout(n)`. Wait on observable state: `waitForSelector`, `waitForResponse`, `waitForLoadState`.
- Isolate test data — each test owns its fixtures; no shared mutable state across tests.
- Retry at CI level (max 2× on failure), not in test code.

> Curated from vibecode vc-web-testing.
