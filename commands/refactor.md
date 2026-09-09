---
description: Run the refactor pipeline (assess → plan → refactor → verify).
---

Run the `refactor` pipeline (see `pipelines/refactor.md`). This same workflow also triggers from a natural-language prompt matching "refactor", "restructure", "clean up", or similar.

Artifacts: `specs/<change>/` — which phase writes which file is the pipeline's Artifacts table.

All workflow logic lives in the pipeline. This command is a thin trigger only.
