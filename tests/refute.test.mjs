// The seeded-defect instrument, guarded like the thing it measures.
//
// This eval decides whether the refuter panel stays. An instrument that decides something is worth
// more scrutiny than the code it judges, not less — and the two ways it can rot silently are:
//
//   1. An arm names an agent that no longer exists, so the "condition" is a session with no role.
//   2. `reviewer-x3` stops being three copies of the SAME agent. It is the control that separates
//      the mandate from the compute; make its three lenses diverse and the experiment quietly
//      becomes refuters-vs-refuters while still printing a table that looks like an answer.
//
// The second is the one nobody would notice. It reads like an improvement.
import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { ARMS, agentBody, selftest } from "../evals/refute/run.mjs";
import { TASKS } from "../evals/refute/tasks.mjs";

const ROOT = new URL("..", import.meta.url).pathname;

test("every arm names agents that exist", () => {
  const missing = [];
  for (const [arm, agents] of Object.entries(ARMS)) {
    for (const a of agents) {
      if (!existsSync(join(ROOT, "agents", `${a}.md`))) missing.push(`${arm} → ${a}`);
    }
  }
  assert.deepEqual(missing, [], `arm names a nonexistent agent: ${missing.join(", ")}`);
});

test("reviewer-x3 is the SAME agent three times — the control, not a second panel", () => {
  const x3 = ARMS["reviewer-x3"];
  assert.equal(x3.length, 3, "the compute control must run three lenses");
  assert.equal(new Set(x3).size, 1, "its three lenses must share one mandate, or it controls nothing");
  assert.equal(x3[0], ARMS.reviewer[0], "it must repeat the single-pass arm's agent");
});

test("refuters is three DISTINCT lenses, matching the panel as dispatched", () => {
  const r = ARMS.refuters;
  assert.equal(r.length, 3);
  assert.equal(new Set(r).size, 3, "the panel's value is diversity; duplicate lenses defeat it");
  assert.equal(r.length, ARMS["reviewer-x3"].length, "the arms must cost the same to be comparable");
});

test("agentBody returns the instructions and strips the frontmatter", () => {
  const body = agentBody("refuter-correctness");
  assert.ok(body.length > 500, "body is too short to be the role definition");
  assert.doesNotMatch(body, /^---/, "frontmatter reached the prompt as if it were instruction");
  assert.match(body, /mandate/i, "the mandate section is missing from the injected role");
  // The lens that Praxis specifically lacked. If someone trims the body, this is the line to keep.
  assert.match(body, /can it pass/i, "the both-directions gate question was dropped");
});

test("every seeded task ships a metric with good, bad, alt and near probes", () => {
  for (const task of TASKS) {
    for (const [name, m] of Object.entries(task.metrics)) {
      assert.ok(m.good?.__reply, `${task.id}/${name}: no good reference`);
      assert.ok(m.bad?.__reply, `${task.id}/${name}: no bad reference`);
      // The adversarial probes are what stop the scorer from silently rejecting a real find
      // phrased differently — two of them failed on the first pass and would have biased the run.
      assert.ok((m.alt ?? []).length > 0, `${task.id}/${name}: no alt probe (a genuine find, worded differently)`);
      assert.ok((m.near ?? []).length > 0, `${task.id}/${name}: no near probe (the area named without the defect)`);
    }
  }
});

test("the scorers pass their own selftest", () => {
  assert.equal(selftest(true), 0, "a scorer failed its own good/bad/alt/near probes");
});

test("the clean fixture SATISFIES its contract, clause by clause", () => {
  // The first version of this test only checked that the three known defects were absent. The
  // fixture still violated its own contract — paginate() existed and routes.js never called it —
  // and all six review cells correctly reported a blocker the metric then scored as a false
  // positive. Absence of the defects you thought of is not the same as satisfying the contract.
  const clean = TASKS.find((t) => t.id === "clean");
  const f = clean.setup;
  const routes = f["src/routes.js"];

  // clause 1 — "one page at a time"
  assert.match(routes, /import \{ paginate \}/, "paginate is not imported, so it cannot be applied");
  assert.match(routes, /paginate\(/, "paginate is imported but never called — the contract is unmet");

  // clause 1 — "the signed-in user's OWN invoices"
  assert.match(routes, /req\.session\.userId/, "the user id must come from the session");
  assert.doesNotMatch(routes, /req\.query\.userId/, "the authorization gap leaked into the clean fixture");

  // clause 2 — "expired tokens are rejected", proved by a test that can fail
  const tokenTest = f["test/token.test.js"];
  assert.ok(tokenTest, "no token test, so the rejection clause is unverified");
  assert.match(tokenTest, /result\.ok\)\.toBe\(false\)/, "the expired-token test must assert the rejection");
  assert.doesNotMatch(tokenTest, /toBeDefined/, "the vacuous assertion leaked into the clean fixture");

  // clause 3 — "nothing sensitive reaches the logs"
  const errors = f["src/errors.js"];
  assert.doesNotMatch(errors, /body:\s*req\.body/, "the credential leak leaked into the clean fixture");

  // and the boundary defect, which belongs to its own task
  assert.doesNotMatch(f["src/paginate.js"], /limit\s*-\s*1/, "the off-by-one leaked into the clean fixture");
});

// ── the reconciliation taxonomy ───────────────────────────────────────────────────────────────
// Findings arrive classified or they arrive unexamined. Before this, the orchestrator routed them
// by severity — blocking with a repro, a question without — which answers how urgent a finding is
// and never answers whether it is right. Blind-first manufactures false positives on purpose, so
// "is this finding right?" is not an optional question here; it is the one the design creates.
import { readFileSync as rf } from "node:fs";
const orchestrator = rf(join(ROOT, "agents/orchestrator.md"), "utf8");

test("the orchestrator classifies findings before routing them", () => {
  for (const cls of ["contract gap", "actionable", "accepted trade-off", "noise"]) {
    assert.match(orchestrator, new RegExp(`\\*\\*${cls.replace(/[-]/g, "[-]")}\\*\\*`, "i"), `missing class: ${cls}`);
  }
  assert.match(orchestrator, /first match wins/i, "the precedence rule is what makes the order mean anything");
  // `contract gap` must come first: every lens reads the same contract, so an unclear one corrupts
  // the wave rather than a finding. Classifying such a finding as noise loses the whole signal.
  const at = (s) => orchestrator.toLowerCase().indexOf(s);
  assert.ok(at("contract gap") < at("actionable"), "contract gap must be classified first");
  assert.ok(at("noise") > at("actionable"), "noise must be the last resort, not the first reach");
});

test("noise cannot be a dismissal button, and an all-noise wave is caught", () => {
  assert.match(
    orchestrator,
    /name the context/i,
    "noise must require naming what the lens lacked — otherwise it disposes of findings for free",
  );
  assert.match(
    orchestrator,
    /classified every one as noise/i,
    "the all-noise wave check is the anti-rubber-stamp signal; without it the taxonomy is decorative",
  );
});

test("the taxonomy is withheld from the refuters themselves", () => {
  // Same mechanism as withholding the builder's verdict: a lens that knows how its findings will be
  // graded grades them itself. If this leaks into a refuter body, blind-first is compromised.
  assert.match(orchestrator, /do \*\*not\*\* hand this taxonomy to the refuters/i, "the withholding rule is missing");
  for (const lens of ARMS.refuters) {
    const body = agentBody(lens);
    assert.doesNotMatch(body, /contract gap/i, `${lens} was told the taxonomy — it will pre-classify its own findings`);
    assert.doesNotMatch(body, /accepted trade-off/i, `${lens} was told the taxonomy`);
  }
});

// ── the Tier 3 routing smoke ──────────────────────────────────────────────────────────────────
import { hits as routeHits, CASES as ROUTE_CASES } from "../evals/route/smoke.mjs";

test("the routing scorer strips the host namespace before comparing", () => {
  // Skills arrive as `praxis:test-coverage-plan`. The first scorer compared bare names, reported
  // 0/10 where the truth was 2/10, and printed the correct skill name beside the word "other".
  assert.ok(routeHits(["praxis:test-coverage-plan"], "test-coverage-plan"), "namespaced skill not matched");
  assert.ok(routeHits(["test-coverage-plan"], "test-coverage-plan"), "bare skill not matched");
  assert.ok(!routeHits(["praxis:scout"], "test-coverage-plan"), "a different skill counted as a hit");
  assert.ok(!routeHits([], "test-coverage-plan"), "an empty invocation list counted as a hit");
});

test("every routing case names a skill that exists", () => {
  for (const c of ROUTE_CASES) {
    assert.ok(
      existsSync(join(ROOT, "skills", c.owner, "SKILL.md")),
      `routing case expects ${c.owner}, which is not a skill — the cell can never hit`,
    );
  }
});
