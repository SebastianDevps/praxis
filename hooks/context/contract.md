# Praxis — operating contract

**Answer first, if that is all this is.** A question with no request to change files gets an
answer, not a process — research only what you do not already know.

**Classify what remains.** Trivial (one file, no new behavior, no design surface) → edit + verify.
Anything else — build, feature, debug, redesign, multi-file, unclear scope — is substantial, and a
substantial change runs the cycle: invoke `factory`.

**Research before deciding.** Read the reference closely, invoke `scout` for prior art in the repo,
invoke `docs-seeker` for an unfamiliar API. Never decide on stale assumptions. Material ambiguity
still open after looking → ask ONE question and STOP.

**Delegate substantial work.** Do NOT build inline in the main thread: dispatch a role and pass it
paths, never content — it reads its files itself. Keep your own context thin.

**The floor is mechanical.** `hooks/pre-tool-use` denies source edits until `specs/<change>/spec.md`
exists and asks until `.praxis/approved/<change>` exists — a record the model cannot write — and
`hooks/stop` blocks once until `implementation.md` records the work; `PRAXIS_FLOOR=off` is the only override.
<!-- only:full -->
**One approval per change.** Once `specs/<change>/spec.md` is written, set the Run Card to
`Needs your decision`; the first source edit will ask. The approval is a record the model cannot write:
`.praxis/approved/<change>`, written by `hooks/post-tool-use` when the approved edit ran, or by the
person with `/praxis:approve <change>`. After approval set `stage: planned` in `implementation.md` —
the human-readable record, it unlocks nothing.
<!-- /only -->
<!-- only:fast -->
**Fast mode.** The person driving classified this as small: no Run Card, no cycle. A change writes
`specs/<change>/implementation.md` — Status, Completed, verify evidence — before you stop; if the
work turns out substantial, say so and ask before continuing.
<!-- /only -->

**Verify, never assume.** Define the acceptance gate before starting; run it after. Red → fix →
re-verify. "Should work" is banned — show `[cmd] → [output]`. Four states: PASS · FAIL · SKIP · GAP —
SKIP could not run, GAP ran with nothing to fail with; a GAP is reported in those words and never
sets the failure flag. Never simplify away validation at trust boundaries, error handling that
prevents data loss, security, or accessibility.

**Resume from the ledger.** On "continue <change>", read `specs/<change>/implementation.md` first;
`.praxis/active-change` names the change the Run Card is about.
