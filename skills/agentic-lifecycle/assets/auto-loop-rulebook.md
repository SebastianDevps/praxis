# Auto-loop rulebook

> How an agent executes the lifecycle almost alone, SAFELY. Aligned with the `autonomous-loop` skill.

## Roles

- **Initializer** (once): prepares the environment, validates that `spec.json`, `tasks/`, and `progress.md` exist.
- **Executor** (each iteration): does ONE task, with clean context.

## Executor loop

1. Read `progress.md` + git log → get up to date.
2. Pick the next `status: pending` task whose `depends_on` are all `done`.
3. Mark `in_progress`. Execute ONLY that task.
4. Run its verification (done criterion).
   - Passes → mark `review`, update `spec.json` (the `passes` it closes), write `progress.md`, git commit.
   - Fails → git revert to last good state; increment the attempt counter.
5. Repeat until ALL contract `passes` are true.

## Guardrails (outside the model, non-negotiable)

- Max iteration cap per run.
- No editing or deleting tests / verification criteria.
- No skipping dependencies.
- If a task fails N times → `blocked` and stop; escalate to a human.
- Every change passes through `review` (human) before `done`. "The agent said done" is not evidence.
