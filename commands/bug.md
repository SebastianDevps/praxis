---
description: Run the bug pipeline (reproduce → diagnose → fix → verify).
---

Run the `bug` pipeline (see `pipelines/bug.md`). This same workflow also triggers from a natural-language prompt matching "bug", "fix bug", "not working", or similar.

All workflow logic lives in the pipeline. This command is a thin trigger only.
