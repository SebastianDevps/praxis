---
name: agentic-lifecycle
description: Use when planning substantial or multi-phase work to run agents almost autonomously — the spec-driven doctrine (decision → verifiable contract → task files with status → auto-loop → review → done) that unifies spec-lifecycle and autonomous-loop and adds eval-driven verification. NOT the phase mechanics (that is `spec-lifecycle`), NOT the loop runner (that is `autonomous-loop`) — this is the doctrine above both.
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

## Relationship to other Praxis skills (do not duplicate)

- Stages 1–4 (decision → plan → spec → tasks): see `spec-lifecycle`.
- Stage 5 (auto-loop, fresh context, `PROGRESS.md` + git): see `autonomous-loop` and `/praxis:loop`.
- Decomposing into testable tasks: see `writing-plans` and `subagent-driven-development`.
- This skill adds: the unifying THESIS, the EVAL-DRIVEN pillar, the review gate, and the evidence base.

`spec-lifecycle` owns the markdown spec skeleton (`templates/spec.md`) — the human-readable phase
spec. This skill's `assets/spec.template.json` is the complementary **machine-verifiable contract**
(the failing feature-list). Same intent, two surfaces: prose for humans, JSON for the loop.

## The lifecycle — 7 stages

| # | Stage | Produces | Owner | Key rule |
|---|-------|----------|-------|----------|
| 1 | Decision Record | `decisions/NNN-title.md` | Human | Problem, options, chosen + why, and what is explicitly OUT of scope |
| 2 | Plan | `plan.md` | Human | The what + dependency graph. No tech stack yet |
| 3 | Spec ★ | `spec.json` | Human (strong gate) | Verifiable contract: feature-list, each item with a verification, all failing |
| 4 | Tasks | `tasks/*.md` + `progress.md` | Generated | Files with status + phase, ordered by dependency, `[P]` parallelizable |
| 5 | Auto-loop | commits + progress | Agent | One task per iteration, clean context, state in files + git |
| 6 | Review | verdict | Human | Review the trajectory, not just the output. Mandatory |
| 7 | Done | archive + spec synced | Human | Auditable cycle end to end |

The ★ Spec gate is the most important: if the spec is wrong, autonomous execution amplifies the error.

## Critical Patterns

- Separate what/why from how. Specify = what/why, tech stack forbidden. Plan = how.
- Verifiable contract, all failing. It is the ONLY thing that makes "done" checkable → it enables autonomy.
- Tests are NOT edited or deleted. Hard rule.
- External state (files + git), never the agent's memory. Agents are stateless.
- One thing per iteration, clean context. Signal, not volume.
- Autonomy bounded from OUTSIDE the model: iteration cap, no editing tests, no skipping dependencies,
  and if a task fails N times → `blocked` and stop.
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
