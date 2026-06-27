---
name: brand
description: Use when extracting a brand from a logo or screenshots, defining one from scratch, or asked for brand guidelines or brand tokens — outputs design tokens for type, color, spacing, and voice.
kind: skill
od:
  category: creative-direction
  triggers:
    - brand
    - brand guidelines
    - extract brand
    - brand tokens
---

> Curated from open-design brand-extract and brand-guidelines.

## Two Modes

**Extract** — given logo, screenshots, or existing materials: read the type, color, spacing, and voice that are already there. Output tokens that capture what is, not what you'd prefer.

**Define** — no references exist: derive tokens from the product's audience, density, and tone. Use the `creative-director` skill first to set direction before tokenizing.

## Token Output

| Token group | What to define |
|---|---|
| Type scale | Font family, sizes (5–7 steps), weights, line-heights |
| Color | Brand accent(s), gray family, semantic tokens (success/warn/error), bg/surface |
| Spacing | Base unit (4px or 8px), scale multipliers |
| Radius | 1–2 values; consistency matters more than the value itself |
| Voice/tone | 3–5 adjectives that describe how the brand writes (e.g. "direct, warm, plainspoken") |

## Anti-Slop Check

Extracted or defined brand tokens must not land on the AI defaults: Inter/Roboto typeface, blue/purple accent, `#000`/`#fff` base, "Elevate your workflow" copy voice. If the source material uses these, note it — don't silently carry them forward.
