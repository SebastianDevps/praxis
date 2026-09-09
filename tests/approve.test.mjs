// `/praxis:approve` writes the one record the model must not: `.praxis/approved/<change>`,
// which `hooks/pre-tool-use` gates source edits on. Two defects this guards: an approval
// written for a change that has no design (a marker without a design lets the floor through
// on nothing), and a script that scaffolds `.praxis/` without the .gitignore that keeps
// per-machine state out of the team's diff. Every assertion runs the real script in a temp
// dir. Mutation-tested: drop the design.md check and the unknown-change test fails.
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

test("approve writes the marker for a designed change and says so", () => {
  const dir = project();
  design(dir, "x");
  const { status, stdout } = approve(dir, "x");
  assert.equal(status, 0);
  assert.match(stdout, /^approved x → \.praxis\/approved\/x/);
  assert.ok(existsSync(join(dir, ".praxis/approved/x")));
  // Second run is a no-op with the same answer.
  assert.equal(approve(dir, "x").status, 0);
});

test("approve refuses a change with no design.md — there is nothing to approve", () => {
  const dir = project();
  const { status, stderr } = approve(dir, "ghost");
  assert.equal(status, 1);
  assert.match(stderr, /specs\/ghost\/design\.md does not exist/);
  assert.ok(!existsSync(join(dir, ".praxis/approved/ghost")), "a marker without a design was written");
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
  assert.match(ignore, /^approved\/$/m);
  assert.match(ignore, /^active-change$/m);
  // An existing .gitignore is the project's; it is never rewritten.
  writeFileSync(join(dir, ".praxis/.gitignore"), "mine\n");
  design(dir, "y");
  approve(dir, "y");
  assert.equal(readFileSync(join(dir, ".praxis/.gitignore"), "utf8"), "mine\n");
});

test("approve resolves the project root from a subdirectory of the repo", () => {
  const dir = project();
  design(dir, "x");
  mkdirSync(join(dir, "src/deep"), { recursive: true });
  assert.equal(approve(join(dir, "src/deep"), "x").status, 0);
  assert.ok(existsSync(join(dir, ".praxis/approved/x")));
});
