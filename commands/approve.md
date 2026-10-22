---
description: Approve a change as the person driving — writes .praxis/approved/<change>, the record the floor gates source edits on; on a needs-human change, also records APPROVE (human) and ships it. For hosts without a permission prompt and for unattended runs.
---

# /praxis:approve — approve a spec, or ship an escalated change

**The person types this command.** The hooks gate `scripts/approve.sh` on the person's own
prompt: invoked on a model's initiative — after a deny, inside a subagent, from a loop
iteration — it is refused, and that refusal is the floor working. If you are reading this
because a deny told you to wait, wait.

Run, in the user's project directory, with the change name the user typed:

```
bash "${CLAUDE_PLUGIN_ROOT}/scripts/approve.sh" <change>
```

`CLAUDE_PLUGIN_ROOT` is Claude Code's name for the installed plugin directory. Codex exports it
as `PLUGIN_ROOT`, Cursor as `CURSOR_PLUGIN_ROOT`; on Gemini and Copilot use the path the plugin
was installed to — the same resolution `hooks/lib.sh` performs. The script locates the plugin
from its own path, so any absolute path to it works, as does `bash scripts/approve.sh <change>`
from the plugin root the way `/praxis:init` runs `scripts/init.sh`.

It refuses when the change has neither `specs/<change>/spec.md` nor the legacy `design.md`:
there is nothing to approve yet. Otherwise it does one of two things, and its output says which.

## 1. The spec approval

Writes `.praxis/approved/<change>` (empty file, gitignored) and prints one line. The floor
will not ask again for this change. Then set `stage: planned` in `specs/<change>/implementation.md`
and continue the cycle (`factory` skill): worktree, builder.

## 2. The ship override — the change is in needs-human

When `.praxis/needs-human/<change>` exists — the approver recorded ESCALATE and the hook wrote
the marker; a ledger `stage: needs-human` alone is not it, that field is yours and unlocks
nothing — the person is deciding to ship anyway. The script writes `specs/<change>/decision.md`
with `verdict: APPROVE (human)` and the ledger's round, removes the marker, sets
`stage: implemented` in the ledger, and prints a `ship:` block with two commands. Then:

1. Run the two commands it printed, in the project directory, exactly as printed — every value
   is already single-quoted and validated by the script; do not rebuild the lines from the
   change name: `git push -u origin 'praxis/<change>'` and `gh pr create --base '<base>' --head
   'praxis/<change>' --title '<the spec's Goal, first line>' --body '<links to spec.md and
   decision.md>'`. The base is the branch the worktree was cut from (recorded by
   `scripts/worktree.sh`, else the ledger's `base:`). The ship gate in `hooks/pre-tool-use`
   allows both on `APPROVE (human)`, whatever the lenses recorded.
2. Set `stage: shipped` in `specs/<change>/implementation.md` with the PR URL on the same line
   or under Session Notes. The ledger is yours; the two markers and `decision.md` were not.
3. Run Card: ship — the PR, the rounds, and that the approval was the person's override.

## What this is, and is not

- On Claude Code the floor asks for approval at the first source edit of a specified change;
  answering that prompt IS the approval, and `hooks/post-tool-use` writes the marker. This
  command exists for Codex, which cannot ask, for unattended runs (`/praxis:loop --approve`),
  and for the escalated change nobody but the person can move.
- The change name is the user's. If the user did not name one, ask which change — do not pick.
- This command is typed by the person. If a deny from the floor, the barrier, the round cap or
  the ship gate told you to wait for approval, waiting is the instruction; running this command
  yourself is the bypass the records exist to remove. Design: `specs/hook-owned-approval/design.md`
  (the marker) and `specs/factory-cycle/design.md` (the override); the other way out of
  needs-human is `/praxis:rework`.
