---
name: creative-director
description: Use when setting design direction before building anything — concept, mood, references, and taste decisions; produces a direction brief, not code.
kind: skill
od:
  category: creative-direction
  triggers:
    - art direction
    - creative direction
    - mood
    - concept
    - design vision
---

> Curated from open-design creative-director.

## When to Use

Before touching code or tokens. Direction without implementation produces a brief; implementation without direction produces AI defaults.

## Output: Direction Brief

A short document (not code) covering:

1. **Concept** — one sentence: what is this product, what feeling should it produce.
2. **Mood** — 3 reference aesthetics (visual, not verbal): existing products, editorial sites, film stills, photography. "Like [X] meets [Y]" is valid.
3. **Taste decisions** — explicit choices on the `anti-slop` dials:
   - Which typeface family (not Inter unless intentional).
   - Accent color direction (warm/cool, saturated/muted, 1 accent only).
   - Motion level: 1–10 on the `frontend-design` motion dial.
   - Design system to use or approximate (shadcn / swiss / brutalist / bento / clean / custom).
4. **What to avoid** — name 2–3 specific things that would betray the concept.

## Anti-Pattern

Skipping direction and starting with implementation means every micro-decision (typeface, radius, shadow depth) is made in isolation. The result is internally inconsistent. Direction brief = coherence at scale.
