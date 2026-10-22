// The two scripts of the cycle the person (or the orchestrator) runs around the roles
// (specs/factory-cycle, design.md appendix):
//
//   scripts/rework.sh <change> "<note>"   sends a needs-human change back to the builder:
//                                         archives review/round-* and decision.md into
//                                         review/rework-<k>/, writes the note, resets the ledger
//                                         (round: 0, stage: planned), removes the marker.
//   scripts/worktree.sh <change> [base]   the builder's checkout: .praxis/worktrees/<change> on
//                                         branch praxis/<change>; idempotent; last line = path.
//
// Every assertion runs the real script in a throwaway repo under os.tmpdir() — never this one:
// worktree.sh mutates git state. Mutation-tested: drop the `mv` of decision.md in rework.sh and
// the archive test fails; drop the registered-worktree check in worktree.sh and the idempotency
// test fails on `git worktree add` refusing an existing path.
import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const ROOT = new URL("..", import.meta.url).pathname;
const REWORK = join(ROOT, "scripts", "rework.sh");
const WORKTREE = join(ROOT, "scripts", "worktree.sh");
const CLEAN = { PATH: process.env.PATH, HOME: process.env.HOME };

function run(script, cwd, ...args) {
  const r = spawnSync("bash", [script, ...args], { cwd, env: CLEAN, encoding: "utf8", timeout: 20_000 });
  return { status: r.status, stdout: r.stdout ?? "", stderr: r.stderr ?? "" };
}
const lastLine = (s) => s.trimEnd().split("\n").at(-1);
const git = (cwd, ...args) =>
  execFileSync("git", ["-c", "user.name=t", "-c", "user.email=t@t", ...args], { cwd, encoding: "utf8" }).trim();

// Physical path: the scripts print `pwd -P` paths (praxis_project_root), and macOS spells
// os.tmpdir() as /var/… while the kernel resolves it to /private/var/….
function repo() {
  const dir = realpathSync(mkdtempSync(join(tmpdir(), "praxis-scripts-")));
  execFileSync("git", ["init", "-q", "-b", "main"], { cwd: dir });
  writeFileSync(join(dir, "README.md"), "# fixture\n");
  git(dir, "add", "-A");
  git(dir, "commit", "-qm", "chore: seed");
  return dir;
}

// A change at the end of the ESCALATE path: two rounds, the second still CHANGES on security,
// the approver's ESCALATE, the marker post-tool-use wrote.
function escalated(dir, change = "x") {
  const base = join(dir, "specs", change);
  mkdirSync(join(base, "review", "round-1"), { recursive: true });
  mkdirSync(join(base, "review", "round-2"), { recursive: true });
  writeFileSync(join(base, "spec.md"), "---\ntitle: x\nready: true\n---\n# x — Spec\n");
  writeFileSync(
    join(base, "implementation.md"),
    `---\ntitle: ${change}\nstage: needs-human\nround: 2     # 0 = no review yet\nbuilder: agent-b1\nlenses: correctness, security, tests\nowner: o\n---\n\n## Tasks\n- [ ] T01 · phase: build · state: pending · thing\n`,
  );
  const lens = (r, name, verdict) =>
    writeFileSync(join(base, "review", `round-${r}`, `${name}.md`), `---\nlens: ${name}\nround: ${r}\nverdict: ${verdict}\n---\n## Findings\n## What I tried to break\n- a → b\n`);
  for (const r of [1, 2]) {
    writeFileSync(join(base, "review", `round-${r}`, "lenses"), "correctness\nsecurity\ntests\n");
    lens(r, "correctness", "PASS");
    lens(r, "security", "CHANGES");
    lens(r, "tests", r === 1 ? "CHANGES" : "PASS");
  }
  writeFileSync(join(base, "decision.md"), "---\nverdict: ESCALATE\nround: 2\n---\n## Checks run\n- a → b\n## Reason\nstuck\n");
  mkdirSync(join(dir, ".praxis", "needs-human"), { recursive: true });
  writeFileSync(join(dir, ".praxis", "needs-human", change), "");
  return base;
}

// ---- rework.sh ----------------------------------------------------------------------------

test("rework archives the review state into rework-1/, writes the note, resets the ledger, clears the marker", () => {
  const dir = repo();
  const base = escalated(dir);
  const { status, stdout, stderr } = run(REWORK, dir, "x", "scope by tenant in the repository, not the controller");
  assert.equal(status, 0, stderr);

  const archive = join(base, "review", "rework-1");
  assert.ok(existsSync(join(archive, "round-1", "security.md")), "round-1 moved");
  assert.ok(existsSync(join(archive, "round-2", "lenses")), "round-2 moved, lens list included");
  assert.ok(existsSync(join(archive, "decision.md")), "the ESCALATE decision moved");
  assert.ok(!existsSync(join(base, "review", "round-1")), "round-1 must not stay — the next round-1 is a new review");
  assert.ok(!existsSync(join(base, "review", "round-2")));
  assert.ok(!existsSync(join(base, "decision.md")), "a stale ESCALATE would keep the ship gate shut");

  const note = readFileSync(join(archive, "note.md"), "utf8");
  assert.match(note, /scope by tenant in the repository, not the controller/);
  assert.match(note, /^rework: 1$/m);
  assert.match(note, /^archived_round: 2$/m);

  const ledger = readFileSync(join(base, "implementation.md"), "utf8");
  assert.match(ledger, /^round: 0     # 0 = no review yet$/m, "value replaced, trailing comment kept");
  assert.match(ledger, /^stage: planned$/m);
  assert.match(ledger, /^builder: agent-b1$/m, "the other fields are untouched");
  assert.match(ledger, /- \[ \] T01 · phase: build/, "the body is untouched");

  assert.ok(!existsSync(join(dir, ".praxis/needs-human/x")), "the escalation record must go with the rework");

  // The orchestrator reads the output: the CHANGES files to hand the builder, and the note path last.
  assert.match(stdout, new RegExp(`^changes: ${archive}/round-2/security\\.md$`, "m"));
  assert.match(stdout, new RegExp(`^changes: ${archive}/round-1/tests\\.md$`, "m"));
  assert.doesNotMatch(stdout, /correctness\.md/, "a PASS is not a change to hand back");
  assert.equal(lastLine(stdout), join(archive, "note.md"));
});

test("a second rework archives into rework-2/ and leaves rework-1/ alone", () => {
  const dir = repo();
  const base = escalated(dir);
  assert.equal(run(REWORK, dir, "x", "first note").status, 0);
  // The cycle ran again and escalated again.
  mkdirSync(join(base, "review", "round-1"), { recursive: true });
  writeFileSync(join(base, "review", "round-1", "lenses"), "tests\n");
  writeFileSync(join(base, "review", "round-1", "tests.md"), "---\nlens: tests\nround: 1\nverdict: CHANGES\n---\n");
  writeFileSync(join(base, "decision.md"), "---\nverdict: ESCALATE\nround: 1\n---\n");
  writeFileSync(join(dir, ".praxis", "needs-human", "x"), "");
  const { status, stdout } = run(REWORK, dir, "x", "second note");
  assert.equal(status, 0);
  assert.deepEqual(readdirSync(join(base, "review")).sort(), ["rework-1", "rework-2"]);
  assert.match(readFileSync(join(base, "review", "rework-1", "note.md"), "utf8"), /first note/);
  assert.match(readFileSync(join(base, "review", "rework-2", "note.md"), "utf8"), /second note/);
  assert.ok(existsSync(join(base, "review", "rework-2", "round-1", "tests.md")));
  assert.ok(existsSync(join(base, "review", "rework-2", "decision.md")));
  assert.equal(lastLine(stdout), join(base, "review", "rework-2", "note.md"));
});

test("rework with nothing to archive and no marker still writes the note and resets the ledger, and says no marker existed", () => {
  const dir = repo();
  mkdirSync(join(dir, "specs", "x"), { recursive: true });
  writeFileSync(join(dir, "specs", "x", "implementation.md"), "---\ntitle: x\nstage: built\n---\n\n## Tasks\n");
  const { status, stdout } = run(REWORK, dir, "x", "start over");
  assert.equal(status, 0);
  // The person may rework before any ESCALATE; the output says the marker was never there.
  assert.match(stdout, /^note: no \.praxis\/needs-human\/x existed — a rework before an ESCALATE is the person's call/m);
  const ledger = readFileSync(join(dir, "specs/x/implementation.md"), "utf8");
  assert.match(ledger, /^---\n(?:[^\n]*\n)*?stage: planned\n/, "stage replaced inside the frontmatter");
  assert.match(ledger, /^round: 0$/m, "a missing round: is added to the frontmatter");
  assert.equal((ledger.match(/^---$/gm) ?? []).length, 2, "the frontmatter block is still one block");
  assert.equal(lastLine(stdout), join(dir, "specs/x/review/rework-1/note.md"));
});

test("rework refuses without a ledger, a note, or a sane change name", () => {
  const dir = repo();
  const noLedger = run(REWORK, dir, "ghost", "note");
  assert.equal(noLedger.status, 1);
  assert.match(noLedger.stderr, /specs\/ghost\/implementation\.md does not exist/);
  assert.ok(!existsSync(join(dir, "specs/ghost")), "a refusal must not scaffold the change");

  escalated(dir);
  assert.equal(run(REWORK, dir, "x").status, 2, "the note is required — a rework without a reason is a loop");
  assert.equal(run(REWORK, dir, "x", "").status, 2);
  for (const bad of ["../x", "a/b", "_templates", ".hidden", "-x", "x;touch /tmp/pwn", "x$(id)", "a b"]) {
    assert.equal(run(REWORK, dir, bad, "n").status, 2, `accepted ${bad}`);
  }
  assert.ok(existsSync(join(dir, "specs/x/decision.md")), "a refusal must not archive anything");
  assert.doesNotMatch(readFileSync(join(dir, "specs/x/implementation.md"), "utf8"), /^round: 0/m, "a refusal must not touch the ledger");
  assert.ok(!existsSync("/tmp/pwn"), "the injection payload ran");
  // A rework with the marker present reports it removed, not the no-marker note.
  const out = run(REWORK, dir, "x", "n").stdout;
  assert.match(out, /needs-human\/x removed/);
  assert.doesNotMatch(out, /^note: no \.praxis\/needs-human/m);
});

// ---- worktree.sh --------------------------------------------------------------------------

test("worktree creates .praxis/worktrees/<change> on branch praxis/<change> from the current branch and prints the path last", () => {
  const dir = repo();
  const { status, stdout, stderr } = run(WORKTREE, dir, "x");
  assert.equal(status, 0, stderr);
  const path = lastLine(stdout);
  assert.equal(path, realpathSync(join(dir, ".praxis", "worktrees", "x")));
  assert.equal(git(path, "rev-parse", "--abbrev-ref", "HEAD"), "praxis/x");
  assert.equal(git(path, "rev-parse", "HEAD"), git(dir, "rev-parse", "main"), "branched from the current branch's tip");
  assert.match(git(dir, "worktree", "list", "--porcelain"), /branch refs\/heads\/praxis\/x/);
  assert.match(readFileSync(join(dir, ".praxis/.gitignore"), "utf8"), /^worktrees\/$/m, "the checkout must not show up in the main tree's status");
  // `.praxis/.gitignore` itself is untracked in a fresh fixture (that is the project's to commit);
  // the nested checkout must not be, file by file.
  assert.doesNotMatch(git(dir, "status", "--porcelain", "-uall"), /worktrees/, "the worktree leaks into the main checkout's status");
});

test("worktree is idempotent: an existing worktree prints the same path and changes nothing", () => {
  const dir = repo();
  const first = run(WORKTREE, dir, "x");
  // Guard before deriving a path from stdout: with the script absent, lastLine("") is "" and
  // join("", "work.txt") would land in the test process's cwd — this repo.
  assert.equal(first.status, 0, first.stderr);
  assert.ok(lastLine(first.stdout).startsWith(dir), "the printed path must be inside the fixture");
  writeFileSync(join(lastLine(first.stdout), "work.txt"), "in progress\n");
  const second = run(WORKTREE, dir, "x");
  assert.equal(second.status, 0, second.stderr);
  assert.equal(lastLine(second.stdout), lastLine(first.stdout));
  assert.ok(existsSync(join(lastLine(second.stdout), "work.txt")), "the builder's uncommitted work survived");
  assert.equal(git(dir, "worktree", "list", "--porcelain").split("worktree ").length - 1, 2, "main plus one, not a second copy");
});

test("worktree reuses a branch that exists without a checkout, instead of failing on -b", () => {
  const dir = repo();
  const created = run(WORKTREE, dir, "x");
  assert.equal(created.status, 0, created.stderr);
  const path = lastLine(created.stdout);
  assert.ok(path.startsWith(dir), "the printed path must be inside the fixture");
  writeFileSync(join(path, "work.txt"), "committed\n");
  git(path, "add", "-A");
  git(path, "commit", "-qm", "feat: on the branch");
  git(dir, "worktree", "remove", "--force", path);
  assert.ok(!existsSync(path));
  const again = run(WORKTREE, dir, "x");
  assert.equal(again.status, 0, again.stderr);
  assert.equal(lastLine(again.stdout), realpathSync(join(dir, ".praxis", "worktrees", "x")));
  assert.equal(git(lastLine(again.stdout), "rev-parse", "--abbrev-ref", "HEAD"), "praxis/x");
  assert.ok(existsSync(join(lastLine(again.stdout), "work.txt")), "the branch's commits are what the checkout holds");
});

// The floor runs inside the worktree: `git rev-parse --show-toplevel` there is the worktree,
// so `hooks/pre-tool-use` reads `.praxis/` and `specs/<c>/` under the builder's cwd. Nothing
// of that arrives with `git worktree add` — `.praxis/` is gitignored and the spec is not yet on
// any branch — so the script seeds it. The ledger is the one file NOT seeded (one writer, in the
// main checkout); `praxis_ledger_path` reads it through `git rev-parse --git-common-dir`.
// Invoked the way tests/hooks.test.mjs invokes the hook, under both envs a host may send:
// CLAUDE_PROJECT_DIR = the worktree (the floor stands on the seed — remove the marker and it
// asks) and CLAUDE_PROJECT_DIR = the main checkout.
test("worktree seeds .praxis/active-change, the approval marker and the spec, so the builder's floor opens there", () => {
  const dir = repo();
  mkdirSync(join(dir, "specs", "x"), { recursive: true });
  writeFileSync(join(dir, "specs", "x", "spec.md"), "---\ntitle: x\nready: true\n---\n# x — Spec\nv1\n");
  writeFileSync(join(dir, "specs", "x", "implementation.md"), "---\ntitle: x\nstage: planned\nround: 0\n---\n\n## Tasks\n");
  mkdirSync(join(dir, "specs", "x", "review", "round-1"), { recursive: true });
  writeFileSync(join(dir, "specs", "x", "review", "round-1", "lenses"), "tests\n");
  mkdirSync(join(dir, ".praxis", "approved"), { recursive: true });
  writeFileSync(join(dir, ".praxis", "approved", "x"), "");
  writeFileSync(join(dir, ".praxis", "active-change"), "x\n");

  const { status, stdout, stderr } = run(WORKTREE, dir, "x");
  assert.equal(status, 0, stderr);
  const wt = lastLine(stdout);
  assert.equal(readFileSync(join(wt, ".praxis", "active-change"), "utf8"), "x\n");
  assert.ok(existsSync(join(wt, ".praxis", "approved", "x")), "the person's approval travels with the builder");
  assert.match(readFileSync(join(wt, "specs", "x", "spec.md"), "utf8"), /v1/);
  assert.ok(!existsSync(join(wt, "specs", "x", "implementation.md")), "one ledger, in the main checkout");
  assert.ok(!existsSync(join(wt, "specs", "x", "review")), "the reviews are the lenses' and the orchestrator's, not the builder's");

  // A re-run refreshes the spec (the spec-writer may have answered a question since).
  writeFileSync(join(dir, "specs", "x", "spec.md"), "---\ntitle: x\nready: true\n---\n# x — Spec\nv2\n");
  assert.equal(run(WORKTREE, dir, "x").status, 0);
  assert.match(readFileSync(join(wt, "specs", "x", "spec.md"), "utf8"), /v2/);

  // The floor, from inside the worktree, on a source edit — mirrors tests/hooks.test.mjs.
  const home = mkdtempSync(join(tmpdir(), "praxis-scripts-home-"));
  mkdirSync(join(home, ".claude"), { recursive: true });
  writeFileSync(join(home, ".claude", ".praxis-mode"), "full");
  const floor = (projectDir) => {
    const hook = spawnSync("bash", [join(ROOT, "hooks", "pre-tool-use")], {
      env: { ...CLEAN, CLAUDE_PLUGIN_ROOT: ROOT, CLAUDE_PROJECT_DIR: projectDir, HOME: home },
      input: JSON.stringify({ tool_name: "Edit", cwd: wt, tool_input: { file_path: join(wt, "src", "a.js") } }),
      encoding: "utf8",
      timeout: 10_000,
    });
    assert.equal(hook.status, 0, hook.stderr);
    return hook.stdout.trim() === "" ? "allow" : JSON.parse(hook.stdout).hookSpecificOutput.permissionDecision;
  };
  assert.equal(floor(dir), "allow", "CLAUDE_PROJECT_DIR = main checkout, cwd = worktree");
  assert.equal(floor(wt), "allow", "CLAUDE_PROJECT_DIR = worktree: the seed plus the common-dir ledger fallback");
  // The seed is load-bearing: without the copied marker the floor asks again.
  rmSync(join(wt, ".praxis", "approved", "x"));
  assert.equal(floor(wt), "ask", "with the seeded marker gone the floor must stand");
});

test("worktree prints base: <branch> before the path, recorded on the branch so re-runs and approve.sh agree", () => {
  const dir = repo();
  const created = run(WORKTREE, dir, "x");
  assert.equal(created.status, 0, created.stderr);
  const lines = created.stdout.trimEnd().split("\n");
  assert.equal(lines.at(-2), "base: main", "the line before the path names the base");
  assert.equal(git(dir, "config", "--get", "branch.praxis/x.praxisBase"), "main");
  // A re-run reads the record, even when the main checkout has moved to another branch.
  git(dir, "checkout", "-qb", "elsewhere");
  const again = run(WORKTREE, dir, "x");
  assert.equal(again.stdout.trimEnd().split("\n").at(-2), "base: main");
  assert.equal(lastLine(again.stdout), lastLine(created.stdout));
});

test("worktree refuses a branch checked out at another path, and prunes a registration whose directory is gone", () => {
  const dir = repo();
  git(dir, "branch", "praxis/x");
  const elsewhere = join(dir, "elsewhere");
  git(dir, "worktree", "add", "-q", elsewhere, "praxis/x");
  const refused = run(WORKTREE, dir, "x");
  assert.equal(refused.status, 1, "git's own 128 must not leak through set -e");
  assert.match(refused.stderr, /praxis\/x is already checked out at .*elsewhere/);
  assert.match(refused.stderr, /git worktree remove/);
  assert.ok(!existsSync(join(dir, ".praxis", "worktrees", "x")));

  // Our own registration with the directory deleted by hand: prune and re-add, not a failure.
  git(dir, "worktree", "remove", "--force", elsewhere);
  const first = run(WORKTREE, dir, "x");
  assert.equal(first.status, 0, first.stderr);
  rmSync(lastLine(first.stdout), { recursive: true, force: true });
  const again = run(WORKTREE, dir, "x");
  assert.equal(again.status, 0, again.stderr);
  assert.equal(lastLine(again.stdout), lastLine(first.stdout));
  assert.equal(git(lastLine(again.stdout), "rev-parse", "--abbrev-ref", "HEAD"), "praxis/x");
});

test("worktree takes an explicit base and refuses a bad name or a repo with no commit", () => {
  const dir = repo();
  git(dir, "checkout", "-qb", "develop");
  writeFileSync(join(dir, "dev.txt"), "d\n");
  git(dir, "add", "-A");
  git(dir, "commit", "-qm", "feat: develop");
  git(dir, "checkout", "-q", "main");
  const { status, stdout, stderr } = run(WORKTREE, dir, "x", "develop");
  assert.equal(status, 0, stderr);
  assert.equal(git(lastLine(stdout), "rev-parse", "HEAD"), git(dir, "rev-parse", "develop"));

  for (const bad of ["../x", "a/b", "_templates", ".hidden", "-x", "x;touch /tmp/pwn", "x$(id)", "a b"]) {
    assert.equal(run(WORKTREE, dir, bad).status, 2, `accepted ${bad}`);
  }
  assert.equal(run(WORKTREE, dir).status, 2);
  assert.ok(!existsSync("/tmp/pwn"), "the injection payload ran");

  const empty = mkdtempSync(join(tmpdir(), "praxis-scripts-empty-"));
  execFileSync("git", ["init", "-q"], { cwd: empty });
  const noHead = run(WORKTREE, empty, "x");
  assert.equal(noHead.status, 1);
  assert.match(noHead.stderr, /no commit/);
});

// A base that starts with `-` reaches git as an option: `--upload-pack=<cmd>` runs it. Refused
// before git is called — no branch, no worktree, no payload.
test("worktree refuses an option-like or metacharacter base before calling git", () => {
  const dir = repo();
  for (const evil of ["--upload-pack=touch /tmp/pwn", "-x", "main;touch /tmp/pwn", "a//b", "../main", "/main", "main/"]) {
    const { status, stderr } = run(WORKTREE, dir, "y", evil);
    assert.equal(status, 2, `accepted base ${evil}`);
    assert.match(stderr, /is not a branch name/);
  }
  assert.equal(git(dir, "branch", "--list", "praxis/y"), "", "a branch was created on a refused base");
  assert.ok(!existsSync(join(dir, ".praxis", "worktrees", "y")));
  assert.ok(!existsSync("/tmp/pwn"), "the injection payload ran");
});

test("worktree on a detached HEAD refuses without an explicit base, and takes one", () => {
  const dir = repo();
  git(dir, "checkout", "-q", "--detach");
  const refused = run(WORKTREE, dir, "x");
  assert.equal(refused.status, 1);
  assert.match(refused.stderr, /detached HEAD — pass the base branch explicitly/);
  assert.equal(git(dir, "branch", "--list", "praxis/x"), "", "no branch named after HEAD");
  const ok = run(WORKTREE, dir, "x", "main");
  assert.equal(ok.status, 0, ok.stderr);
  assert.equal(ok.stdout.trimEnd().split("\n").at(-2), "base: main");
});

test("worktree leaves a ledger that came with the branch and names the main checkout's as authoritative", () => {
  const dir = repo();
  mkdirSync(join(dir, "specs", "x"), { recursive: true });
  writeFileSync(join(dir, "specs", "x", "implementation.md"), "---\ntitle: x\nstage: planned\n---\n");
  git(dir, "add", "-A");
  git(dir, "commit", "-qm", "chore: ledger committed on main");
  const { status, stdout } = run(WORKTREE, dir, "x");
  assert.equal(status, 0);
  const wt = lastLine(stdout);
  assert.ok(existsSync(join(wt, "specs", "x", "implementation.md")), "a committed file is git's to manage, not the script's");
  assert.match(stdout, /^note: \.praxis\/worktrees\/x\/specs\/x\/implementation\.md came with the branch and is not the ledger — the main checkout's is authoritative/m);
  assert.equal(stdout.trimEnd().split("\n").at(-2), "base: main", "the note comes before base: and the path");
});
