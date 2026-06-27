# Eval — From-scratch dashboard (does the taste moat hold without a reference?)

> Date: 2026-06-25 · Under test: `frontend-design` Ship Gate + crafts (`anti-slop`, `a11y-baseline`, `motion-discipline`, `baseline-status`, `data-visualization`) · Method: an agent given ONLY the Praxis design content builds a from-scratch SaaS dashboard; output measured independently (not self-reported).

## What was tested
Run B proved the moat activates + holds on a *replica*. This proves it on a **from-scratch** build (no reference image to lean on) — the harder case, where a generic agent converges on the AI default (Inter, purple, 3 equal cards, zero a11y). Task: "analytics dashboard for a small SaaS, single HTML file," following the Ship Gate.

## Measured output (independent, not the agent's claim)
File: `eval-dashboard.html` (584 lines, self-contained). Product: "Ferndesk".

| Signal | Measured | Verdict |
|---|---|---|
| Font | **Space Grotesk** + IBM Plex Mono (tabular) — 0 Inter / 0 Roboto / 0 Open Sans | ✅ |
| `aria-` | **30** · `role=` 2 · `<caption>` + `scope=col` ×6 | ✅ |
| `focus-visible` | 2 (custom ring) + visible-on-focus skip link | ✅ |
| `prefers-reduced-motion` | 1 (zeroes all motion, kills the live-pulse loop) | ✅ |
| Baseline awareness | `min-height:100dvh` with `100vh` declared first as fallback; `text-wrap:balance` / `margin-inline` degrade gracefully; deliberately avoided `:has()`/`color-mix()`/container-queries/`backdrop-filter` | ✅ |
| Accent | amber `#e8b04b` ×5 — NOT the AI purple/blue gradient | ✅ |
| Anti-slop | off-black `#14130f` / off-white `#f4f1ea`; asymmetric grid (`1.4fr 1fr 1fr`, not 3 equal cards); varied radius; organic numbers (3,291 · 91.3% · 1h 47m); culturally varied names; non-slop product name | ✅ |
| Data-viz | line for time series, gridlines lighter than data, direct end-label instead of a legend, units stated | ✅ |

## Verdict
**PASS** — measured, not claimed. From a single one-line brief and only the Praxis design content, the output honors every Ship Gate criterion. A generic agent on the same prompt ships Inter + purple + 0 aria (see the `activation` eval Run A). The taste moat holds from-scratch.

## The signal worth keeping (honest)
The agent's first palette choice **failed contrast** (`--ink-faint` at 4.44:1) and was only caught by the Ship Gate's explicit contrast check, then fixed to 5.24:1. This is the eval loop working as designed: the discipline caught a real defect the model would otherwise have shipped. It also confirms the contrast check must stay a hard step, not a vibe.

## Pending
- Eval #4 (vibe-coder ambiguous prompt → clarify-before-build UX) to prove the UX moat.
- Re-run with a live primed session (not a content-following subagent) to confirm activation + this quality compound end-to-end.
