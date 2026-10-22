// `/praxis:approve` writes the records the model must not. Two of them:
//
// 1. `.praxis/approved/<change>`, which `hooks/pre-tool-use` gates source edits on. Guarded
//    defects: an approval written for a change that has no spec (a marker without a spec lets
//    the floor through on nothing), and a script that scaffolds `.praxis/` without the
//    .gitignore that keeps per-machine state out of the team's diff.
// 2. `specs/<change>/decision.md` with `verdict: APPROVE (human)` when the change is in
//    needs-human (specs/factory-cycle, design.md appendix) — the person's override of an
//    ESCALATE, which the ship gate accepts whatever the lenses said. The marker that recorded
//    the escalation goes with it.
//
// Every assertion runs the real script in a temp dir. Mutation-tested: drop the spec-file
// check and the unknown-change test fails; drop the `rm` of the needs-human marker and the
// override test fails.
import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const ROOT = new URL("..", import.meta.url).pathname;
const SCRIPT = join(ROOT, "scripts", "approve.sh");
const CLEAN = { PATH: process.env.PATH, HOME: process.env.HOME };

function approve(cwd, ...args) {
  try {
    const stdout = execFileSync("bash", [SCRIPT, ...args], { cwd, env: CLEAN, encoding: "utf8", timeout: 10_000, stdio: ["ignore", "pipe", "pipe"] });
    return { status: 0, stdout, stderr: "" };
  } catch (e) {
    return { status: e.status, stdout: e.stdout ?? "", stderr: e.stderr ?? "" };
  }
}

function project() {
  const dir = mkdtempSync(join(tmpdir(), "praxis-approve-"));
  execFileSync("git", ["init", "-q"], { cwd: dir });
  return dir;
}
const design = (dir, change) => {
  mkdirSync(join(dir, "specs", change), { recursive: true });
  writeFileSync(join(dir, "specs", change, "design.md"), "# d\n");
};
const spec = (dir, change) => {
  mkdirSync(join(dir, "specs", change), { recursive: true });
  writeFileSync(join(dir, "specs", change, "spec.md"), "---\ntitle: x\nready: true\n---\n# x — Spec\n");
};
const ledger = (dir, change, { stage = "built", round = 2 } = {}) =>
  writeFileSync(
    join(dir, "specs", change, "implementation.md"),
    `---\ntitle: ${change}\nstage: ${stage}\nround: ${round}     # 0 = no review yet\nbuilder: agent-b1\nlenses: correctness, security, tests\n---\n\n## Tasks\n`,
  );
const needsHuman = (dir, change) => {
  mkdirSync(join(dir, ".praxis", "needs-human"), { recursive: true });
  writeFileSync(join(dir, ".praxis", "needs-human", change), "");
};

test("approve writes the marker for a designed change and says so", () => {
  const dir = project();
  design(dir, "x");
  const { status, stdout } = approve(dir, "x");
  assert.equal(status, 0);
  assert.match(stdout, /^approved x → \.praxis\/approved\/x/);
  assert.match(stdout, /specs\/x\/design\.md/, "the legacy design.md is named as the file approved");
  assert.ok(existsSync(join(dir, ".praxis/approved/x")));
  // Second run is a no-op with the same answer.
  assert.equal(approve(dir, "x").status, 0);
});

test("approve keys on spec.md — the cycle's file — when the change has one", () => {
  const dir = project();
  spec(dir, "x");
  const { status, stdout } = approve(dir, "x");
  assert.equal(status, 0);
  assert.match(stdout, /^approved x → \.praxis\/approved\/x \(spec: specs\/x\/spec\.md\)/);
  assert.ok(existsSync(join(dir, ".praxis/approved/x")));
});

test("approve refuses a change with neither spec.md nor design.md — there is nothing to approve", () => {
  const dir = project();
  const { status, stderr } = approve(dir, "ghost");
  assert.equal(status, 1);
  assert.match(stderr, /specs\/ghost\/spec\.md does not exist/);
  assert.match(stderr, /design\.md/, "the legacy name is offered too");
  assert.ok(!existsSync(join(dir, ".praxis/approved/ghost")), "a marker without a spec was written");
  // A ledger alone is not a spec either.
  mkdirSync(join(dir, "specs", "half"), { recursive: true });
  ledger(dir, "half");
  assert.equal(approve(dir, "half").status, 1);
  assert.ok(!existsSync(join(dir, ".praxis/approved/half")));
});

test("approve refuses a missing or traversing change name", () => {
  const dir = project();
  assert.equal(approve(dir).status, 2);
  for (const bad of ["../x", "a/b", "_templates", ".hidden"]) {
    assert.equal(approve(dir, bad).status, 2, `accepted ${bad}`);
  }
  assert.ok(!existsSync(join(dir, ".praxis")), "a refusal must not scaffold .praxis");
});

test("the first approval creates .praxis with the gitignore that keeps the marker local", () => {
  const dir = project();
  design(dir, "x");
  approve(dir, "x");
  const ignore = readFileSync(join(dir, ".praxis/.gitignore"), "utf8");
  for (const entry of ["active-change", "approved/", "needs-human/", "worktrees/", "session-started"]) {
    assert.match(ignore, new RegExp(`^${entry.replace("/", "\\/")}$`, "m"), `.gitignore lacks ${entry}`);
  }
  // An existing .gitignore the project edited is the project's; it is never touched.
  writeFileSync(join(dir, ".praxis/.gitignore"), "mine\n");
  design(dir, "y");
  approve(dir, "y");
  assert.equal(readFileSync(join(dir, ".praxis/.gitignore"), "utf8"), "mine\n");
});

// factory-cycle added two entries to a .gitignore written before they existed. The upgrade
// path is narrow on purpose: only a file byte-identical to a Praxis default is Praxis's to
// extend; one the person edited is theirs, whatever it lacks (wave-1 review of T01).
test("a Praxis-default .gitignore from an earlier release gains needs-human/ and worktrees/", () => {
  for (const legacy of ["active-change\napproved/\nsession-started\n", "active-change\napproved/\n"]) {
    const dir = project();
    mkdirSync(join(dir, ".praxis"), { recursive: true });
    writeFileSync(join(dir, ".praxis/.gitignore"), legacy);
    design(dir, "x");
    assert.equal(approve(dir, "x").status, 0);
    const upgraded = readFileSync(join(dir, ".praxis/.gitignore"), "utf8");
    assert.ok(upgraded.startsWith(legacy), "the default's own lines come first, unchanged");
    assert.match(upgraded, /^needs-human\/$/m);
    assert.match(upgraded, /^worktrees\/$/m);
  }
});

test("approve resolves the project root from a subdirectory of the repo", () => {
  const dir = project();
  design(dir, "x");
  mkdirSync(join(dir, "src/deep"), { recursive: true });
  assert.equal(approve(join(dir, "src/deep"), "x").status, 0);
  assert.ok(existsSync(join(dir, ".praxis/approved/x")));
});

// The ESCALATE path of the cycle (specs/factory-cycle/architecture.md §2). The approver wrote
// ESCALATE, post-tool-use wrote the marker, the person decides to ship anyway.
test("approve on a needs-human change writes decision.md APPROVE (human), clears the marker, prints the ship commands", () => {
  const dir = project();
  spec(dir, "x");
  ledger(dir, "x", { stage: "needs-human", round: 2 });
  writeFileSync(join(dir, "specs/x/decision.md"), "---\nverdict: ESCALATE\nround: 2\n---\n## Checks run\n- a → b\n## Reason\nstuck\n");
  needsHuman(dir, "x");
  const { status, stdout } = approve(dir, "x");
  assert.equal(status, 0, stdout);

  const decision = readFileSync(join(dir, "specs/x/decision.md"), "utf8");
  assert.match(decision, /^---\nverdict: APPROVE \(human\)\nround: 2\n---\n/, "the appendix shape, verdict first");
  assert.match(decision, /^## Checks run\n- none — human override\n/m);
  assert.match(decision, /^## Reason\napproved by the person via \/praxis:approve\n/m);

  assert.ok(!existsSync(join(dir, ".praxis/needs-human/x")), "the escalation record must go with the override");
  assert.ok(existsSync(join(dir, ".praxis/approved/x")), "the spec approval is implied by shipping");
  assert.match(stdout, /APPROVE \(human\)/);
  assert.match(stdout, /round 2/);
  assert.match(stdout, /^ship:$/m, "the orchestrator is told what to run next");
  assert.match(stdout, /^\s+git push -u origin praxis\/x$/m);
  assert.match(stdout, /^\s+gh pr create .*praxis\/x/m);
});

test("the ledger's stage: needs-human triggers the override even when the marker is gone", () => {
  const dir = project();
  spec(dir, "x");
  ledger(dir, "x", { stage: "needs-human", round: 1 });
  const { status, stdout } = approve(dir, "x");
  assert.equal(status, 0, stdout);
  const decision = readFileSync(join(dir, "specs/x/decision.md"), "utf8");
  assert.match(decision, /^verdict: APPROVE \(human\)$/m);
  assert.match(decision, /^round: 1$/m);
  assert.match(stdout, /^ship:$/m);
});

test("without needs-human, approve writes no decision and prints no ship commands", () => {
  const dir = project();
  spec(dir, "x");
  ledger(dir, "x", { stage: "built", round: 1 });
  const { status, stdout } = approve(dir, "x");
  assert.equal(status, 0);
  assert.ok(!existsSync(join(dir, "specs/x/decision.md")), "a decision the approver did not write");
  assert.doesNotMatch(stdout, /ship:/);
});
