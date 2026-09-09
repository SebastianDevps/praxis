# Spec-Driven Workflow — Future Work

## Enhancements
- DFU-1: Graduate `.praxis/memory` procedures into `agents/rules/<prefix>-<name>.md` through
  `learn-graduate`, using `_template.md`. Curated layer fed by the learned layer.
- DFU-2: "Promote docs to public" flow (`specs/<change>/docs/` → `docs/<change>.mdx`) for
  projects that publish user documentation.
- DFU-3: Per-project mode persistence (`.praxis/mode` before `~/.claude/.praxis-mode`).

## Technical Debt
- The four `pipelines/*.md` keep their own phase vocabularies; this change only points their
  `artifacts:` rows at spec files. Unifying them with `docs/task-model.md` is a separate change.

## Nice to Have
- `specs/README.md` index generated from `implementation.md` frontmatter (stage per change).
- DFU-4 (DONE → `specs/hook-owned-approval/`): Hook-owned approval record. Register `PostToolUse` on `Edit|Write`: when the first source
  edit at `stage: designed` actually runs (i.e. the person answered the `ask`), the hook writes
  `.praxis/approved/<change>`; `pre-tool-use` then requires that marker instead of `stage: planned`,
  and denies Edit/Write to `.praxis/approved/` from the model. Closes the bypass measured in
  `evals/floor` (3/3 unattended runs advanced the stage themselves). Bash writes stay a gap.
- DFU-5: Bash-path edits (`git mv`, `perl -pi`, heredocs) are outside the floor's stated scope and
  appeared in the matrix. Same class as variable indirection in a bash safety guard; document, do
  not pretend the floor catches it.
