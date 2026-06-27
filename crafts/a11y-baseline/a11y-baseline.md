---
name: a11y-baseline
description: Semantic HTML, keyboard nav, ARIA roles, contrast 4.5:1 where applicable.
kind: craft
---

## Structure

- Use semantic elements first: `<nav>`, `<main>`, `<article>`, `<section>`, `<header>`, `<footer>`, `<button>`, `<a>`.
- ARIA roles only where native semantics fall short — don't add `role="button"` to a `<button>`.
- One `<main>` per page. Landmark regions must be labeled when multiple of the same kind exist (`aria-label` or `aria-labelledby`).

## Keyboard Navigation

- Every interactive element reachable and operable via keyboard alone.
- Tab order follows visual/logical reading order.
- Focus never trapped unless inside a modal (and escape closes it).
- Skip-to-main link on every page (visible on focus).

## Focus Styles

- Never `outline: none` without a custom visible replacement.
- Focus indicator must be visible at 3:1 contrast ratio against adjacent colors (WCAG 2.2).

## Color & Contrast

- Text contrast ≥ 4.5:1 against background (normal text); ≥ 3:1 for large text (≥ 18pt or 14pt bold).
- Don't convey meaning by color alone — pair with icon, label, or pattern.

## Images & Media

- Meaningful images: descriptive `alt` text.
- Decorative images: `alt=""`.
- Icons used as buttons: `aria-label` on the button, not the icon.
- Videos: captions for speech content; transcripts for audio-only.

## Forms

- Every input has a visible `<label>` or `aria-label`.
- Error messages linked to their field via `aria-describedby`.
- Required fields marked with `aria-required` or `required` (not color alone).

## Motion

- Respect `prefers-reduced-motion` — see the `motion-discipline` craft.
