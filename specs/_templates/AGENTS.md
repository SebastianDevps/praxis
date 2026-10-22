# AGENTS.md — {Change Name}

Instructions for any agent working on this change. Optional in every mode — the cycle's roles
receive `spec.md` and a role kernel instead; write this only when a change needs more.

## Context
{One paragraph: what this change does and where it lives in the codebase.}

## Before Starting Work
1. Read `spec.md` (`design.md` in older changes) — what to build and how it is accepted.
2. Read `implementation.md` — current stage, what is done, what is blocked.
3. Look at existing patterns in {relevant directories}.

## Code Patterns
{Reference implementations to follow, with paths.}

## Don't
- Don't add behavior that is not in `spec.md`. Capture it in `future-work.md` instead.
- Don't skip the `verify:` line of a task.
- {Change-specific don'ts}
