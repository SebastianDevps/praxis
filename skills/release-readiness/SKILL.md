---
name: release-readiness
description: Use when a change is about to be released — merged, deployed, or handed to a person — and the question is the project's standing release floor rather than this task's acceptance criteria: rollback path, post-deploy evidence, smallest increment. NOT the threat surface (that is `security`), NOT writing that floor down in the first place (that is `quality-bar`).
kind: skill
od:
  category: engineering
  triggers:
    - "ready to ship"
    - release
    - deploy
    - "cut a release"
    - "go live"
    - "rollback plan"
---

## Two different bars

The Run Card's `verify:` is the acceptance criteria for **this** task. It changes every task, and
it answers one question: did we build the right thing?

The release floor is the standard **every** release meets. It does not change between changes, and
it answers a different question: is this finished to our standard? A passing `verify:` says the
feature works. It says nothing about whether anyone can turn it off at 3am.

Producing that floor as a written artifact is `quality-bar`'s job — it interviews, measures, and
records the numbers. What matters at the ship moment is only that the floor already exists and is
not reopened here: if an item genuinely does not apply, say so out loud and record why.

## The three properties

Every release needs all three. They are independent — having two is not close.

**Reversible.** Someone has walked the rollback path end to end and can name the command, the
window, and what does not come back. A deploy that only rolls forward is not reversible. If a
migration ran, the code revert is half of it: name what happens to rows written under the new
schema, and whether the old code can read them.

**Observable.** Evidence you can read *after* the release, not just before. Name the signal that
tells you it worked, the signal that tells you it broke, and where each is visible. "The tests
passed" is pre-release evidence; it cannot tell you anything at 3am. If nothing emits a signal on
the new path, the release is unobservable and you are relying on a user to report the outage.

Naming the signal is half of it. Instrumentation is code and can be wrong, so prove it: induce a
failure in staging and locate it from telemetry alone, without reading the source. A signal nobody
has watched fire is a plan, not evidence.

**Incremental.** The smallest change that delivers the value, released on its own. Three unrelated
changes in one deploy means a rollback takes out two things that were fine, and a regression takes
an afternoon to bisect. Split by what can be reverted independently.

## Alert on symptoms, not causes

Page-worthy is what a user feels: an error rate above its threshold sustained over minutes, p99
latency past its budget, queue age growing. Dashboard-only is what a machine feels: CPU at 85%, a
pod restarted, disk at 70%. Cause-based alerts fire when nothing is wrong and miss the failures
nobody predicted. Two severities only — page and ticket; a third tier trains people to ignore all
three. Take the shape from here and the numbers from the service's own SLO — an error budget and a
latency objective are operational commitments, not code-quality gates, so they do not live in
`CONSTRAINTS.md` and `quality-bar` will not hand them to you.

## Ship is not "the tests pass"

Verify already ran — that was the `verify` phase, and it ended before this one started. Ship is the
handoff: the change moves to somewhere you no longer control, and the phase's whole subject is what
happens *after* that moment.

This is also not the pre-delivery output check in `frontend-design`, which confirms an artifact is
good enough to leave the session. That is verify wearing a similar name. Ship starts once the thing
is already good and the question is who now owns it, how they see it working, and how they undo it.

Two adjacent floors are owned elsewhere and are not restated here: the threat surface belongs to
`security`, and accessibility to the always-injected `a11y-baseline` craft. Both are release-floor
items; read them there.

## Red flags

Each of these is a rationalization that sounds like a plan.

| Said | Why it does not hold |
|---|---|
| "We'll add monitoring after launch" | The window you most need signal in is the first hour. Monitoring added later cannot observe the release it was added for. |
| "The rollback is just a revert" | Only if nothing persisted. A migration, a written cache, or a message on a queue survives the revert and meets old code that cannot read it. |
| "It's behind a flag, so it's safe" | A flag nobody has tested with the flag off is untested code plus an untested branch. Exercise both sides before you rely on the switch. |
| "It's a small change" | Size predicts blast radius poorly. A one-line config change takes down more systems than most features. |
| "We'll document it after" | The handoff is the release. If the person receiving it cannot operate it, it was not handed over. |
| "Staging was green" | Staging shares neither the data nor the traffic. It rules some failures out; it confirms nothing about production. |
| "Nothing else calls it yet" | A public interface has callers you did not write. Any change to a signature, a field, or a default answers "does the existing caller still compile?" before it ships — and when the answer is no, that migration *is* the release, not a footnote to it. |
