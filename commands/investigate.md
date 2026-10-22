---
description: Run the investigation pipeline (scope → sweep → assess → synthesize → verdict) on a target you do not own — a repo URL, a package name, a product, or a technology.
---

Dispatch the `analyst` agent against `<target>` — a repo URL, a package name, a product, or a technology. It runs scope → sweep → assess → synthesize → verdict: the query class and the tool budget are `agents/analyst.md`'s, the methods are the four skills' (`project-teardown`, `dependency-adoption`, `architecture-evaluation`, `buy-vs-build`), each run or reported `SKIP` with the reason, by name. This is not the build cycle: nothing is built, reviewed by lenses, or shipped. This same workflow also triggers from a natural-language prompt matching "take apart this repo", "should we adopt this", "build or buy", or similar.

Artifacts: `specs/<change>/implementation.md` — one task per applicable skill with its `verify:` line and evidence (`spec-lifecycle`). The deliverable is the dossier: every section filled with a citation (`path:line` or URL), `SKIP` with the reason it could not run, or `GAP` with what it had nothing to check against, closing on one `VERDICT` and the `OVERTURNED BY` finding that would flip it.

All workflow logic lives in the agent and its skills. This command is a thin trigger only.
