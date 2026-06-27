---
name: design-system-brutalist
description: Use when building a brutalist, raw, anti-design, or bold expressive interface — visible structure, system fonts, sharp edges, high contrast.
kind: skill
od:
  category: design-systems
  surface: web
  triggers:
    - brutalist
    - brutalism
    - raw design
    - bold expressive
    - anti-design
---

> Curated from open-design design-systems.

## When to Use

Bold or expressive brands that want to stand out from polished SaaS defaults. Developer tools, art/creative agencies, countercultural products.

## Key Characteristics

- Structure is visible: borders, outlines, and grid lines are design elements, not hidden scaffolding.
- High contrast: near-black on white, or strong color blocks (not gradients).
- System fonts (`system-ui`, `monospace`) used intentionally — not as a fallback.
- Sharp edges: `border-radius: 0` or 1–2px only.
- Interactions feel mechanical: hover state = color invert or thick border, not smooth shadow lift.

## Key Tokens

```
Color: high contrast pairs — black/white, or one strong brand color + white
Type: system-ui or monospace; large sizes; tabular figures
Border: 1–2px solid, used liberally
Radius: 0
Shadow: none, or hard offset (4px 4px 0 #000)
```

## Tradeoff

Polarising. Works when commitment is total — half-brutalist reads as broken. Requires a strong brand rationale.
