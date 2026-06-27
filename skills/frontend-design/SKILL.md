---
name: frontend-design
description: Use whenever asked to build, replicate, or redesign a web page, site, landing page, dashboard, hero section, pricing page, app interface, or component — even without the word design — replicating from a screenshot or designing immersive from scratch.
kind: skill
od:
  mode: prototype
  surface: web
  category: frontend-design
  triggers:
    - frontend design
    - build ui
    - replicate design
    - landing page
    - dashboard
  craft:
    requires:
      - anti-slop
      - a11y-baseline
      - motion-discipline
      - orchestration
---

## Workflow by Input

| Input | Mode | Approach |
|---|---|---|
| Screenshot | Replicate | Match layout, spacing, color, and **the source's actual font** (identify it — never substitute Inter). Fidelity wins; anti-slop only fills gaps the source leaves open. |
| Video | Replicate + motion | Replicate static layout first, then layer animations per `motion-discipline`. |
| 3D / WebGL reference | Immersive | Use Three.js. Scene setup → lighting → geometry → responsive canvas → reduced-motion fallback. |
| "Quick UI" | Rapid | Single file, minimal deps, functional over polished. |
| Complex feature | Full immersive | Design tokens → component tree → interaction states → responsive → a11y audit. |
| Existing UI to improve | Redesign audit | Run `design-review` first, then implement fixes as atomic diffs. |
| No reference | Design thinking | Define constraints (audience, density, tone) → sketch → implement. |

## Design Dials

Set at session start; user can override at any point.

| Dial | Low (1–3) | High (8–10) | Default |
|---|---|---|---|
| `density` | Airy — generous spacing, large type, few elements per screen | Dense — compact rows, small type, information-rich | 5 |
| `boldness` | Quiet — low contrast hierarchy, subtle weights, restrained accents | Expressive — strong type scale, high contrast, prominent accent | 5 |
| `motion` | Minimal — instant transitions, no entrance animations | Rich — choreographed entrances, scroll-linked reveals, staggered lists | 5 |

If not set, assume defaults. Ask once if the task is ambiguous — then proceed.

## Anti-Slop Reference

Always cross-check against the `anti-slop` craft before delivering:

- Typography: **never Inter/Roboto** (replicate → match the source font; from-scratch → deliberate non-default); weight 500/600 for hierarchy.
- Color: no AI purple/blue gradient hero; off-black `#0a0a0a`, off-white `#fafafa`.
- Layout: no 3-column equal-card row; vary border-radius; `min-h-[100dvh]` not `h-screen`.
- Content: no round fake numbers; no startup-slop names; no AI-cliché copy.

## Output Contract

- Emit working code, not pseudocode.
- One component per file unless explicitly bundled.
- No placeholder copy in the final output.

## Ship Gate (run before delivering ANY web output — even if unasked)

1. **Font** — confirm it is NOT Inter/Roboto/Open Sans. Replication → matches the source's real font; from-scratch → a deliberate non-default. If you used Inter, stop and change it.
2. **Baseline pass** — invoke `baseline-status` on EVERY non-trivial modern CSS/JS feature used (`text-wrap`, `:has()`, container queries, `backdrop-filter`, `color-mix()`, `margin-inline`, View Transitions, scroll-driven animations…) and include a short Baseline table in the deliverable: feature → status → fallback. Not optional.
3. **a11y + motion** — semantic landmarks, `:focus-visible`, contrast ≥ 4.5:1; `prefers-reduced-motion` on every animation.
