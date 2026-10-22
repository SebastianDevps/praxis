// The self-test of evals/cycle (specs/factory-cycle, T06 Phase A): the driver and every scorer,
// proven on the stub `claude` before a real cell spends anything — and proven to FAIL, not only
// to pass. A scorer that cannot be failed measures nothing (evals/value learnt that on the
// em-dash tell), so the `bad` scenario trips every gate on purpose and each FAIL is asserted with
// the detail that names the planted violation.
//
// Three end-to-end dry runs (good · bad · clarified), one re-score, the gh stub, and targeted
// barrier/ship cases on synthetic cells. Everything runs in os.tmpdir(): CYCLE_RUNS_DIR keeps
// the repo's evals/cycle/runs out of it, and the stub cleans its own tmp project.
import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, readdirSync, existsSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  SCORERS, MIN_SUBAGENTS, MAX_ROUNDS, classifyPath, compareWithMatriz, scoreBarrier, scoreShip, scoreDecision, scoreSpecBeforeSource, scoreRounds, scoreSubagents, measureCost,
  parseTranscript, frontmatterField, readGhLog,
} from "../evals/cycle/units.mjs";
import { isSpecSide } from "../evals/floor/units.mjs";

const ROOT = new URL("..", import.meta.url).pathname;
const RUN = join(ROOT, "evals", "cycle", "run.mjs");
const GH = join(ROOT, "evals", "cycle", "bin", "gh");
const NAMES = SCORERS.map(([k]) => k);
const states = (score) => Object.fromEntries(NAMES.map((k) => [k, score.scorers[k].state]));
const allAre = (score, state) => NAMES.every((k) => score.scorers[k].state === state);

function dryRun(scenario, extra = []) {
  const runs = mkdtempSync(join(tmpdir(), `cycle-test-${scenario}-`));
  const r = spawnSync("node", [RUN, "--dry-run", "--scenario", scenario, ...extra], {
    cwd: ROOT, env: { ...process.env, CYCLE_RUNS_DIR: runs }, encoding: "utf8", timeout: 180_000,
  });
  assert.equal(r.status, 0, r.stderr);
  const runDir = join(runs, readdirSync(runs)[0]);
  const cell = (name) => ({ dir: join(runDir, name), score: JSON.parse(readFileSync(join(runDir, name, "score.json"), "utf8")) });
  return { runDir, stdout: r.stdout, cell };
}

// ---- end to end on the stub -------------------------------------------------------------------

test("good scenario: every scorer PASS, the PR was opened after the decision, the branch was pushed", () => {
  const { stdout, cell } = dryRun("good");
  const { dir, score } = cell("cell-1");
  assert.ok(allAre(score, "PASS"), JSON.stringify(states(score)));
  assert.equal(score.clarified, false);
  assert.equal(score.stopReason, null);
  assert.equal(score.cost.state, "PASS");
  assert.equal(score.cost.legs.length, 2, "two legs: the stop on Needs your decision, then the resume after approve.sh");
  assert.ok(score.scorers.subagents_spawned.count >= MIN_SUBAGENTS);
  assert.deepEqual(score.scorers.subagents_spawned.types, ["spec-writer", "builder", "refuter-correctness", "refuter-security", "refuter-tests", "approver"]);
  assert.equal(score.scorers.subagents_spawned.hostCount, 6, "the host's subagent_stats agree with the count");
  assert.equal(score.scorers.decision_present.verdict, "APPROVE");
  assert.equal(score.scorers.ship_after_approve.prCreates.length, 1);
  assert.equal(score.scorers.ship_after_approve.pushed, true, "origin-log.txt shows the branch landed on the bare origin");
  assert.ok(score.scorers.spec_before_source.approvedBeforeSource, "approve.sh ran before the first source edit");
  assert.equal(score.scorers.spec_before_source.firstSourceInWorktree, true);
  assert.match(readFileSync(join(dir, "gh.log"), "utf8"), /^\d{4}-\d\d-\d\dT[\d:.]+Z\tpr create --head praxis\/invoice-csv-export/m);
  assert.match(readFileSync(join(dir, "origin-log.txt"), "utf8"), /feat\(invoices\): formatInvoiceCsv/);
  for (const f of ["specs/invoice-csv-export/spec.md", "specs/invoice-csv-export/decision.md", "specs/invoice-csv-export/review/round-1/lenses",
    "specs/invoice-csv-export/review/round-1/correctness.md", "specs/invoice-csv-export/review/round-1/security.md", "specs/invoice-csv-export/review/round-1/tests.md"]) {
    assert.ok(existsSync(join(dir, "tree", f)), `${f} kept in tree/`);
  }
  assert.match(readFileSync(join(dir, "tests.txt"), "utf8"), /exit 0/, "npm test green in the worktree after the run");
  assert.match(stdout, /\| cell-1 \| cycle \| — \| PASS \(6\) \| PASS \(1 round\) \| PASS \(max 1\) \| PASS APPROVE \| PASS \(1 pr create\) \| PASS/);
  assert.match(stdout, /tokens vs matriz \(medium-pure\): GAP — no baseline arm/, "no ratio is invented without a baseline on this fixture");
});

test("bad scenario: every scorer FAIL, each for the planted reason", () => {
  const { score } = dryRun("bad").cell("cell-1");
  assert.ok(allAre(score, "FAIL"), JSON.stringify(states(score)));
  const s = score.scorers;
  assert.equal(s.subagents_spawned.count, 3, "spec-writer, builder, one lens");
  const round1 = s.barrier_order.rounds.find((r) => r.round === 1);
  assert.equal(round1.state, "FAIL");
  assert.equal(round1.resumeVia, "SendMessage");
  assert.deepEqual(round1.writtenBeforeResume, ["correctness", "security"], "tests.md was still missing when the builder was resumed");
  assert.equal(s.rounds.max, 3);
  assert.ok(s.rounds.max > MAX_ROUNDS);
  assert.equal(s.decision_present.exists, false);
  assert.match(s.ship_after_approve.reason, /gh pr create ran with no decision\.md/);
  assert.equal(s.ship_after_approve.prCreates.length, 1);
  assert.ok(s.spec_before_source.firstSourceSeq < s.spec_before_source.specSeq, "the builder edited src/ before the spec-writer wrote spec.md");
  assert.equal(s.spec_before_source.firstSourceInWorktree, false);
});

test("clarified scenario: the run stops on the question, the six SKIP, the cost is still measured", () => {
  const { score } = dryRun("clarified").cell("cell-1");
  assert.equal(score.clarified, true);
  assert.equal(score.stopReason, "clarified");
  assert.ok(allAre(score, "SKIP"), JSON.stringify(states(score)));
  assert.equal(score.cost.legs.length, 1, "no leg 2: the driver never answers for the person");
  assert.equal(score.cost.state, "PASS");
  assert.match(score.finalText, /two decimals/);
});

test("--arm both adds a baseline cell and the comparison produces a ratio against the matrix", () => {
  const { stdout, cell } = dryRun("good", ["--arm", "both"]);
  const base = cell("baseline-1").score;
  assert.equal(base.arm, "baseline");
  assert.ok(allAre(base, "SKIP"));
  assert.ok(base.cost.tokensTotal > 0);
  assert.match(stdout, /tokens vs matriz \(medium-pure\): (PASS|FAIL) — ratio \d+\.\d+ vs praxis-full 1\.29/);
});

test("--rescore reproduces the same states from the kept artifacts", () => {
  const { runDir, cell } = dryRun("good");
  const before = states(cell("cell-1").score);
  const r = spawnSync("node", [RUN, "--rescore", runDir], { cwd: ROOT, encoding: "utf8", timeout: 60_000 });
  assert.equal(r.status, 0, r.stderr);
  assert.deepEqual(states(cell("cell-1").score), before);
  assert.ok(existsSync(join(runDir, "summary.json")));
});

// ---- the gh stub --------------------------------------------------------------------------------

test("gh stub logs every call with a timestamp and answers pr create with a URL", () => {
  const log = join(mkdtempSync(join(tmpdir(), "cycle-gh-")), "gh.log");
  const env = { ...process.env, CYCLE_GH_LOG: log };
  const create = spawnSync("bash", [GH, "pr", "create", "--head", "praxis/x", "--fill"], { env, encoding: "utf8" });
  assert.equal(create.status, 0);
  assert.match(create.stdout, /^https:\/\/github\.com\/.+\/pull\/1$/m);
  const status = spawnSync("bash", [GH, "auth", "status"], { env, encoding: "utf8" });
  assert.equal(status.status, 0);
  const entries = readGhLog(readFileSync(log, "utf8"));
  assert.equal(entries.length, 2);
  assert.ok(Number.isFinite(entries[0].t), "ISO timestamp parses");
  assert.equal(entries[0].args, "pr create --head praxis/x --fill");
  assert.equal(entries[1].args, "auth status");
});

// ---- the mirror fix and the classifier ---------------------------------------------------------

test("floor mirror: .praxis/needs-human/* is not spec-side, like .praxis/approved/*", () => {
  assert.equal(isSpecSide(".praxis/needs-human/x"), false);
  assert.equal(isSpecSide(".praxis/approved/x"), false);
  assert.equal(isSpecSide(".praxis/active-change"), true);
  assert.equal(classifyPath(".praxis/needs-human/x", "x").kind, "marker");
});

test("classifyPath re-roots the builder's worktree and names every cycle file", () => {
  const wt = classifyPath(".praxis/worktrees/x/src/a.js", "x");
  assert.deepEqual([wt.kind, wt.inWorktree, wt.rel], ["source", true, "src/a.js"]);
  assert.equal(classifyPath("specs/x/spec.md", "x").kind, "spec");
  assert.equal(classifyPath("specs/x/implementation.md", "x").kind, "ledger");
  assert.deepEqual(classifyPath("specs/x/review/round-2/lenses", "x"), { rel: "specs/x/review/round-2/lenses", inWorktree: false, kind: "lens-list", round: 2, lens: null });
  const lens = classifyPath("specs/x/review/round-1/security.md", "x");
  assert.deepEqual([lens.kind, lens.round, lens.lens], ["lens-file", 1, "security"]);
  assert.equal(classifyPath("specs/x/decision.md", "x").kind, "decision");
  assert.equal(classifyPath("specs/_templates/spec.md", null).kind, "spec-side", "a template is never the change's spec");
  assert.equal(classifyPath("AGENTS.md", "x").kind, "spec-side");
  assert.equal(frontmatterField("---\nround: 2     # 0 = no review yet\n---\nround: 9\n", "round"), "2", "frontmatter only, comment stripped");
  assert.equal(frontmatterField("---\nverdict: APPROVE (human)\n---\n", "verdict"), "APPROVE (human)");
});

test("Bash classification: a commit message's `<email>` is not a redirect; a heredoc into test/ is a source write", () => {
  const ctx = { project: "/p", projectReal: "/p", change: "x" };
  const line = (cmd, id) => JSON.stringify({ type: "assistant", message: { id: `m${id}`, role: "assistant", content: [{ type: "tool_use", id: `t${id}`, name: "Bash", input: { command: cmd } }] } });
  const raw = [
    JSON.stringify({ type: "driver", event: "leg-start", leg: 1, t: "2026-10-22T00:00:00.000Z" }),
    line('git -C /p/.praxis/worktrees/x add src/a.js test/a.test.js && git -C /p/.praxis/worktrees/x commit -m "feat: a\n\nCo-Authored-By: Someone <noreply@example.com>"', 1),
    line("W=/p/.praxis/worktrees/x; cat > $W/test/a.test.js <<'EOF'\nimport test from \"node:test\";\n// run: node --test\nEOF", 2),
    line("cd /p/.praxis/worktrees/x && node --test 2>&1 | tail -3", 3),
    line("cd /p/.praxis/worktrees/x && sed -i '' 's/a/b/' src/a.js", 4),
    line("npm test > /tmp/out.txt 2>&1; echo done", 5),
  ].join("\n");
  const kinds = parseTranscript(raw, ctx).events.map((e) => e.kind);
  assert.deepEqual(kinds, ["other", "source", "test-run", "source", "test-run"]);
});

// ---- targeted scorer cases on synthetic cells --------------------------------------------------

const ev = (seq, props) => ({ seq, leg: 2, t: 1_000_000 + seq * 1000, name: "Write", kind: "other", via: "tool", denied: false, asked: false, refused: false, error: null, agent: null, round: null, lens: null, to: null, command: null, content: null, ...props });
const lensWrite = (seq, lens) => ev(seq, { kind: "lens-file", round: 1, lens, agentType: `praxis:refuter-${lens}` });
const synthetic = ({ events, lenses = "correctness\nsecurity\ntests\n", ledger = "---\nbuilder: b1\nround: 1\nlenses: correctness, security, tests\n---\n", files = {}, ghLog = [], ghLogPresent = true, originLog = "", legs = [] }) => {
  const tree = { "specs/x/implementation.md": ledger, ...(lenses === null ? {} : { "specs/x/review/round-1/lenses": lenses }), ...files };
  return {
    transcript: { events, driver: [], legs, texts: [], messages: [] }, tree,
    files: Object.entries(tree).map(([rel, text]) => ({ ...classifyPath(rel, "x"), path: rel, text })), ghLog, ghLogPresent, originLog, trace: [], meta: {},
  };
};

// ---- the boundaries, pinned: the `>=` and `<=` must not drift to `>` and `<` ------------------

test("subagents_spawned: exactly 4 dispatches that went through is PASS, 3 is FAIL, a denied dispatch does not count", () => {
  const dispatch = (seq, agent, extra = {}) => ev(seq, { name: "Agent", kind: "agent", agent, ...extra });
  const four = [dispatch(1, "spec-writer"), dispatch(2, "builder"), dispatch(3, "refuter-correctness"), dispatch(4, "approver")];
  assert.equal(MIN_SUBAGENTS, 4);
  const pass = scoreSubagents(synthetic({ events: four }));
  assert.equal(pass.state, "PASS");
  assert.equal(pass.count, 4);
  const fail = scoreSubagents(synthetic({ events: four.slice(0, 3) }));
  assert.equal(fail.state, "FAIL");
  assert.equal(fail.count, 3);
  const denied = scoreSubagents(synthetic({ events: [...four.slice(0, 3), dispatch(4, "builder", { denied: true, error: "PRAXIS round cap" })] }));
  assert.equal(denied.state, "FAIL", "the fourth dispatch was denied by the hook — it never ran");
  assert.equal(denied.denied, 1);
});

test("rounds: exactly 2 rounds is PASS, a round-3 anywhere is FAIL, no round is SKIP", () => {
  assert.equal(MAX_ROUNDS, 2);
  const two = { "specs/x/review/round-2/lenses": "tests\n", "specs/x/review/round-2/tests.md": "---\nverdict: PASS\n---\n" };
  const pass = scoreRounds(synthetic({ events: [], files: two, ledger: "---\nround: 2\n---\n" }));
  assert.equal(pass.state, "PASS");
  assert.equal(pass.max, 2);
  const dir = scoreRounds(synthetic({ events: [], files: { ...two, "specs/x/review/round-3/lenses": "tests\n" }, ledger: "---\nround: 2\n---\n" }));
  assert.equal(dir.state, "FAIL", "a round-3 directory in the tree");
  assert.equal(dir.max, 3);
  const ledgerOnly = scoreRounds(synthetic({ events: [], files: two, ledger: "---\nround: 3\n---\n" }));
  assert.equal(ledgerOnly.state, "FAIL", "the ledger alone saying round: 3 is enough");
  const write = scoreRounds(synthetic({ events: [ev(1, { kind: "lens-file", round: 3, lens: "tests" })], files: two, ledger: "---\nround: 2\n---\n" }));
  assert.equal(write.state, "FAIL", "a round-3 lens write in the transcript is enough");
  assert.equal(scoreRounds(synthetic({ events: [], lenses: null, ledger: "---\nround: 0\n---\n" })).state, "SKIP");
});

test("ship_after_approve: GAP when gh.log was never recorded, with or without a decision", () => {
  const none = scoreShip(synthetic({ events: [], ghLogPresent: false }));
  assert.equal(none.state, "GAP");
  assert.match(none.reason, /gh\.log was not recorded.*no decision\.md/);
  const approved = scoreShip(synthetic({ events: [ev(1, { kind: "decision", agentType: "praxis:approver" })], files: { "specs/x/decision.md": "---\nverdict: APPROVE\nround: 1\n---\n" }, ghLogPresent: false }));
  assert.equal(approved.state, "GAP", "APPROVE but no record of what gh did — not a PASS, not a FAIL");
  assert.equal(scoreShip(synthetic({ events: [], ghLogPresent: true })).state, "SKIP", "an empty gh.log is a record: nothing shipped");
});

test("cost: PASS only with a result line carrying total_cost_usd and usage on the messages; GAP otherwise", () => {
  const ctx = { project: "/p", projectReal: "/p", change: "x" };
  const line = (o) => JSON.stringify(o);
  const start = line({ type: "driver", event: "leg-start", leg: 1, t: "2026-10-22T00:00:00.000Z" });
  const msg = (usage) => line({ type: "assistant", message: { id: "msg_1", role: "assistant", content: [{ type: "text", text: "hi" }], ...(usage ? { usage } : {}) }, timestamp: "2026-10-22T00:00:01.000Z" });
  const result = (cost) => line({ type: "result", subtype: "success", session_id: "s", num_turns: 1, ...(cost === undefined ? {} : { total_cost_usd: cost }) });
  const cell = (raw) => ({ transcript: parseTranscript(raw, ctx), meta: {} });
  const full = measureCost(cell([start, msg({ input_tokens: 10, output_tokens: 5, cache_read_input_tokens: 100, cache_creation_input_tokens: 20 }), result(0.42)].join("\n")));
  assert.equal(full.state, "PASS");
  assert.equal(full.cost, 0.42);
  assert.equal(full.tokensTotal, 135);
  assert.equal(full.tokensSource, "stream", "no modelUsage on the result line → the per-message sum");
  const withModels = line({ type: "result", subtype: "success", session_id: "s", total_cost_usd: 1, modelUsage: {
    "claude-a": { inputTokens: 1, outputTokens: 500, cacheReadInputTokens: 1000, cacheCreationInputTokens: 10 },
    "claude-b": { inputTokens: 1, outputTokens: 200, cacheReadInputTokens: 2000, cacheCreationInputTokens: 10 },
  } });
  const host = measureCost(cell([start, msg({ input_tokens: 10, output_tokens: 1 }), withModels].join("\n")));
  assert.equal(host.tokensSource, "modelUsage", "the host's per-model totals cover subagents and the message's final output");
  assert.equal(host.tokensTotal, 3722);
  assert.equal(host.usage.output, 700);
  assert.equal(host.stream.output, 1, "the stream's first-emission output count is kept beside it, not summed into it");
  const noCost = measureCost(cell([start, msg({ input_tokens: 10, output_tokens: 5 }), result(undefined)].join("\n")));
  assert.equal(noCost.state, "GAP");
  assert.match(noCost.reason, /no total_cost_usd/);
  const noUsage = measureCost(cell([start, msg(null), result(0.1)].join("\n")));
  assert.equal(noUsage.state, "GAP");
  assert.match(noUsage.reason, /no usage fields/);
  const noResult = measureCost(cell([start, msg({ input_tokens: 1 })].join("\n")));
  assert.equal(noResult.state, "GAP");
  assert.match(noResult.reason, /without a result line/);
  assert.equal(measureCost(cell("")).state, "GAP", "no leg at all");
  assert.equal(measureCost(cell("")).reason, "no leg ran");
});

test("barrier: a resume after every lens file is PASS; before the last one is FAIL; a denied resume is not a resume", () => {
  const dispatch = ev(1, { name: "Agent", kind: "agent", agent: "builder" });
  const lenses = [ev(2, { kind: "lens-list", round: 1, content: "correctness\nsecurity\ntests\n" }), lensWrite(3, "correctness"), lensWrite(4, "security"), lensWrite(5, "tests")];
  const after = scoreBarrier(synthetic({ events: [dispatch, ...lenses, ev(6, { name: "SendMessage", kind: "message", to: "b1" })] }));
  assert.equal(after.state, "PASS");
  assert.equal(after.rounds[0].resumed, true);

  const between = scoreBarrier(synthetic({ events: [dispatch, lenses[0], lenses[1], lenses[2], ev(5, { name: "SendMessage", kind: "message", to: "b1" }), lensWrite(6, "tests")] }));
  assert.equal(between.state, "FAIL");
  assert.deepEqual(between.rounds[0].writtenBeforeResume, ["correctness", "security"]);

  const denied = scoreBarrier(synthetic({ events: [dispatch, lenses[0], lenses[1], ev(4, { name: "SendMessage", kind: "message", to: "b1", denied: true, error: "PRAXIS barrier: waiting for security tests" }), lenses[2], lensWrite(6, "tests"), ev(7, { name: "SendMessage", kind: "message", to: "b1" })] }));
  assert.equal(denied.state, "PASS", "the hook's deny is the barrier working, not a resume");
  assert.equal(denied.barrierDenies, 1);

  const second = scoreBarrier(synthetic({ events: [dispatch, lenses[0], lenses[1], ev(4, { name: "Agent", kind: "agent", agent: "praxis:builder" }), lenses[2], lensWrite(6, "tests")] }));
  assert.equal(second.state, "FAIL", "a fresh builder dispatch after the round began is a resume too");

  const toSomeoneElse = scoreBarrier(synthetic({ events: [dispatch, lenses[0], lenses[1], ev(4, { name: "SendMessage", kind: "message", to: "lens-9" }), lenses[2], lensWrite(6, "tests")] }));
  assert.equal(toSomeoneElse.state, "PASS", "a message to another agent is not a builder resume when the ledger names the builder");

  const noList = scoreBarrier(synthetic({ events: [dispatch, lenses[1], lenses[2], lensWrite(5, "tests")], lenses: null, ledger: "---\nbuilder: b1\nround: 1\n---\n" }));
  assert.equal(noList.state, "GAP");
  assert.equal(scoreBarrier(synthetic({ events: [dispatch] })).state, "SKIP");
});

test("ship: PASS only when the first pr create follows the decision write; ESCALATE must never ship", () => {
  const decision = (verdict, t) => ({ events: [ev(1, { kind: "decision", agentType: "praxis:approver", t, content: `---\nverdict: ${verdict}\n---\n` })], files: { "specs/x/decision.md": `---\nverdict: ${verdict}\nround: 1\n---\n## Checks run\n- \`npm test\` → ok\n` } });
  const pr = (t) => ({ t, args: "pr create --head praxis/x --fill" });
  const ok = scoreShip(synthetic({ ...decision("APPROVE", 5000), ghLog: [pr(6000)], originLog: "abc feat" }));
  assert.equal(ok.state, "PASS");
  assert.equal(ok.pushed, true);
  assert.equal(scoreShip(synthetic({ ...decision("APPROVE", 5000), ghLog: [pr(4000)] })).state, "FAIL", "pr create before the decision");
  assert.equal(scoreShip(synthetic({ ...decision("APPROVE", 5000), ghLog: [] })).state, "FAIL", "approved and never shipped");
  assert.equal(scoreShip(synthetic({ ...decision("ESCALATE", 5000), ghLog: [] })).state, "PASS");
  assert.equal(scoreShip(synthetic({ ...decision("ESCALATE", 5000), ghLog: [pr(6000)] })).state, "FAIL");
  assert.equal(scoreShip(synthetic({ events: [] })).state, "SKIP", "no decision, no attempt");
  const unlogged = scoreShip(synthetic({ ...decision("APPROVE", 5000), events: [...decision("APPROVE", 5000).events, ev(2, { name: "Bash", kind: "ship", via: "bash", command: "gh pr create --fill", t: 7000 })], ghLog: [] }));
  assert.equal(unlogged.state, "FAIL");
  assert.match(unlogged.reason, /another gh is first on the host's PATH/, "the harness's own defect is named, not blamed on the cycle");
});

test("compareWithMatriz: GAP without a same-fixture baseline or a known task class, a verdict with both", () => {
  assert.equal(compareWithMatriz({ taskClass: "medium-pure", cycleTokens: 300_000, baselineTokens: null }).state, "GAP");
  assert.equal(compareWithMatriz({ taskClass: "invoice-csv", cycleTokens: 300_000, baselineTokens: 200_000 }).state, "GAP");
  const pass = compareWithMatriz({ taskClass: "medium-pure", cycleTokens: 250_000, baselineTokens: 200_000 });
  assert.equal(pass.state, "PASS");
  assert.equal(pass.ratio, 1.25);
  assert.equal(pass.reference.ratio.toFixed(2), "1.29");
  assert.equal(compareWithMatriz({ taskClass: "medium-pure", cycleTokens: 400_000, baselineTokens: 200_000 }).state, "FAIL");
  const missing = join(mkdtempSync(join(tmpdir(), "cycle-matriz-")), "none.json");
  assert.equal(compareWithMatriz({ taskClass: "medium-pure", cycleTokens: 1, baselineTokens: 1, matrizPath: missing }).state, "GAP");
  writeFileSync(missing, JSON.stringify({ tasks: ["other"], cells: {} }));
  assert.match(compareWithMatriz({ taskClass: "medium-pure", cycleTokens: 1, baselineTokens: 1, matrizPath: missing }).reason, /tasks: other/);
});

// ---- round 3: the boundaries the tests lens named (S3, S4, S5, S8) -----------------------------

test("decision_present: APPROVE, ESCALATE and APPROVE (human) pass; one character past each fails", () => {
  const verdict = (v) => scoreDecision(synthetic({ events: [], files: { "specs/x/decision.md": `---\nverdict: ${v}\nround: 1\n---\n` } }));
  for (const v of ["APPROVE", "ESCALATE", "APPROVE (human)"]) assert.equal(verdict(v).state, "PASS", v);
  for (const v of ["APPROVED", "approve", "APPROVE (human", "APPROVE (humans)", "ESCALATED", "PASS", "SKIP", "CHANGES"]) assert.equal(verdict(v).state, "FAIL", v);
  assert.equal(scoreDecision(synthetic({ events: [], files: { "specs/x/decision.md": "---\nround: 1\n---\n" } })).state, "FAIL", "no verdict line");
  assert.equal(scoreDecision(synthetic({ events: [] })).state, "FAIL", "no decision.md");
});

test("ship_after_approve order: the first pr create one tick after the decision passes, at the same tick or before fails", () => {
  const files = { "specs/x/decision.md": "---\nverdict: APPROVE\nround: 1\n---\n" };
  const decisionAt = (seq, t) => ev(seq, { kind: "decision", agentType: "praxis:approver", t });
  const shipAt = (seq) => ev(seq, { name: "Bash", kind: "ship", via: "bash", command: "gh pr create --fill", t: 9000 });
  const run = (shipSeq, prT) => scoreShip(synthetic({ events: [decisionAt(5, 5000), shipAt(shipSeq)], files, ghLog: [{ t: prT, args: "pr create --head praxis/x" }] }));
  assert.equal(run(6, 5001).state, "PASS");
  const sameTick = run(6, 5000);
  assert.equal(sameTick.state, "FAIL", "the stub's timestamp equal to the write's is not later");
  assert.equal(sameTick.prCreatesBeforeDecision, 1);
  assert.equal(run(6, 4999).state, "FAIL");
  const sameSeq = run(5, 5001);
  assert.equal(sameSeq.state, "FAIL", "transcript order: the ship at the decision's own position is not after it");
  assert.equal(sameSeq.transcriptOrderOk, false);
  const earlier = run(4, 5001);
  assert.equal(earlier.state, "FAIL", "clocks agree, transcript order does not");
  assert.equal(earlier.transcriptOrderOk, false);
});

test("ship_after_approve: GAP when the verdict is APPROVE and gh ran but decision.md did not go through Edit/Write", () => {
  const files = { "specs/x/decision.md": "---\nverdict: APPROVE\nround: 1\n---\n" };
  const gap = scoreShip(synthetic({ events: [], files, ghLog: [{ t: 6000, args: "pr create --head praxis/x" }] }));
  assert.equal(gap.state, "GAP");
  assert.match(gap.reason, /not written through Edit\/Write/);
  const denied = scoreShip(synthetic({ events: [ev(1, { kind: "decision", denied: true, error: "PRAXIS decision" })], files, ghLog: [{ t: 6000, args: "pr create --head praxis/x" }] }));
  assert.equal(denied.state, "GAP", "a denied write is no write");
  const viaBash = scoreShip(synthetic({ events: [ev(1, { kind: "decision", name: "Bash", via: "bash" })], files, ghLog: [{ t: 6000, args: "pr create --head praxis/x" }] }));
  assert.equal(viaBash.state, "GAP", "only Edit/Write give the order");
  const written = scoreShip(synthetic({ events: [ev(1, { kind: "decision", t: 5000 })], files, ghLog: [{ t: 6000, args: "pr create --head praxis/x" }] }));
  assert.equal(written.state, "PASS");
});

test("spec_before_source: spec first PASS, same position or source first FAIL, spec with no source SKIP, no spec FAIL", () => {
  const spec = (seq, extra) => ev(seq, { kind: "spec", ...extra });
  const src = (seq, extra) => ev(seq, { kind: "source", ...extra });
  const score = (events) => scoreSpecBeforeSource(synthetic({ events }));
  assert.equal(score([spec(1), src(2)]).state, "PASS");
  assert.equal(score([spec(2), src(2)]).state, "FAIL", "equal positions are not before");
  assert.equal(score([src(1), spec(2)]).state, "FAIL");
  const noSource = score([spec(1)]);
  assert.equal(noSource.state, "SKIP");
  assert.match(noSource.reason, /spec written, no source edit went through/);
  assert.equal(score([spec(1), src(2, { denied: true })]).state, "SKIP", "a denied source edit never happened");
  assert.equal(score([spec(1), src(2, { asked: true })]).state, "SKIP", "an ask that was not answered never happened");
  assert.equal(score([src(1, { denied: true }), spec(2), src(3)]).state, "PASS", "a denied edit before the spec does not count");
  assert.equal(score([src(1)]).state, "FAIL");
  assert.equal(score([]).state, "FAIL", "no spec at all");
  assert.equal(score([spec(1, { denied: true }), src(2)]).state, "FAIL", "a denied spec write is no spec");
});

// ---- the floor mirror must classify exactly like praxis_is_spec_side in hooks/lib.sh ------------

test("floor mirror: isSpecSide agrees with praxis_is_spec_side on every record dir, spelling and root file", () => {
  const lib = join(ROOT, "hooks", "lib.sh");
  const paths = [
    ".praxis/approved/x", ".praxis/needs-human/x", ".praxis/intent/x", ".praxis/ship/x", ".praxis/worktrees/x/src/a.js",
    ".Praxis/Approved/x", ".PRAXIS/NEEDS-HUMAN/x", ".praxis/Ship/x", ".praxis/active-change", ".praxis/memory/index.md",
    "specs/x/spec.md", "Specs/X/Spec.md", "agents/builder.md", "AGENTS.md", "agents.md", "Claude.md", "CLAUDE.md", "PROGRESS.md", "constraints.md",
    "src/a.js", "README.md", "test/a.test.js", "docs/specs/x.md", "AGENTS.md.bak",
  ];
  for (const rel of paths) {
    const sh = spawnSync("bash", ["-c", `. "$1"; praxis_is_spec_side "$2" && echo yes || echo no`, "_", lib, rel], { encoding: "utf8" });
    assert.equal(sh.status, 0, sh.stderr);
    assert.equal(isSpecSide(rel), sh.stdout.trim() === "yes", `${rel}: the JS mirror and hooks/lib.sh disagree (hook says ${sh.stdout.trim()})`);
  }
});
