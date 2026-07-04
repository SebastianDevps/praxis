# Research — How AI-native startups build software (2025–2026)

Evidence backing this skill. Method: deep research, 6 angles, 27 sources, 134 claims, 25 verified with
adversarial voting (3 judges, killed on 2/3). 24 confirmed, 1 refuted.

## Thesis

Top teams moved from "ask the AI for code" (vibe coding) to handing it verifiable contracts and curated
context. Rule: an agent runs alone as far as the contract is verifiable; where "done" is not verifiable,
a human goes in.

## Pillar 1 — Spec-Driven Development

- Kiro: prompt → requirements → design → sequenced tasks, then implements with subagents.
  https://kiro.dev/docs/specs/
- GitHub Spec Kit: 5-command pipeline (Constitution → Specify → Plan → Tasks → Implement). Specify =
  what/why ("Do not focus on the tech stack at this point"); Plan = how; Tasks = embedded TDD ("tests
  are written before implementation"), ordered by dependency, `[P]` parallelizable.
  https://github.com/github/spec-kit
- SDD makes evals deterministic: assert the CONSTRAINTS the output must satisfy, not the output.
- ⚠️ Caveat: anecdotal/vendor gains, not audited. One report: SDD consumed ~50% of the time.

## Pillar 2 — Eval-Driven Development

- Agent-as-Judge (evaluates the full trajectory, with tool-use/memory/reasoning) differed from human
  vote 0.27% vs 31.24% for a simple LLM-judge (DevAI benchmark). https://arxiv.org/abs/2410.10934
- EDDOps: 4-step cycle (eval plan → cases → offline+online → analyze/improve) with step-level oracles
  (pass/fail/graded) over prompts/plans/retrieval/tool-outputs. https://arxiv.org/html/2411.13768v3
- Playbook: ~100 golden test cases, 3–5 metrics, iterate until passing.
  https://deepeval.com/blog/eval-driven-development
- ⚠️ Autonomous QA agents (VLM): 85% false positives across 120 sites → human-in-the-loop mandatory.
  https://arxiv.org/html/2509.05197v1

## Pillar 3 — Context engineering + durable harnesses (Anthropic)

- Context engineering ≠ prompt engineering: curate "the smallest possible set of high-signal tokens".
  https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents
- 4 techniques: compaction, external note-taking, sub-agents with clean context, just-in-time retrieval.
- Durable harnesses: split initializer/coding-agent; contract = feature-list JSON with failing items;
  state in git + progress.txt; "It is unacceptable to remove or edit tests"; each session memoryless.
  https://www.anthropic.com/engineering/effective-harnesses-for-long-running-agents
- Taxonomy: workflows (predefined code) vs agents (the LLM drives its own process).
  https://www.anthropic.com/research/building-effective-agents

## Correction on stablyai/orca

Orca is NOT a QA/e2e agent. It is an ADE (Agent Development Environment): a terminal orchestrator that
runs a fleet of code agents in parallel, each in its own git worktree; fan-out of a prompt to N agents
and merge the winner. The QA is a separate Stably product. https://github.com/stablyai/orca

## Refuted

- ❌ "Stably 99.7% assertion accuracy" (vote 1–2, marketing with no independent benchmark).
- ⚠️ Stably figures ("< 10 min") are self-reported.

## Open questions (model of a good question)

1. Independent (non-vendor) results of SDD on real multi-dev codebases.
2. Golden dataset + trajectory eval in practice: how many turns, what oracles, what tooling in CI.
3. Given the 85% FP, which verification layer brings precision to a trustworthy level at the least cost.
4. Can the spec's feature-list JSON ALSO be the eval golden dataset (a single source of truth)?

Freshness note: this space moves quarterly; revalidate after ~2026-Q4.
