# Eval — Live primed end-to-end build (the full loop on a real high-engineering task)

> Date: 2026-06-25 · Under test: the WHOLE Praxis loop in a LIVE primed session (not a content-following subagent) · Task: build a team Claude-usage monitoring system (Go agent + ingest server + Postgres + dashboard). Method: observed the live run; verified the output builds/tests and runs on real data.

## Why this eval matters
The other 4 evals proved pieces (activation, taste, clarify) via content-following subagents. This is the missing confirmation: the full loop firing **unbidden in a live primed session**, on a real multi-file engineering task — the exact scenario that FAILED inline twice before the execution architecture was fixed.

## What was observed (the loop, end to end)
1. **Research (beat the brief).** Scanned ~902 real `.jsonl` files, verified the schema. Found what the user's own brief missed: `cache_creation` splits into `ephemeral_1h` (~2× input) and `ephemeral_5m` (~1.25×) → **5 priced token counters, not 4**; and `isSidechain` subagent transcripts are **billable** (must include, not filter).
2. **Clarify.** Asked ONE material question (prompt-storage granularity — changes the DB schema + privacy weight) before planning. Did not over-interrogate.
3. **Plan.** Wrote `PLAN.md` = **14 bite-sized tasks**, each with files + verification criteria + a dependency graph with parallel waves. Not a vague 4-bullet plan.
4. **Verifier integrity.** Pinned a **real `.jsonl` fixture** (2 assistant lines with the 5 counters) so parser tests run against the true schema, not synthetic — the anti-reward-hacking discipline applied unprompted.
5. **Subagent-driven execution.** 14 real `praxis:engineer` dispatches, one per task, review between each (T1 compiled green before T2 started). **No inline Write-after-Write; no context rot** — the fix for the prior 13-min degraded run.
6. **Learning.** Saved the non-obvious schema finding as a reusable memory — the `/learn`-style compounding firing on its own.

## Verified result (measured, not claimed)
- `go build ./...` ✅ · `go vet ./...` ✅ · `go test ./...` ✅
- Parser ran on **73,851 real usage events** without breaking (handles ~10 line types, lines >64KB, the 5 counters with 1h/5m split).
- **Real-data value:** found model ids carry a date suffix (`claude-haiku-4-5-20251001`) → 3,457 events were costing $0 → fixed with normalization. Cache 1h/5m split is large in real data (345M vs 158M tokens). Notional cost computed: ~$45,168 USD. Only `<synthetic>` left unpriced (test rows — correct).

## Verdict
**PASS — the arc is closed.** The full Praxis loop fired end-to-end in a live primed session and produced a verified, real-value system. Confirms the honest architecture: **priming reliably drives the "before" (research + clarify); the execution discipline (plan → subagent-driven) works when invoked explicitly** in the prompt — and when it does, it delegates per task instead of going inline, avoiding the context rot that broke the earlier attempts.

## Pending (handed to the user)
- Validate `pricing.yaml` reference rates against the team's actual Anthropic billing/contract before trusting the cost figures (enterprise rates may differ; the build used authoritative public rates).
- Optional: a Postgres integration test (`PLUTOLIO_TEST_DB`) to close the last coverage gap on the ingest path.
