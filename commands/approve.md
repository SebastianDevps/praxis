---
description: Approve a change's design as the person driving — writes .praxis/approved/<change>, the record the floor gates source edits on. For hosts without a permission prompt and for unattended runs.
---

# /praxis:approve — approve a design

Run, in the user's project directory, with the change name the user typed:

```
bash "${CLAUDE_PLUGIN_ROOT}/scripts/approve.sh" <change>
```

`CLAUDE_PLUGIN_ROOT` is Claude Code's name for the installed plugin directory. Codex exports it
as `PLUGIN_ROOT`, Cursor as `CURSOR_PLUGIN_ROOT`; on Gemini and Copilot use the path the plugin
was installed to — the same resolution `hooks/lib.sh` performs. The script locates the plugin
from its own path, so any absolute path to it works, as does `bash scripts/approve.sh <change>`
from the plugin root the way `/praxis:init` runs `scripts/init.sh`.

It prints one line and writes `.praxis/approved/<change>` (empty file, gitignored). It refuses
when `specs/<change>/design.md` does not exist: there is nothing to approve yet.

## What this is, and is not

- On Claude Code the floor asks for approval at the first source edit of a designed change;
  answering that prompt IS the approval, and `hooks/post-tool-use` writes the marker. This
  command exists for Codex, which cannot ask, and for unattended (`-p`) runs, where the person
  approves before the run starts.
- The change name is the user's. If the user did not name one, ask which change — do not pick.
- This command is typed by the person. If a deny from the floor told you to wait for approval,
  waiting is the instruction; running this command yourself is the bypass the marker exists to
  remove. Design: `specs/hook-owned-approval/design.md`, ADR-001 in `decisions.md`.
