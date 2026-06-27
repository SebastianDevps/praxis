---
name: motion-discipline
description: Motion serves meaning. Respect prefers-reduced-motion. No decorative animation.
kind: craft
---

## Core Rule

Every animation must answer: "what does this motion communicate?" If the answer is "nothing, it just looks nice" — cut it.

## Timing

- UI micro-interactions (hover, toggle, focus): 140–180ms.
- State transitions (panel open/close, tab switch): 180–220ms.
- Larger reveals (page entry, modal): 250–350ms — never block reading.
- No transition exceeds 400ms unless driven by scroll position.

## Properties

- Animate `transform` and `opacity` only.
- Never animate layout properties: `top`, `left`, `right`, `bottom`, `width`, `height`, `margin`, `padding`. They force reflow on every frame.
- `will-change: transform` only on elements that actually animate and only while they animate; remove after.

## Consistency

- One motion language per product: pick an easing curve family and stick to it (e.g. `ease-out` for entrances, `ease-in-out` for transitions).
- Duration scale should have ≤ 3 steps (fast / base / slow).
- Stagger only for small groups (≤ 6 items); larger groups overwhelm without adding meaning.

## Reduced Motion

- `@media (prefers-reduced-motion: reduce)` fallback required for:
  - Any animation that plays automatically.
  - Any scroll-linked motion.
  - Any looping animation.
- Fallback: instant state change or simple fade (≤ 150ms opacity).

## Tooling & Application

- Motion comes AFTER the UI is built and functional — animating a broken layout makes both worse.
- CSS transitions for single-property feedback; GSAP for sequences needing timeline coordination (entrance choreography, multi-step reveals).
- Scroll reveals: `IntersectionObserver` with a `rootMargin` buffer so content never pops in mid-read.

## Hard Stops

- No endless decorative loops — looping must serve a functional state (loading, streaming, live indicator).
- No custom cursors or particle effects.
- No parallax on content-bearing elements (background parallax with reduced-motion fallback is acceptable).
