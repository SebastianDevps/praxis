---
name: color-expert
description: Use when building a color palette, choosing an accent, fixing contrast, or adding dark mode — produces semantic, contrast-safe color tokens with tinted shadows.
kind: skill
od:
  category: creative-direction
  triggers:
    - color
    - palette
    - contrast
    - dark mode
    - color scheme
  craft:
    requires:
      - anti-slop
      - a11y-baseline
---

> Curated from open-design color-expert.

## Palette Structure

- **1 accent max.** A second accent is a brand problem, not a color problem — solve it upstream.
- **1 gray family.** Never mix warm and cool grays on the same surface; pick one and derive the full scale.
- **Semantic tokens:** `success` / `warning` / `error` mapped to green / amber / red — desaturate them for dark mode.
- **Base:** off-black `#0a0a0a`, off-white `#fafafa`. Pure black/white read as printed — avoid.

## Contrast

- Text on background: ≥ 4.5:1 (WCAG AA). Large display text (≥ 24px bold): ≥ 3:1.
- Check interactive states (hover, focus) independently — a passing default can fail at hover.

## Shadows

Tint shadows to the background hue. `rgba(0,0,0,0.15)` on a warm-beige surface looks foreign. Sample the bg hue and add it to the shadow's color channel.

## Dark Mode

- Tint, don't invert. Dark mode is not `hsl(H, S, 100% - L)`.
- Darken backgrounds in steps: surface → card → overlay (3 levels max).
- Reduce saturation of accent colors by 10–20% — saturated colors vibrate on dark backgrounds.
- Semantic colors (success/warning/error): desaturate and lighten slightly so they don't glow.
