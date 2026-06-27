---
name: design-review
description: Use when asked to review, audit, critique, polish, or redesign an existing page, component, or interface — checks against anti-slop, a11y-baseline, and motion-discipline crafts, then fixes with atomic changes.
kind: skill
od:
  category: creative-direction
  triggers:
    - design review
    - visual audit
    - before after
    - pre-launch design check
---

## When to Use

- Pre-launch check on a completed UI.
- "Something feels off" — no specific bug, just a vague quality concern.
- After replicating a design, before handing off.

## Audit Steps

1. **Capture before state.** Screenshot or describe the current UI. This is the baseline for the after comparison.
2. **Anti-slop sweep** (per `anti-slop` craft):
   - Typography: default font choice, weight distribution, heading wrap.
   - Color: gradient fingerprints, pure black/white, mixed gray families, unshadowed colored backgrounds.
   - Layout: 3-column equal-card row, uniform border-radius, `h-screen` usage, unconstrained max-width.
   - Content: fake round numbers, startup-slop names, AI-cliché copy.
3. **A11y sweep** (per `a11y-baseline` craft):
   - Contrast: text ≥ 4.5:1, large text ≥ 3:1, focus indicator ≥ 3:1.
   - Keyboard: every interactive element reachable and operable.
   - Semantics: correct landmark structure, ARIA only where native falls short.
   - Forms: every input labeled, errors linked via `aria-describedby`.
4. **Motion sweep** (per `motion-discipline` craft):
   - Any animation without `prefers-reduced-motion` fallback.
   - Transitions > 400ms.
   - Layout property animations (`width`, `height`, `top`, etc.).
   - Decorative loops.
5. **Prioritize findings.** Block = must fix before ship. Warn = should fix. Note = low-impact observation.
6. **Apply fixes atomically.** One finding → one diff. Do not bundle unrelated changes.
7. **Capture after state.** Screenshot or describe the changed UI. Call out each change explicitly.

## Output Format

```
## Design Review

### Findings
- [BLOCK] Anti-slop / Color: hero uses AI blue gradient (#4F46E5 → #7C3AED) — replace with brand color or solid.
- [WARN]  A11y / Contrast: "Secondary" button text contrast 3.8:1 — below 4.5:1 threshold.
- [NOTE]  Layout: all cards use identical `rounded-lg` — vary to `rounded-md` / `rounded-2xl` for rhythm.

### Fixes applied
1. Replaced gradient with `bg-neutral-900`.
2. Darkened button text from `text-neutral-400` to `text-neutral-200` (contrast now 5.1:1).

### Before / After
[before screenshot or description]
[after screenshot or description]
```

## Notes

- Do not invent findings. Only flag real violations of the three crafts.
- If zero findings: report "Clean — no violations found." and stop.
- Fixing a BLOCK is not optional. Fixing a WARN is recommended. A NOTE is informational only.
