# Eval — Activation (does the moat fire on a vague prompt?)

> Date: 2026-06-25 · Under test: the SessionStart router hook + `Use when` descriptions · Method: measured before/after on real vague-prompt web builds.

## What was tested
Whether Praxis's design moat (frontend-design + anti-slop/a11y/baseline crafts) **activates autonomously** from a two-line vague prompt ("hazme un dashboard como esta / profesional y moderna"), with no explicit skill invocation — on a host whose global config pulls toward a generic code skill (karpathy).

## Run A — BEFORE the activation fix (passive Markdown, `od.triggers` only)
Output `dashboard.html`. The agent loaded the global code skill and went straight to generic HTML. `frontend-design` never fired.

| Signal | Result |
|---|---|
| Font | **Inter ×14** (the exact AI fingerprint anti-slop bans) |
| `aria-` | **0** |
| `focus-visible` | 0 |
| `prefers-reduced-motion` | 0 |
| Baseline / `@supports` | 0 |

Vanilla output. Praxis contributed nothing — it was never activated.

## Diagnosis
Claude Code routes skills by `description` ONLY; `od.triggers` are ignored. And nothing primed the main session, so the host's own always-on rule won the void. Passive Markdown does not activate (measured activation rate for plain descriptions ≈37% in independent studies).

## Fix (commits f246f16, 58bff04, 0ed820d)
1. Swept all skill descriptions to the `Use when <triggers> — <what>` convention — the trigger surface now lives in the description (the only router).
2. Added a SessionStart hook injecting the thin `using-praxis` router — primes every session toward the loop + skill routing. **Primes, never blocks** (no enforcement).

## Run B — AFTER the fix (clean session, same vague prompt)
Output `open-design.html`. The log showed `Skill(praxis:frontend-design)` firing **on its own**, and the crafts applied unbidden.

| Signal | Result |
|---|---|
| Font | **DM Sans + Playfair** (explicitly not Inter) ✅ |
| `aria-` | **28** ✅ |
| `focus-visible` | 1 ✅ |
| `prefers-reduced-motion` | 2 ✅ |
| Baseline comments | 8 ✅ |

## Verdict
**PASS.** The moat fires autonomously on a vague prompt. The differentiation (taste applied without being asked) is now activation-backed, not just authored. Robustness comes from the description-router + priming hook, proven by measured before/after.

## Pending
- This proves activation + taste on a replica. Eval #1 (from-scratch dashboard at scale) and #4 (vibe-coder ambiguous prompt) extend the proof to from-scratch and to the clarify-UX.
