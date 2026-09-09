# Spec-Driven Workflow — Decisions

## ADR-001: Folder per change, evolving `spec-lifecycle` — not a parallel system

### Context
Praxis has `spec-lifecycle` (one file per change, `stage:` frontmatter) and two divergent
templates. cal.diy uses a folder with separate files per concern.

### Options Considered
1. Keep the single file and add sections — cheap, but `implementation.md` churn rewrites the
   design every session, and there is no place for ADRs or docs.
2. Add a new `specs` skill beside `spec-lifecycle` — two words for one concept; the repo's own
   doctrine calls that a defect.
3. Evolve `spec-lifecycle` into the folder model and delete both old templates.

### Decision
Option 3. One skill, one template source (`specs/_templates/`), one stage machine.

### Consequences
- `templates/spec.md` and `skills/spec-lifecycle/templates/` are removed; the divergence closes.
- `researched` stage is dropped; research is a section, not a folder state.

## ADR-002: `implementation.md` is the ledger; `PROGRESS.md` becomes an index

### Context
`docs/task-model.md` defines one ledger, `PROGRESS.md`. A per-change `implementation.md` that
also lists tasks would be a second ledger with the same vocabulary.

### Options Considered
1. Keep `PROGRESS.md` as the only ledger; `implementation.md` links to it — the change history
   is split across a gitignored file and a committed one.
2. `implementation.md` owns the task lines; `PROGRESS.md` lists changes and stages.

### Decision
Option 2. The task format does not change; only its home does. `subagent-stop` counts across
`specs/*/implementation.md`.

### Consequences
- `PROGRESS.md` stays gitignored in this repo; `specs/` is committed (it is design record, not
  scratch state — same category as `docs/`).

## ADR-003: Runtime floor — mechanical, scaled by mode

### Context
Praxis's identity is "No enforcement; primes, never blocks" (`AGENTS.md:14`, `marketplace.json`).
The owner's requirement is "always a minimum, even in the fastest mode, everything in specs".
The evaluation measured that kernel prose alone produced 0/8 Run Cards in `full` mode.

### Options Considered
1. Prose only — identity intact; expected compliance low, by the repo's own measurement.
2. Mechanical floor scaled by mode (`PreToolUse` + `Stop`) — one approval stop per change,
   transparent afterwards; changes the identity statement and the marketplace copy.

### Decision
Option 2, approved by the owner on 2026-09-09. The requirement is an invariant, and the repo's
own doctrine (`crafts/evidence-discipline`: "mutate what it guards and watch it fail") only
applies to something that can fail. `PRAXIS_FLOOR=off` is the single documented escape hatch.

### Consequences
- `AGENTS.md` §Principles and `README.md` replace "No enforcement" with "A floor, not a
  ceiling"; `marketplace.json` copy follows.
- Hosts without `PreToolUse`/`Stop` (Gemini, Copilot; Codex/Cursor per their hook events)
  keep option 1, and the README says which hosts have the floor.

## ADR-004: No `prompts.md`

### Context
cal.diy ships a per-feature prompt library ("Continue feature", "Generate docs").

### Decision
Not ported. Praxis already routes these through commands and skills (`/praxis:feature`,
`release-readiness`, `spec-lifecycle`). A per-change prompt file duplicates the router.

### Consequences
- The one useful prompt, "Continue working on <change>", becomes contract text: on resume, read
  `specs/<active>/implementation.md` first.

## ADR-005: Project scaffold mirrors cal.diy's `agents/` + `.claude/` symlinks

### Context
cal.diy keeps a single source (`agents/rules`, `agents/skills`) and exposes it to Claude Code via
symlinks, with `CLAUDE.md -> AGENTS.md`. Praxis has no project-side scaffold; it only ships its
own resources.

### Decision
`/praxis:init` creates the scaffold in §5 of `design.md`. Rules use cal.diy's frontmatter and
prefix convention verbatim. Praxis's `crafts/` stay plugin-side (opinion), `agents/rules/` are
project-side (fact); the two do not merge.

### Consequences
- Windows hosts: symlinks may fail; `init` falls back to copying and prints the difference.
- `.praxis/memory` (learned) and `agents/rules` (curated) are two layers on purpose; a
  graduation path between them is deferred (`future-work.md`).

## ADR-006: The approval stop uses the host's `ask`, not prose

### Context
The first live cell (`evals/floor`, full-feature, treatment, $0.56) showed the deny working and
the prose stop not: no Run Card, no `Needs your decision`, design and build in one run. The same
channel that measured 0/8 Run Cards. The deny also pointed at the plugin's `_templates`, which a
`-p` run cannot read (3 refusals) — the model wrote a non-template design from memory.

### Options Considered
1. Keep the stop in prose and accept that it holds only sometimes.
2. Require `stage: planned` for source edits and trust the model to set it only after approval —
   unverifiable; the model sets the stage.
3. Answer the first source edit at `stage: designed` with `permissionDecision: ask`: the host's
   permission prompt is the approval, and it is the one primitive that cannot be answered by the
   model itself. After approval the model sets `stage: planned` and the floor is silent.

### Decision
Option 3. And the first deny copies `specs/_templates/` into the project so every instruction in
the deny is a local path the model can read and write.

### Consequences
- An unattended run (`claude -p`) is refused at the first source edit unless the ledger already
  says `planned` — that is the intended "Needs your decision" for a run with nobody to decide.
- Codex without `ask`: deny with the same reason (host-detected), recorded in the hook header.
- A hook now writes into the project at deny time (templates only, only when missing).
- **Measured after the fact (`evals/floor`, n=3, $6.93):** in `claude -p` the host refuses the
  `ask`, and in 3/3 treatment runs the model then set `stage: planned` itself and built — the
  reason text names the field, and the model owns the field. Unattended, option 3 degrades to the
  rejected option 2. What held: `design.md` existed before the first source edit in 3/3 treatment
  runs and in 0/3 controls; the spec floor is real, the approval stop is prose with a prompt in
  front of it. Interactive behaviour is not measured. Hardening path: `future-work.md` DFU-4.
