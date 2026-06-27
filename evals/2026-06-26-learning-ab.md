# Eval — Does per-project memory change behavior? (A/B, 3 rounds)

> Date: 2026-06-26 · Under test: Layer-1 per-project memory (the retrieval guarantee) · Method: same task run twice — memory OFF (A) vs the project's learned memory injected (B, exactly what the SessionStart hook delivers) — measured on outcome AND efficiency. This is the I5 measurement the design demanded.

## Setup
Each round: identical task to two fresh agents. A gets only the task. B gets the task + a `## Project memory` block (the content the hook injects from `.praxis/memory/index.md`). Measure whether B's behavior differs, and how.

## Results

| Round | Knowledge type | Task | A (no memory) | B (with memory) | Outcome | Efficiency |
|---|---|---|---|---|---|---|
| 1 | **Derivable fact** | Compute Claude turn cost (5 token counters, cache 1h/5m split) | $0.4849 ✓ — but **re-derived it from API docs** (1 tool call, ~316k tokens, 23s) | $0.4849 ✓ — applied memory (0 tools, ~27k tokens, 14s) | **tie** | **B ~12× fewer tokens** |
| 2 | **Derivable design choice** | Go type to store cost | `CostMicroUSD int64` (µUSD) — derived independently | `CostMicroUSD int64` (µUSD) | **tie** | tie |
| 3 | **Arbitrary project convention** | Name + source of the per-dev identity field | `DeveloperEmail` from **`git config`** — a sensible default, but the source the project explicitly REJECTED | `EngineerHandle` from **`identity.json`** — the project convention | **B wins — A diverged** | tie |

### Round 3 detail (the decisive one)
A even reasoned that git config is *"user-settable, tamper-risk"* — the exact reason the project rejected it — yet chose it anyway, because it had no memory of the project's decision. It had the right instinct but lacked the decision. Memory supplied it. B applied the convention exactly (`EngineerHandle` ← `identity.json.handle`).

## Verdict — what per-project memory measurably buys (and what it doesn't)
- **It does NOT make a capable agent "smarter."** For *derivable* facts/choices (rounds 1–2), a capable model reaches the sound answer on its own — memory doesn't change the outcome.
- **It DOES buy three measured things:**
  1. **Efficiency** — round 1: 12× fewer tokens, no re-derivation of what the project already knows. Compounds across a team × many sessions.
  2. **Reliability under load** — A only got round 1 right because it bothered to research; a rushed/offline agent does `input+output` and is 34× wrong. Memory guarantees the right answer.
  3. **Convention fidelity + team consistency** — round 3: for *genuinely arbitrary* project decisions (naming, source, with no derivable right answer), memory CHANGES the outcome. The agent can't guess the project's choice; memory pins it, and every dev gets the same one.

## Implication for the product
Layer 1's value is efficiency + arbitrary-decision fidelity + consistency — NOT raw intelligence. This sharpens Layer 2's value-prop: cross-project/team aggregation matters most for **consistency at scale** and **not re-deriving across the team**, which is exactly where the per-project files alone fall short.

## Honest caveat
3 rounds, hand-constructed tasks. The retrieval path is proven (the hook injects the memory; B demonstrably acts on it). A real per-project regression set, run repeatedly during the "test a good while" phase, is the next fidelity step.
