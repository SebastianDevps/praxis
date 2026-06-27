---
name: anti-slop
description: Avoid generic AI design fingerprints — overused defaults, not absolute bans.
kind: craft
---

## Typography

- **Never default to Inter/Roboto/Open Sans** — they are THE AI fingerprint. From-scratch: choose Geist, Outfit, Satoshi, Cabinet Grotesk, etc. Replicating a reference: identify and MATCH the source's actual font; if unsure, pick the closest non-Inter alternative — never fall back to Inter.
- Use weights 500/600 for hierarchy; 400 body, 700+ only for display.
- `text-wrap: balance` on headings; `text-wrap: pretty` on body paragraphs.

## Color

- The #1 fingerprint: AI purple/blue gradient hero. Avoid it unless the brand demands it.
- Off-black `#0a0a0a` not pure `#000`; off-white `#fafafa` not pure `#fff`.
- Max 1 accent color. One gray family — don't mix warm and cool grays in the same surface.
- Tint shadows to the background hue (never pure black shadows on colored backgrounds).
- Add subtle noise/grain texture over flat backgrounds to break the plastic look.

## Layout

- Avoid the 3-column equal-card feature row — use zig-zag, asymmetric, or masonry instead.
- `min-h-[100dvh]` not `h-screen` (mobile viewport units).
- CSS Grid over flexbox + `calc()` hacks for 2D layouts.
- Constrain max-width ~1200–1440px; don't let content span full ultra-wide.
- Vary border-radius — mixing `rounded-md` and `rounded-2xl` adds rhythm; uniform radius flattens.

## Content

- No "John Doe" / "Jane Smith" — use culturally varied names.
- No round fake numbers: `99.99%` and `$100.00` read as fake. Use organic figures like `47.2%`, `$99`.
- No startup-slop names: Acme, Nexus, Synergy, Apex, Nova.
- No AI clichés in copy: Elevate, Seamless, Unleash, Delve, Tapestry, Game-changer, Empower, Transform.
