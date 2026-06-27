# Eval — Plutolio Landing Replica (design agent)

> Date: 2026-06-24 · Skill under test: `frontend-design` + crafts (`anti-slop`, `a11y-baseline`, `motion-discipline`) + `baseline-status` · Method: quality-by-measurement (find gap → harden skill → re-test), ponytail-style.

## What was tested
The `praxis:design` agent replicating a real fintech landing page (Plutolio — investment tracking, AU) from a screenshot. Pass criteria: (1) routes to replicate, (2) fidelity to source incl. **font**, (3) Baseline notes + a11y + motion, (4) honest 3D handling.

## Run 1 — baseline (contaminated env + soft rules)
Ran inside the agent007 monorepo (`PluginClaude/`), so the session inherited agent007's `CLAUDE.md` (memory-consolidate + routing ceremony + read foreign `sdd-design.md`) — a confound.

**Result:** strong on structure + a11y, two real gaps.
- ✅ Fidelity (structure/data/palette): all 13 sections, correct figures, off-black `#0d0d0d`, green accent.
- ✅ a11y: 76 `aria-`, skip link, 4 `:focus-visible`, semantic landmarks.
- ✅ motion: `prefers-reduced-motion` ×2, transform/opacity.
- ✅ 3D: SVG approximations (honest).
- ❌ **Font = `Inter`** — the exact font anti-slop bans, AND not faithful to the source's geometric sans. Fell to the AI default.
- ❌ **Baseline: absent** — `0` baseline notes, `0` `@supports`, despite using `text-wrap`, `backdrop-filter`, `clamp()`, `margin-inline`. `baseline-status` never fired.

## Diagnosis
The rules existed but were **soft** — `anti-slop`: "avoid Inter *as first choice*"; `frontend-design`: "apply anti-slop *silently*" / "confirm Baseline for features *not clearly Widely available*". Soft guidance gets dropped under load (a 13-section replica) and noise (the agent007 ceremony).

## Fix (commit `f8427ee` — "harden anti-slop font rule + baseline ship-gate")
- `anti-slop`: **"Never default to Inter/Roboto/Open Sans"** + replicate clause ("identify and MATCH the source's actual font; never fall back to Inter").
- `frontend-design`: clarified the Replicate row (match source font, never substitute Inter) + added a **Ship Gate** (run before any web output): font check + **mandatory Baseline table** (feature → status → fallback) + a11y/motion check.
- `baseline-status`: made proactive ("run WHENEVER emitting non-trivial modern CSS/JS, not only when asked; surface a Baseline table unbidden").

## Run 2 — clean re-test (hardened rules, from-scratch SaaS pricing)
Clean run following the updated files. **Result: PASS.**
- ✅ Font = **Outfit** (explicitly "not Inter"), tied to the hardened rule.
- ✅ **Baseline table present + real**: `clamp()` (Widely), `text-wrap: balance/pretty` (Newly, interop dates + graceful degradation), logical properties (Widely), `:focus-visible` (Widely) — each with a fallback decision.
- ✅ a11y (landmarks, aria per card, sr-only, focus-visible, contrast 19:1) + motion (160ms, transform-only, reduced-motion gate).
- ✅ anti-slop extras: off-black/off-white, non-purple accent, varied border-radius.
- Agent self-reported: "Ship Gate verdict: PASS."

## Verdict
Eval loop closed: **soft rules → hard + procedural rules** survive load/noise. Quality improved by measurement, with NO enforcement (the Ship Gate is convention the agent follows, not a hook).

## Pending
- At-scale confirmation: re-run the FULL Plutolio replica in a **clean dir** (no agent007) with the screenshot + the refreshed plugin, to confirm the Ship Gate holds across 13 sections under replication load.
