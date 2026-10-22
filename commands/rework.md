---
description: Send a needs-human change back to the builder with a note — archives the review rounds and the ESCALATE decision, resets the round counter, clears .praxis/needs-human/<change>. Typed by the person.
---

# /praxis:rework — back to the builder, with a note

**The person types this command.** The hooks gate `scripts/rework.sh` on the person's own
prompt: invoked on a model's initiative — at the round cap, after an ESCALATE, from a loop
iteration — it is refused, and that refusal is the cap working. The note is the person's reading
of the reviews, not a model's summary of them.

Run, in the user's project directory, with the change name and the note the user typed:

```
bash "${CLAUDE_PLUGIN_ROOT}/scripts/rework.sh" <change> "<note>"
```

`CLAUDE_PLUGIN_ROOT` is Claude Code's name for the installed plugin directory; Codex exports it
as `PLUGIN_ROOT`, Cursor as `CURSOR_PLUGIN_ROOT`; elsewhere use the path the plugin was
installed to. The note is required — a rework without a reason is the loop the round cap
exists to stop. It refuses a change with no `specs/<change>/implementation.md`.

## What the script does

- Moves `specs/<change>/review/round-*` and `specs/<change>/decision.md` into
  `specs/<change>/review/rework-<k>/` (k = 1, 2, …, one folder per rework). The next round-1 is
  a new review; a stale ESCALATE would keep the ship gate shut.
- Writes the note to `specs/<change>/review/rework-<k>/note.md`.
- Sets `round: 0` and `stage: planned` in the ledger. The person's script may write the
  ledger's round; the model may not — `round:` is what the cap counts.
- Removes `.praxis/needs-human/<change>`.
- Prints one `changes: <file>` line per archived lens file at `verdict: CHANGES`, and the
  note's absolute path on the last line.

## Then resume the builder

1. Rerun `bash "${CLAUDE_PLUGIN_ROOT}/scripts/worktree.sh" <change>` first. It is idempotent and
   re-seeds the worktree's `.praxis/` and spec from the main checkout — the worktree's markers are
   a mirror, and the script above changed only the original. Its last line is the worktree path.
2. Read the ledger's `builder:` id. `SendMessage` to it with the note path and the `changes:`
   files the script printed — paths, never content. The hook allows the resume: the round is 0.
   If the builder is gone (no such agent), dispatch a fresh `builder` with the worktree path, the
   spec path, the note path and the `changes:` files, and record the new id in `builder:`.
3. Continue the cycle through the `factory` skill: on the builder's handback, `stage: built`,
   `round: 1`, write `review/round-1/lenses`, dispatch the lenses in one message, and so on.
   The round cap starts again at 1; a second ESCALATE ends in needs-human again, and the person
   decides again.

## What this is, and is not

- Typed by the person, after reading the reviews and the approver's reason. The model told to
  wait at the round cap waits; running this itself is the bypass the counter exists to remove.
- The other way out of needs-human is `/praxis:approve <change>`, which ships as is.
- Design: `specs/factory-cycle/design.md` (the cycle and the file formats) and
  `specs/factory-cycle/architecture.md` §2 (the ESCALATE path).
