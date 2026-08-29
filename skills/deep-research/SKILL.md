---
name: deep-research
description: Use when a question needs evidence from multiple independent sources — a defensible answer on a contested topic, prior art, tradeoffs between technologies, how others solved this — scopes it, gathers, cross-checks, synthesizes with citations. NOT a quick recon of this repo (that is `scout`), NOT fetching one library's docs (that is `docs-seeker`).
kind: skill
od:
  category: research
  triggers:
    - deep research
    - investigate
    - compare options
    - prior art
    - research question
---

## Method

### Phase 1 — Scope
Define the question precisely. State success criteria: what does a good answer look like? What would make it wrong? This step prevents scope creep and stops you from researching the wrong thing.

### Phase 2 — Gather
Collect from at least 3 independent sources. "Independent" means different authors, organizations, or methodologies — not mirrors of each other. Primary sources (specs, papers, official docs, source code) outrank secondary ones (articles, forum posts).

### Phase 3 — Cross-check
Compare what sources say. Note disagreements explicitly — they are signals, not noise. A disagreement that resolves cleanly adds confidence; an unresolved one becomes a finding.

### Phase 4 — Synthesize
Write conclusions with citations. Every non-obvious claim traces to a specific source. Do not assert facts that only one source supports without flagging the uncertainty.

## Output contract

- Findings section: what the evidence shows.
- Gaps section: what you couldn't confirm — explicit, not silently omitted.
- Disagreements section: where sources conflict and why it matters.

> Curated from vibecode autoresearch + caprika evidence ethos.
