---
id: T-NNN
phase: define | plan | build | verify | review | ship
state: pending      # pending → in_progress → review → done | blocked(technical) | blocked(user)
depends_on: [T-XXX]
verifies: [F1]      # which contract items (spec.json) this closes
parallel: false
---

<!-- The vocabulary above is canonical and defined once: docs/task-model.md.
     Do not add a phase or a state here — add it there, or you have created a
     fifth dialect of a field five skills already read. -->

## Objective

<what must be done, tied to the items in `verifies`>

## Done criterion (verifiable)

<how a machine checks it is ready — this is the task's `verify:` line>

## Execution notes

<the agent leaves a trace here for the next iteration>
