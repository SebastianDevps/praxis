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
  writeFileSync(
    join(dir, "specs", change, "spec.md"),
    `---\ntitle: x\nready: true\n---\n# x — Spec\n## Goal\nExport the tenant's invoices to CSV — "fast" & $afe; rm -rf /\n\nMore prose.\n## Scope\n`,
  );
};
const ledger = (dir, change, { stage = "built", round = 2, base = "" } = {}) =>
  writeFileSync(
    join(dir, "specs", change, "implementation.md"),
    `---\ntitle: ${change}\nstage: ${stage}     # new → designed → planned\nround: ${round}     # 0 = no review yet\nbuilder: agent-b1\n${base ? `base: ${base}\n` : ""}lenses: correctness, security, tests\n---\n\n## Tasks\n`,
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

// The change name reaches printed shell lines and paths; the security lens confirmed the
// injection through the unquoted `gh pr create` line. Refusal comes before any write.
test("approve refuses a missing, traversing, option-like or shell-metacharacter change name", () => {
  const dir = project();
  assert.equal(approve(dir).status, 2);
  for (const bad of ["../x", "a/b", "_templates", ".hidden", "-x", "x;touch /tmp/pwn", "x$(id)", "a b", "x`id`"]) {
    const { status } = approve(dir, bad);
    assert.equal(status, 2, `accepted ${bad}`);
  }
  assert.ok(!existsSync(join(dir, ".praxis")), "a refusal must not scaffold .praxis");
  assert.ok(!existsSync("/tmp/pwn"), "the injection payload ran");
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
test("approve on a needs-human change writes decision.md APPROVE (human), clears the marker, sets stage: implemented, prints the ship commands", () => {
  const dir = project();
  spec(dir, "x");
  ledger(dir, "x", { stage: "needs-human", round: 2, base: "develop" });
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

  // The person's script may write the ledger (design.md appendix): the next step is ship.
  const led = readFileSync(join(dir, "specs/x/implementation.md"), "utf8");
  assert.match(led, /^stage: implemented     # new → designed → planned$/m, "stage set, comment kept");
  assert.match(led, /^round: 2     # 0 = no review yet$/m, "round untouched");

  assert.match(stdout, /APPROVE \(human\)/);
  assert.match(stdout, /round 2/);
  assert.match(stdout, /ledger stage: implemented/);
  assert.match(stdout, /^ship:$/m, "the orchestrator is told what to run next");
  assert.match(stdout, /^\s+git push -u origin 'praxis\/x'$/m, "every value single-quoted");
  // The PR line as the orchestrator pastes it: base from the ledger, title from the spec's
  // Goal (first line, single-quoted, the embedded quote as '\''), body linking the two files.
  const pr = stdout.split("\n").find((l) => l.includes("gh pr create"));
  assert.ok(pr, "no gh pr create line");
  assert.match(pr, /--base 'develop' --head 'praxis\/x' /);
  assert.equal(
    pr.split("--title ")[1].split(" --body ")[0],
    `'Export the tenant'\\''s invoices to CSV — "fast" & $afe; rm -rf /'`,
    "the Goal is one single-quoted argument: no shell sees the ; or the $",
  );
  assert.match(pr, /--body 'Spec: specs\/x\/spec\.md · Decision: specs\/x\/decision\.md \(APPROVE \(human\), round 2\)'$/);
  assert.doesNotMatch(pr, /--fill/);
});

// The base comes from files a model can write (the ledger) or a person can mistype (git
// config); as an argument it must be a branch name and nothing else — and the refusal comes
// before the decision is written or the marker removed.
test("approve refuses an option-like or metacharacter PR base before writing anything", () => {
  for (const evil of ["--upload-pack=touch /tmp/pwn", "main;touch /tmp/pwn", "a//b", "../main"]) {
    const dir = project();
    spec(dir, "x");
    ledger(dir, "x", { stage: "needs-human", round: 1, base: evil });
    needsHuman(dir, "x");
    const { status, stderr, stdout } = approve(dir, "x");
    assert.equal(status, 2, `accepted base ${evil}: ${stdout}`);
    assert.match(stderr, /PR base .* is not a branch name/);
    assert.ok(!existsSync(join(dir, "specs/x/decision.md")), `decision written for base ${evil}`);
    assert.ok(existsSync(join(dir, ".praxis/needs-human/x")), "the marker must survive a refusal");
    assert.doesNotMatch(stdout, /ship:/);
  }
  const viaConfig = project();
  spec(viaConfig, "x");
  ledger(viaConfig, "x", { stage: "needs-human", round: 1 });
  needsHuman(viaConfig, "x");
  execFileSync("git", ["config", "branch.praxis/x.praxisBase", "-x"], { cwd: viaConfig });
  assert.equal(approve(viaConfig, "x").status, 2);
  assert.ok(!existsSync("/tmp/pwn"), "the injection payload ran");
});

// ADR-005: a model-written field unlocks nothing. `stage: needs-human` is the orchestrator's
// mirror of the marker; without the marker there was no ESCALATE a hook recorded.
test("the ledger's stage: needs-human alone does NOT trigger the override — only the hook-written marker does", () => {
  const dir = project();
  spec(dir, "x");
  ledger(dir, "x", { stage: "needs-human", round: 1 });
  const { status, stdout } = approve(dir, "x");
  assert.equal(status, 0, stdout);
  assert.ok(!existsSync(join(dir, "specs/x/decision.md")), "a decision written on the model's say-so");
  assert.doesNotMatch(stdout, /ship:/);
  assert.match(readFileSync(join(dir, "specs/x/implementation.md"), "utf8"), /^stage: needs-human/m, "the ledger is not touched either");
  assert.match(stdout, /^approved x → \.praxis\/approved\/x/);
});

test("the PR's base comes from the branch config worktree.sh records, before the ledger, before HEAD", () => {
  const dir = project();
  spec(dir, "x");
  ledger(dir, "x", { stage: "needs-human", round: 1, base: "develop" });
  needsHuman(dir, "x");
  execFileSync("git", ["config", "branch.praxis/x.praxisBase", "release/2"], { cwd: dir });
  const { stdout } = approve(dir, "x");
  assert.match(stdout, /gh pr create --base 'release\/2' --head 'praxis\/x' /);

  // No config, no ledger base: the main checkout's branch (an unborn one still has a name).
  const bare = project();
  spec(bare, "x");
  ledger(bare, "x", { stage: "needs-human", round: 1 });
  needsHuman(bare, "x");
  execFileSync("git", ["symbolic-ref", "HEAD", "refs/heads/trunk"], { cwd: bare });
  assert.match(approve(bare, "x").stdout, /gh pr create --base 'trunk' --head 'praxis\/x' /);
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
