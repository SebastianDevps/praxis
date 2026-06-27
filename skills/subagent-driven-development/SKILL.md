---
name: subagent-driven-development
description: Use when executing a multi-task plan or ledger — dispatch one implementer subagent per task, review between tasks, and track progress in a ledger file instead of doing everything inline.
kind: skill
od:
  triggers: ["execute the plan", "run the tasks", "implement the plan", "work through the ledger"]
---

# Subagent-Driven Development — one subagent per task

The failure this fixes: the controller reads the plan, then implements every task itself in the main
thread. Context fills with file contents, half-done edits, and stale assumptions; by task 5 the model
has forgotten task 1's contract. That is context rot, and it produces silent regressions.

## The controller stays thin

You are a COORDINATOR. You do NOT implement inline. Per task:

1. **Dispatch one subagent** for that task — give it the task's files, the done-criterion, and only the
   context it needs. Delegate reading AND writing together; the subagent reads the files, makes the
   change, and returns a result you synthesize.
2. **Review before the next task.** Check the returned result against the task's check. Red → fix or
   re-dispatch before moving on. Never batch failures forward.
3. **Update the ledger**, then move to the next task.

```diff
- ❌ controller reads 12 files, edits all of them inline, runs tests once at the end
+ ✅ controller dispatches task 1 → reviews → ledger → dispatches task 2 → reviews → ...
```

## Why fresh context per task

Each subagent starts clean. It can't inherit a wrong assumption from task 1, and it can't bloat your
context with the 400 lines it read. The cost (~5-10k init tokens per dispatch) buys isolation and
durable progress — cheap next to a tangled inline build you have to unwind.

## The ledger is the progress, not the chat

Progress lives in a ledger file (`PROGRESS.md` / `plan.md`, per `writing-plans`), checked off `- [x]`
as each task passes review. This is what survives compaction: if your context is wiped mid-build, you
reconstruct state by reading the ledger, NOT by trusting memory. The controller's context is
disposable; the ledger is not.

## Rules

- Disjoint tasks (independent files) → fan out in one parallel wave. Shared files → sequential.
- One task = one done-criterion verified before the next starts.
- The controller never declares "done" — the ledger's last unchecked box does.
