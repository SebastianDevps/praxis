---
description: Run the investigation pipeline (scope → sweep → assess → synthesize → verdict) on a target you do not own — a repo URL, a package name, a product, or a technology.
---

Run the `investigation` pipeline (see `pipelines/investigation.md`) against `<target>` — a repo URL, a package name, a product, or a technology. This same workflow also triggers from a natural-language prompt matching "take apart this repo", "should we adopt this", "build or buy", or similar.

Artifacts: `specs/<change>/` — which phase writes which file is the pipeline's Artifacts table. The deliverable is the dossier in the pipeline's Output contract: every section filled with a citation, `SKIP` with the reason, or `GAP` with what it had nothing to check against, closing on one verdict and the finding that would overturn it.

All workflow logic lives in the pipeline. This command is a thin trigger only.
