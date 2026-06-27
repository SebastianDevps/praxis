---
name: design-system-clean
description: Use when building a clean, minimal SaaS, consumer app, or soft restrained UI — whitespace, soft shadows, rounded corners, one accent.
kind: skill
od:
  category: design-systems
  surface: web
  triggers:
    - clean design
    - minimal saas
    - consumer app
    - soft ui
    - restrained
---

> Curated from open-design design-systems.

## When to Use

SaaS products, consumer apps, productivity tools — anywhere legibility and trust matter more than expressiveness.

## Key Characteristics

- Whitespace as structure: sections breathe; nothing feels cramped.
- Soft shadows (`box-shadow: 0 1px 3px rgba(0,0,0,0.08)`) — never hard or dark.
- Consistent border-radius: `8–12px` on cards, `6–8px` on inputs and buttons.
- 1 accent color; gray family handles the rest.
- Typography: medium weights (500/600) for hierarchy; no display-size showmanship.
- Tooling: shadcn/ui (Radix primitives + copy-in Tailwind) is the natural component layer for this style — accessible neutral primitives you own, customized via CSS variables (`--background`, `--primary`, `--muted`, `--border`, `--radius`). Bring your own brand accent so it doesn't ship as generic neutral-gray.

## Key Tokens

```
Color: off-white bg, 1 accent, single gray scale
Shadow: 0 1px 3px / 0 4px 12px — 2 levels only
Radius: 8–12px cards, 6–8px interactive elements
Spacing: 4px base, 8/16/24/32/48/64px scale
Type: geometric or humanist sans; weights 400/500/600
```

## Tradeoff

Safe but forgettable without intentional brand moves. Pair with `anti-slop` to avoid shipping the generic neutral-SaaS look — off-typeface and off-accent choices make the difference.
