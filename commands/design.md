---
description: Run the design pipeline (brief → explore → implement → review).
---

Run the `design` pipeline (see `pipelines/design.md`). This same workflow also triggers from a natural-language prompt matching "design", "ui design", "design component", or similar.

Artifacts: `specs/<change>/` — which phase writes which file is the pipeline's Artifacts table.

All workflow logic lives in the pipeline. This command is a thin trigger only.
