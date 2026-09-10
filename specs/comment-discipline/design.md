# Comment Discipline — Design

Two investigations ran before this document: an inventory of what the corpus already says about
comments (nothing), and a survey of the published, citable guidance. Both are cited inline.

## Overview

Make Praxis's builders — and native Claude working under Praxis — comment the way a senior does:
sparse, load-bearing, and only where the code cannot say it itself. Three layers, split by how much
judgment each pattern requires: a mechanical deny for the patterns that are never legitimate, a
review-time report for the one that has real false positives, and prose for the part that is
genuinely judgment.

## Problem Statement

**The corpus says nothing about comments.** Verified two orthogonal ways across
`skills/ agents/ crafts/ pipelines/ hooks/ docs/ templates/ AGENTS.md`: zero rules about sparseness,
banners, or narration. `docstring` and `JSDoc` return zero hits. The only adjacent rule is
`agents/reviewer.md:64`, which flags a *dead* comment left after a deletion — not its style or its
volume. `crafts/anti-slop` is visual-design-and-prose only; `crafts/minimalism` is code structure and
dependencies only; neither reaches comment output. And `skills/codebase-design/` imports Ousterhout's
deep-module vocabulary while skipping the chapters he wrote about comments.

**It is not a density problem, and that changes the instrument.** The largest empirical study of
AI-generated code in real repositories measured comment density at **18.01% for AI-generated code
against 17.96% for human-written code** ([arXiv 2603.27130v2](https://arxiv.org/html/2603.27130v2)):

> "The similar comment ratios (18.01% vs. 17.96%) indicate that AI-generated code does not rely more
> heavily on comments despite being larger in size."

A gate keyed to density would not fire on the defect. The defect is **redundancy per comment**.

**But the raw output is a different thing from the merged output.** That study measures code that
already passed through a human who deleted the slop. The raw default is described precisely in
[anthropics/claude-code#65961](https://github.com/anthropics/claude-code/issues/65961), open and
unanswered:

> "Claude Code adds far too many code comments by default. The comments are mostly redundant,
> restating what the adjacent code already makes obvious or simply making references to the chat with
> Claude itself, leaking its chain of thoughts."
> "A clear, mandatory rule in `CLAUDE.md` does not reliably suppress it."

Both are true, and together they are the argument for this change: **Praxis should do the deletion
the human is currently doing before merge.**

**And prose alone will not do it.** This repo already measured what a prose rule buys on this
channel: 0 Run Cards in 8/8 `full` cells (`docs/evaluacion-arquitectura-plugin.md:719`), which is
why the spec floor is mechanical. The bug report above is independent corroboration for this
specific behaviour.

## Scope

### In
- A new craft `comment-discipline` — always-on, injected into every dispatch that writes code.
- Tier-1 detection in `hooks/pre-tool-use`, reading the written content for the first time.
- Ousterhout's comment chapters imported into `skills/codebase-design/references/`.
- One `reviewer` line for the tier-2 restatement check.
- An eval measuring the craft against a no-craft control on raw output.

### Out
- Comment *density* thresholds. Measured above to be the wrong instrument; encoded as ADR-003 so it
  is not proposed again.
- Reformatting or rewriting existing comments in a user's repo. This governs what gets written.
- A linter dependency. Praxis is zero-dependency; the checks are shell and Node, or they do not ship.
- `agents/reviewer.md`'s Standards axis beyond one added line.

## Technical Design

### 1. Three tiers, split by false-positive risk

The tier decides the response. This is the whole design (ADR-001).

**Tier 1 — deny. No judgment required, so a false positive is close to impossible.**

| pattern | why it is never legitimate | precedent |
|---|---|---|
| commented-out code | dead weight; git holds history | Ruff `ERA001`, Sonar `S125` |
| banner / divider comments (`// ====`, `/* ---- */`) | decoration, carries no information | — |
| chain-of-thought leakage (`// Step 1:`, `// Now let's`, `// As requested`, references to the conversation) | an artifact of the session, not of the code | the defect named in claude-code#65961 |
| `TODO` with no owner and no tracker | an untracked TODO is a wish | Google C++ `// TODO(username):`, Google Python `# TODO: crbug.com/... - ...` |

The fix is one keystroke — delete the line — which is why a deny is proportionate here. It is the
same shape as the spec floor's deny: cheap, mechanical, and the message names the exact fix.

**Tier 2 — report to the reviewer, never deny.** The restatement check, generalized from
[`jsdoc/informative-docs`](https://github.com/gajus/eslint-plugin-jsdoc/blob/main/docs/rules/informative-docs.md),
the only shipping linter rule in any language that detects it:

> "Reports on JSDoc texts that serve only to restate their attached name."

Its algorithm: the comment must contain **at least one content word not already present in the name
it documents**, after stripping stop-words (`a, an, i, in, of, s, the`).

This is not a deny, because it has real false positives that are *required by language convention*:
Go mandates a doc comment on every exported name (`go.dev/doc/comment`), and Rust's API guidelines
mandate an example on every public item — both necessarily echo the identifier. Denying there would
break the language's own rules (ADR-005).

**Tier 3 — prose in the craft.** The part that is judgment, imported as cited text:

- **Ousterhout** ([CS 190, public](https://web.stanford.edu/~ouster/cgi-bin/cs190-winter18/lecture.php?topic=comments)):
  *"Comments should describe things that are not obvious from the code."* His named failures:
  *"Mistake #1: comments duplicate code"* and *"Mistake #2: non-obvious info is not described"* —
  both directions, so the craft cannot be read as "write fewer comments". The operative test is the
  level of detail: *"Lower level comments provide precision… Higher-level comments capture
  intuition"* — a comment must sit at a **different** level than the line it accompanies.
- **Interface vs implementation:** *"do not describe the implementation in the interface
  documentation!"* Go states the same rule normatively: *"Doc comments should not explain internal
  details such as the algorithm used in the current implementation."*
- **Linux kernel, ch. 8** — the most directly encodable anti-boilerplate sentence found:
  *"Do not add boilerplate kernel-doc which simply reiterates what's obvious from the signature of
  the function."*
- **Google's three-clause gate** ([pyguide §3.8](https://google.github.io/styleguide/pyguide.html)):
  a docstring is mandatory iff the function is part of the public API, **or** has nontrivial size,
  **or** has non-obvious logic. The contrapositive is the rule that suppresses: private + small +
  obvious ⇒ no docstring.
- **Google's why-not-what, with its own exception**
  ([eng-practices](https://google.github.io/eng-practices/review/reviewer/looking-for.html)):
  comments *"explain why some code exists, and should not be explaining what some code is doing"* —
  except that *"regular expressions and complex algorithms often benefit greatly from comments that
  explain what they're doing."* The exception ships with the rule.
- **Fowler**, quoted correctly because he is usually quoted wrong
  ([*Refactoring*](https://www.informit.com/articles/article.aspx?p=2952392&seqNum=24)):
  *"Comments aren't a bad smell; indeed they are a sweet smell.* […] *comments are often used as a
  deodorant."* The operative rule: *"When you feel the need to write a comment, first try to refactor
  the code so that any comment becomes superfluous"* — with the ordered escalation Extract Function →
  Change Function Declaration → Introduce Assertion.

### 2. Written in the positive

`docs/skill-doctrine.md:196` records the cure that governs this file's wording: *"`don't X` makes X
more available, not less"*. A craft that says "do not write junk comments" makes junk comments more
available. Every rule in the craft states what to write, and the anti-patterns appear once, named,
in a section the reader reaches after the rule (ADR-004).

### 3. The hook

`hooks/pre-tool-use` gains a content pass. This is new ground: no Praxis hook has ever read what is
being written — `praxis_edit_paths` (`hooks/lib.sh:389-397`) extracts only `tool_input.file_path`.
The payload does carry it, confirmed against the official hooks documentation:

```
Write      → tool_input.content
Edit       → tool_input.old_string / tool_input.new_string
MultiEdit  → tool_input.edits[].old_string / .new_string
```

Only added lines are inspected — for `Edit`, the lines in `new_string` that are not in `old_string`.
Praxis must never deny a write because of a comment that was already in the user's file.

Carve-outs, all mechanical: generated files (a `@generated` marker or a `node_modules`/`dist`/`vendor`
path), lockfiles, and any file the user's own linter config already governs for that pattern. The
override remains the existing `PRAXIS_FLOOR=off`, plus a narrower `PRAXIS_COMMENTS=off`.

### 4. Where each piece lives

```
new:      crafts/comment-discipline/comment-discipline.md
          skills/codebase-design/references/COMMENTS.md
modified: hooks/pre-tool-use            the tier-1 content pass
          hooks/lib.sh                  helpers to extract added lines and scan them
          agents/reviewer.md            one Standards line for the tier-2 check
          agents/{engineer,backend,platform,design}.md   craft requirement
          tests/hooks.test.mjs          tier-1 detection, both directions
          README.md, AGENTS.md, CHANGELOG.md
```

A craft, not a skill (ADR-006): crafts are always-on and injected into the dispatches they govern,
which is exactly the reach this needs — every builder, without anyone invoking it. A skill would
have to win a routing match against 44 siblings on a turn about something else entirely.

## Edge Cases

- **A legitimate divider in a language that uses them conventionally.** None found; if a user's
  project uses them, `PRAXIS_COMMENTS=off` and the craft's prose still applies.
- **Rust and Go public API.** Tier 2 only, never tier 1. The craft names both as explicit carve-outs.
- **A comment quoting a spec or a ticket verbatim** — may look like restatement; tier 2, so it is
  reported, not blocked.
- **Test files.** Same rules. A test name that needs a comment is a test name that should be longer.
- **The user asks for heavy comments** (teaching material, a tutorial repo). The user's instruction
  wins; the craft says so, and `PRAXIS_COMMENTS=off` is the mechanical form of it.
- **A large file.** The content pass must be O(added lines) and must not read the file from disk.

## Acceptance (EAG)

- [ ] `node scripts/validate-resources.mjs` → 0 failed
- [ ] `node --test tests/*.test.mjs` → 0 fail
- [ ] `node scripts/routing-audit.mjs` → PASS, EN rank-1 ≥ 65 (a craft adds no routing case; measure
      dilution by moving the file out and back, as T05 did for `analyst`)
- [ ] `node scripts/boundary-audit.mjs` → ≤ 7
- [ ] **Tier-1 mutation, per gate.** For each of the four patterns: a payload carrying it is denied
      and the reason names the exact line; remove the detector → the test fails; restore → it passes.
      Both directions pasted, per pattern. A pattern whose test cannot fail is a GAP, not a PASS.
- [ ] **False-positive gate.** A payload carrying a *legitimate* comment of each shape — a Go exported
      doc comment, a Rust public item with an example, a regex explanation, a `TODO(owner)` — must be
      allowed. This gate matters more than the detection gate: a floor that blocks good work is worse
      than no floor.
- [ ] **Existing comments are never blocked.** An `Edit` whose `old_string` already contains a tier-1
      pattern and whose `new_string` does not add one is allowed.
- [ ] **Live cell with a negative control** (`evals/value/`): the same build task, craft loaded vs
      craft removed, scored on raw output — comments that restate their own line, banner comments,
      and chain-of-thought leakage, counted per hundred lines of emitted code. n≥3 per arm. If the
      control ties, that is the result and it is published as a negative.
