# Factory Cycle — Decisions

Each ADR passed the three gates: hard to reverse, surprising without context, a real trade-off.

## ADR-001: Ship opens a PR; the cycle never merges or pushes to main

### Context
The factory lineage merges locally with `--no-ff` and never pushes; a derivative opens a PR and
never merges. SWE-Review (arXiv 2607.06065) measured that 62 % of false APPROVE verdicts include
tests written by the generator itself.

### Options Considered
1. Local merge to main — one step less; no CI; a forged approval becomes code on main.
2. Push the change branch and open a PR — CI runs; a person merges; one step more.

### Decision
Option 2. The approver's APPROVE and every lens PASS gate the push; main is never written by the
cycle.

### Consequences
- Needs `gh` authenticated; unattended runs end at a PR, not at main.
- Parallel changes do not collide on main; they collide, visibly, in PRs.

## ADR-002: Markdown roles and shell hooks own the control flow; the Workflow tool is deferred

### Context
The barrier and the round cap must hold when the model ignores prose (0/72 fan-out measured).
Claude Code's Workflow tool offers `parallel()` as a real barrier and deterministic resume, but
it is Claude-only, needs the person's opt-in per run, and would be a second implementation.

### Options Considered
1. Markdown skill plus hooks — portable across hosts, the proven shape of the factory lineage,
   hooks are model-independent; barrier and cap need hook code and tests.
2. Workflow script — exact barrier and bounded loop in code; Claude-only; opt-in; two
   implementations to keep aligned.

### Decision
Option 1 now. Option 2 enters as an arm of `evals/cycle` once the eval exists, and replaces the
Claude Code path only if it wins on the same cells.

### Consequences
- The correctness of barrier and cap rests on `pre-tool-use` and its tests.
- Codex keeps the cycle; Cursor keeps its single hook and therefore no floor.

## ADR-003: Lenses by content, three by default, never a fixed four

### Context
Evidence on panels: nine judges of one family equal two independent votes (arXiv 2605.29800);
two parallel reviewers match one (F1 0.503 vs 0.495) while forced dissent citing code reaches
0.533 (arXiv 2608.18167); this repo's refuter panel matched `reviewer ×3` detection at 3.65× the
cost (`docs/evaluacion-arquitectura-plugin.md`).

### Options Considered
1. A fixed four (security, ux, ui, code) as in the diagram — cost on every change, correlated
   errors, two lenses idle on non-UI diffs.
2. Three existing refuters plus a UI lens only when the diff touches UI paths, each with a
   mandatory "what I tried to break" section.
3. One adversarial reviewer.

### Decision
Option 2. Diversity comes from lenses and fresh contexts, not from N.

### Consequences
- No UX lens on non-UI changes; revisit with `evals/cycle` if UI defects slip through.
- A PASS without a "tried to break" section is invalid; the approver treats it as SKIP.

## ADR-004: Two modes; `deep` is removed

### Context
Three modes with different file minimums are part of the tax the owner wants gone. `deep` asked
0/2 in the trap task. What `deep` added (review, ship, mandatory ADR, refuters) is now always on
(review, ship) or gated on content (ADR gates, UI lens).

### Options Considered
1. Keep `deep` as "full plus mandatory ADR and all lenses".
2. Remove it; `fast` for trivial, `full` for the cycle.

### Decision
Option 2. `/praxis:mode deep` maps to `full` with a notice for one release.

### Consequences
- Breaking for anyone on `deep`.
- The dial no longer decides how much review runs; the diff does.

## ADR-005: The mechanical floor stays; everything around it goes

### Context
The hook-written approval before any source edit is the one measured win of the current design:
3/3 unattended runs stopped, zero bypass attempts (`evals/floor` v2). The complaint is the process
around it: four files, a stage the model writes, a ledger builders own, a 103-line contract.

### Options Considered
1. Drop the floor — fastest; v1 of the eval showed the model self-approving 3/3 when the gate was
   prose.
2. Keep the floor, retarget it to `spec.md`, and cut the rest.

### Decision
Option 2. One ask per change remains, and it is the only ask.

### Consequences
- Every substantial change still stops once before code.
- Nothing else in the cycle depends on a field the model writes.

## ADR-006: Files, not conversation; one writer per file

### Context
Cognition reports that multi-agent work holds when writes stay single-threaded and the reviewer
shares no prior context with the builder. The factory lineage has agents read files, never the
conversation, and one writer for its state file. The 103-line contract that asked for fan-out
produced none in 72 cells.

### Options Considered
1. Handbacks and shared conversation — fewer files; context leaks between roles; the orchestrator
   pastes content into prompts.
2. Files under `specs/<change>/`, each with one writer; the orchestrator passes paths.

### Decision
Option 2. The builder's report is the one exception: it returns in its handback, since only the
orchestrator reads it.

### Consequences
- More files per change, each read by exactly the roles that need it.
- The orchestrator's context stays thin: paths, verdicts, and the ledger.

## ADR-007: The floor stops drift; adversarial resistance belongs to the host's permission rules

### Context
Round 2 of the lenses showed that Bash can forge `decision.md` with one redirection, mint the
intent token by running `hooks/user-prompt-submit` directly, or wrap `scripts/approve.sh` in
`bash -c`. A PreToolUse hook sees one command string and no history, and a shell has unbounded
spellings for the same action: aliases, `$(…)`, variables, wrapper scripts, `GIT_DIR`. Each
hardening round closes some spellings and opens false denies on honest ones — round 2's
`gh pr create` regression on legacy ledgers is one. The threat the floor was built for is
measured elsewhere: `evals/floor` v2 saw 3/3 unattended runs stop with zero bypass attempts, and
in this change the orchestrator stopped at the round cap and asked for `/praxis:rework` instead
of minting the token. The floor's adversary is a model that drifts, not one that attacks.

### Options Considered
1. Keep growing the tokenizer toward a shell parser — unbounded surface, a new spelling every
   round, false denies on the honest path.
2. State the threat model as drift: the hook denies the direct spellings a drifting model
   produces (Write/Edit on records, `scripts/*.sh` without the token, a push whose destination
   is trunk, a direct write to `decision.md`), documents the open forms in its header, and the
   host's permission rules — outside the model, applied to every command — carry adversarial
   resistance: `Bash(*hooks/*)`, `Bash(*.praxis/*)`, `Bash(*decision.md*)` denied in the
   project's `.claude/settings.json`, the equivalent in Codex `permissions`.
3. Drop the Bash gates and rely on the host alone — no drift resistance on hosts without rules.

### Decision
Option 2. Round 3 fixes the direct spellings the lenses listed and stops there; `docs/cycle.md`
and the README carry the deny rules the person installs.

### Consequences
- A finding "Bash spelling X reaches a record" is in scope only when X is a spelling a drifting
  model produces; otherwise the fix is a line in the host's settings, not in the hook.
- The honest path is never denied: a branch outside a cycle opens a PR freely.
- Cursor, with one hook and no rules, keeps drift resistance only (ADR-002 already says so).
