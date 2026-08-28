---
name: decision-challenge
description: Use immediately before a consequential commitment — an irreversible migration, a production auth change, a costly architecture bet, or a plan whose confidence outruns its evidence. Isolates the claim from the persuasion, attacks each assumption, settles doubts with evidence, and emits proceed / hold / stop with an unlock condition. NOT picking between options you have not committed to (that is `strategy-compare`), NOT reviewing a finished diff (that is the `refuter-*` agents).
kind: skill
od:
  category: reasoning
  triggers:
    - challenge this decision
    - are we sure
    - poke holes
    - "before we commit"
    - devil's advocate
---

## When to use

The decision is made or about to be. Someone is about to act on it and the action is expensive to
undo. The purpose is to find the **decision-changing** doubt — not to perform scepticism forever.

Do not run this to compare options you have not chosen between; that is `strategy-compare`. Do not
run it on a finished change; that is the refuter panel.

Read-only unless the user also asks you to change the artifact.

## One bounded cycle

```
MATERIALIZE → ISOLATE → ATTACK → TEST → RECONCILE → VERDICT
```

### 1. Materialize

Do not challenge a cloud of conversation. Write the packet:

- the decision or claim, in one sentence;
- the artifact and exact revision it applies to;
- the constraints and invariants that must hold;
- the evidence the author is relying on;
- the known unknowns;
- the cost of a false positive (an unnecessary stop) and of a false negative (an unsafe proceed).

If it cannot be stated in one sentence, it is not atomic — split it. "The migration is safe" is
four claims: lock duration, dependency completeness, rollback time, consumer compatibility.

### 2. Isolate claim from persuasion

Build the challenge packet from the artifact, contract, constraints and evidence — **not** the
author's confidence, seniority, or preferred conclusion. This is the same reason the refuter
agents are denied the builder's reasoning: anchoring is the failure mode.

### 3. Attack each material claim

- What observation would make this false?
- Which dependency or consumer is missing from the inventory?
- Is the evidence direct, current and representative — or an analogy?
- What timing, ordering, concurrency or partial-failure path is assumed away?
- What privilege, data-quality or human handoff has to work perfectly?
- If rollback is promised, has restoration time been *proved*, and what reconciles the data?
- Can this be made reversible or staged before the risk is accepted?

Prefer one sharp counterexample over ten generic cautions. Rate each doubt **blocker / material /
minor** by consequence and likelihood — severity is not a measure of how uncomfortable the
question sounds.

### 4. Test instead of debating

Turn the strongest doubts into evidence requests: a dependency query, a row count, a dry run, a
restore rehearsal, a contract test, a permission audit, a consumer confirmation. Run the safe
read-only ones. Never mutate production to settle an argument.

### 5. Reconcile, claim by claim

Every doubt ends in exactly one state:

| State | Meaning |
|---|---|
| **verified** | direct evidence supports the claim |
| **refuted** | evidence contradicts it |
| **mitigated** | the plan changed, so the doubt no longer applies |
| **uncertain** | evidence is missing and the consequence remains |
| **accepted risk** | a named owner explicitly accepts a bounded residual risk |

Record evidence, owner and next action. **"Discussed" and "probably fine" are not states.**

### 6. Verdict

- **PROCEED** — no blocker survives; material uncertainties have owners and safe bounds.
- **HOLD** — a decision-critical uncertainty can be resolved without abandoning the approach.
- **STOP / REDESIGN** — a claim is refuted, or the residual downside is outside stated tolerance.

**Name what would change a HOLD or a STOP.** A verdict without an unlock condition teaches
nothing and gets overridden by whoever is most confident in the room.

## Stopping rule

The cycle ends when every material claim has a state and the verdict has an unlock condition.
Scepticism past that point is cost without information. Say the cycle is closed and hand back.

## Anti-patterns

| Anti-pattern | Why it fails |
|---|---|
| Challenging the author instead of the claim | Produces defensiveness, not evidence |
| Listing ten generic risks | Dilutes the one that matters; nobody acts on a list |
| A blocker with no repro or query behind it | That is a question. Questions do not block |
| STOP with no unlock condition | Unfalsifiable, so it gets overruled rather than resolved |
| Running this on a reversible decision | The cost of the challenge exceeds the cost of being wrong |
