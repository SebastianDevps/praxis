---
description: Run the bug pipeline (reproduce → diagnose → fix → verify).
---

Run the `bug` pipeline (see `pipelines/bug.md`). This same workflow also triggers from a natural-language prompt matching "bug", "fix bug", "not working", or similar.

Artifacts: `specs/<change>/` — which phase writes which file is the pipeline's Artifacts table. The deliverable is the report in the pipeline's Output contract: thesis in the title, a deterministic repro without credentials, expected vs actual, why it escaped, which bug it is not, exit code as the assertion.

All workflow logic lives in the pipeline. This command is a thin trigger only.
