---
name: design-system-bento
description: Use when building a bento grid, modular tile layout, feature showcase, or card grid — varied tile sizes for feature sections and dashboards.
kind: skill
od:
  category: design-systems
  surface: web
  triggers:
    - bento
    - bento grid
    - modular tiles
    - feature showcase
    - card grid
---

> Curated from open-design design-systems.

## When to Use

Feature showcase sections, marketing pages with multiple product highlights, dashboards where density and visual variety help scanning.

## Key Characteristics

- CSS Grid with explicitly sized tiles: wide, narrow, tall, short — mixing sizes is the point.
- Each tile is self-contained: icon or media, heading, 1–2 lines of copy. No tile requires reading another.
- Consistent gap between all tiles; consistent padding within.
- Subtle card differentiation: border, light bg tint, or shadow — not all three.

## Layout Pattern

```css
display: grid;
grid-template-columns: repeat(4, 1fr); /* or auto-fit with minmax */
gap: 1rem;
/* Tiles use: grid-column: span 2; grid-row: span 2; etc. */
```

## Tradeoff

Bento grids are visually popular; overuse makes them invisible. The grid only works when tile sizes map to content importance — don't size tiles randomly.
