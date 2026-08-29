---
name: agentic-lifecycle
description: Use when planning substantial or multi-phase work to run agents almost autonomously — the spec-driven doctrine: decision → verifiable contract → task files with status → auto-loop → review → done, with eval-driven verification at each gate. NOT the phase mechanics (that is `spec-lifecycle`), NOT the loop runner (that is `autonomous-loop`) — this is the doctrine above both.
kind: skill
od:
  category: workflow
  triggers:
    - agentic lifecycle
    - spec-driven doctrine
    - decision record
    - verifiable contract
    - autonomy verifiability
    - eval-driven
    - review gate
    - run agents autonomously
---

# Agentic Lifecycle — the doctrine

> Doctrinal umbrella. To EXECUTE each stage, use the existing skills; this one gives the frame and the "why".

## The rule that governs everything

An agent can run alone exactly as far as the contract is verifiable. Autonomy does not come from a
better prompt — it comes from having planned so well that "done" is checkable by a machine. Where
"done" is not verifiable, a human gate goes in. No exception.

## The cycle, and who runs each part

The phases a task passes through, the states it can be in, and the one ledger they are written to
are defined once in **`docs/task-model.md`**. This skill does not restate them — it used to, in a
seven-stage table that disagreed with three other skills about both the vocabulary and the
filename.

One ledger — `PROGRESS.md` — read and written by every stage below.

| you need | go to |
|---|---|
| break work into tasks, write the ledger | `writing-plans` |
| execute it, one subagent per task, review between | `subagent-driven-development` |
| execute it unattended, one task per iteration | `autonomous-loop`, `/praxis:loop` |
| track a change across stages | `spec-lifecycle` |
| the shape of a task | `docs/task-model.md` |

This skill adds what none of those carry: the thesis, the eval-driven pillar, and the evidence.

**The one gate that is not delegable.** A verifiable contract — the feature list where every item
names its own check and every check starts failing — is what makes "done" decidable by a machine.
`assets/spec.template.json` is that contract; `spec-lifecycle`'s `templates/spec.md` is the
human-readable companion. Same intent, two surfaces: prose for people, JSON for the loop. **If the
contract is wrong, autonomous execution amplifies the error** rather than catching it, which is why
this gate is human-owned and the rest can be handed over.

## Critical Patterns

- Separate what/why from how. Specify = what/why, tech stack forbidden. Plan = how.
- Verifiable contract, all failing. It is the ONLY thing that makes "done" checkable → it enables autonomy.
- Tests are NOT edited or deleted. Hard rule.
- External state (files + git), never the agent's memory. Agents are stateless.
- One thing per iteration, clean context. Signal, not volume.
- Autonomy bounded from OUTSIDE the model: iteration cap, no editing tests, no skipping dependencies,
  and if a task fails N times → `blocked(technical)` and stop. A decision that is not the agent's to
  make is `blocked(user)` — a different state because it has a different recipient.
- Trajectory review + human-in-the-loop. "The agent said done" is NOT evidence: autonomous
  verification agents have up to 85% false positives.
- Workflows vs agents. Determinism (workflow) where you need it; autonomous agent where the contract is verifiable.

## The 3 pillars

1. **Spec-Driven Development** — the spec is the contract, not the code.
2. **Eval-Driven Development** — evaluate the trajectory, not just the output (Agent-as-Judge diverges
   0.3% from human vs 31% for looking only at the final output).
3. **Context engineering + durable harnesses** — the smallest set of high-signal tokens; state in
   files; sub-agents with clean context.

## Honest caveats

- SDD done well can eat ~50% of a project's time and dilutes in very large codebases.
- Agnostic scaffolding: scale the ceremony to the size of the problem.

## Resources

- Templates: `assets/` (the 5 stage templates + the auto-loop rulebook).
- Research + evidence: `references/research-ai-native-lifecycle-2026.md`
