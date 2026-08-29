# Context delivery — what a dispatched specialist receives, and why

> Decision record. 2026-08-28. Researched against published guidance rather than settled by taste,
> because the alternative (inject full skill bodies) is defensible-sounding and 4–7× more expensive.

## The question

`SubagentStart` injects the operating contract and the crafts an agent declares. Agents also declare
`skills:` in frontmatter, and nothing read it. When that declaration is resolved, does the specialist
receive each skill's **full `SKILL.md` body**, or only its **name and description**?

## What the ecosystem does

**Anthropic's Agent Skills architecture is progressive disclosure in three levels**, with published costs:

| Level | When it loads | Cost |
|---|---|---|
| 1 — metadata (`name` + `description`) | always, at startup | **~100 tokens per skill** |
| 2 — `SKILL.md` body | only when the skill triggers | under 5k tokens |
| 3 — bundled resources | when read | none until accessed |

The stated rationale: *"This lightweight approach means you can install many Skills without context
penalty: until a Skill is triggered, only its name and description occupy context."*

**Anthropic's context-engineering guidance says the same for agents generally:** *"maintain
lightweight identifiers (file paths, stored queries, web links, etc.) and use these references to
dynamically load data into context at runtime using tools."* It favours a hybrid — *"retrieving some
data up front for speed, and pursuing further autonomous exploration at its discretion"* — and names
Claude Code itself as the example: CLAUDE.md dropped in up front, everything else fetched just-in-time.

The 2026 practitioner consensus matches: the field moved from "retrieve everything before inference"
to just-in-time context, holding lightweight references and loading on demand.

## What it costs here

Measured across this repo's agents:

| agent | skills | pointer | full bodies | factor |
|---|--:|--:|--:|--:|
| design | 4 | 446 tok | 3095 tok | **6×** |
| orchestrator | 5 | 503 | 2825 | 5× |
| backend | 4 | 348 | 1809 | 5× |
| platform | 4 | 357 | 1579 | 4× |
| security | 1 | 86 | 630 | 7× |
| engineer | 1 | 95 | 450 | 4× |

The pointer cost lands at ~95 tokens per skill — within noise of the ~100 tokens Anthropic publishes
as the designed Level-1 cost. Injecting bodies would collapse Levels 1 and 2 into one and pay 4–7×
to fight an architecture the host already implements.

## Decision

**Pointer: name and description. Never the body.** The specialist reads the body by invoking the
skill, which is Level 2 working as designed.

## The caveat this does not solve

Just-in-time carries a documented weakness: **a dependency on description quality.** That is exactly
the failure [the activation audit](https://github.com/SebastianDevps/praxis/blob/measurement/evals/2026-08-28-activation-audit.md) measured — real
test-strategy, debugging and auth prompts where the matching skill never fired.

Pointers alone do not fix it. What does is a different variable: **the size of the candidate set.**
Unassisted, the model matches a prompt against 34 skills. A dispatched specialist matches against the
1–5 its role declares, already filtered by domain and marked as relevant to the work it was given.
That is a categorically easier match, and it improves independently of how well any description is
written.

So the framing of the injection carries as much weight as its content. Not *"here are some available
skills"* but *"your role declares these — invoke them when they apply."*

## Why this confirms the existing split

Praxis's craft/skill distinction already **is** progressive disclosure:

- **crafts** — unconditional discipline for the role → injected in full, every dispatch. A permanent
  Level 2, correct because they always apply.
- **skills** — conditional capability → pointer only, body on invocation. Level 1 → 2.

No new architecture. `skills:` is resolved the way `od.craft.requires` already is.

## Sources

- [Agent Skills — Claude Platform Docs](https://platform.claude.com/docs/en/agents-and-tools/agent-skills/overview)
- [Effective context engineering for AI agents — Anthropic](https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents)
- [Context engineering: memory, compaction, and tool clearing — Claude Cookbook](https://platform.claude.com/cookbook/tool-use-context-engineering-context-engineering-tools)
- [Just-in-Time Context for AI Agents — TrueFoundry](https://www.truefoundry.com/blog/jit-context-just-in-time-context-agents)
- [Agent Skills: Progressive Disclosure as a System Design Pattern — SwirlAI](https://www.newsletter.swirlai.com/p/agent-skills-progressive-disclosure)
- [Context Engineering: A Practical Guide for AI Agents (2026) — Sourcegraph](https://sourcegraph.com/blog/context-engineering)
