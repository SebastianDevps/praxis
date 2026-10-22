// scripts/loop.sh, driven end to end with a fake `claude` on PATH inside a throwaway git
// repo. The fake prints a canned output per iteration from a fixture directory, records the
// prompt it was handed, runs an optional side-effect script (what a real iteration would do to
// the files: write the marker, set the stage) and commits once — so the loop sees progress the
// way it would from a real iteration.
//
// What is pinned: the signals and their exit codes, that a signal is a whole line and never a
// substring (mutation: drop the `x` from `grep -qxE` in has_signal → the prose test below
// fails; restore → passes), the factory shape of the prompt, and the two file-read end states
// of the cycle (specs/factory-cycle): `stage: shipped` → 0, `.praxis/needs-human/<c>` → 5.
import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const ROOT = new URL("..", import.meta.url).pathname;
const LOOP = join(ROOT, "scripts", "loop.sh");

const FAKE_CLAUDE = `#!/usr/bin/env bash
# Fake \`claude -p <prompt>\`: canned output per iteration, prompt recorded, side effect, one commit.
dir="$FAKE_CLAUDE_DIR"
n=1
[ -f "$dir/count" ] && n=$(( $(<"$dir/count") + 1 ))
printf '%s' "$n" > "$dir/count"
printf '%s' "$2" > "$dir/prompt-$n.txt"
if [ -f "$dir/$n.out" ]; then printf '%s\\n' "$(<"$dir/$n.out")"; else echo "iteration $n: implemented one task"; fi
[ -f "$dir/$n.sh" ] && bash "$dir/$n.sh"
if [ ! -f "$dir/$n.nocommit" ]; then
  echo "iteration $n" >> work.log
  git add -A >/dev/null
  git -c user.name=t -c user.email=t@t commit -qm "feat: iteration $n

Task: T0$n
Praxis-Loop: T0$n" >/dev/null
fi
exit 0
`;

const LEDGER = (stage = "planned") =>
  `---\ntitle: demo\nstage: ${stage}\nround: 0\n---\n\n## Tasks\n- [ ] T01 · phase: build · state: pending · one thing\n      files:  work.log\n      verify: test -f work.log\n`;

function loopRepo(outputs = {}, effects = {}) {
  const repo = mkdtempSync(join(tmpdir(), "praxis-loop-"));
  const home = mkdtempSync(join(tmpdir(), "praxis-loop-home-"));
  const fixtures = mkdtempSync(join(tmpdir(), "praxis-loop-fake-"));
  const bin = join(fixtures, "bin");
  mkdirSync(bin);
  writeFileSync(join(bin, "claude"), FAKE_CLAUDE);
  chmodSync(join(bin, "claude"), 0o755);
  for (const [iteration, text] of Object.entries(outputs)) writeFileSync(join(fixtures, `${iteration}.out`), text);
  for (const [iteration, script] of Object.entries(effects)) writeFileSync(join(fixtures, `${iteration}.sh`), script);

  execFileSync("git", ["init", "-q"], { cwd: repo });
  mkdirSync(join(repo, "specs", "demo"), { recursive: true });
  mkdirSync(join(repo, ".praxis"), { recursive: true });
  writeFileSync(join(repo, ".praxis", "active-change"), "demo\n");
  writeFileSync(join(repo, "specs", "demo", "implementation.md"), LEDGER());
  execFileSync("git", ["add", "-A"], { cwd: repo });
  execFileSync("git", ["-c", "user.name=t", "-c", "user.email=t@t", "commit", "-qm", "chore: seed"], { cwd: repo });

  const spawn = (...args) =>
    spawnSync("bash", [LOOP, ...args], {
      cwd: repo,
      env: { PATH: `${bin}:${process.env.PATH}`, HOME: home, FAKE_CLAUDE_DIR: fixtures },
      encoding: "utf8",
      timeout: 30_000,
    });
  const run = (...flags) => spawn("--task", "demo goal", ...flags);
  const iterations = () => (existsSync(join(fixtures, "count")) ? Number(readFileSync(join(fixtures, "count"), "utf8")) : 0);
  const prompt = (n) => readFileSync(join(fixtures, `prompt-${n}.txt`), "utf8");
  return { repo, run, spawn, iterations, prompt };
}

test("the iteration prompt continues the change through the factory skill, one step, with the ledger", () => {
  const { run, prompt } = loopRepo({ 1: "NO MORE TASKS" });
  assert.equal(run().status, 0);
  const text = prompt(1);
  const headings = [...text.matchAll(/^# (.+)$/gm)].map((m) => m[1]);
  assert.deepEqual(headings, ["LEDGER", "ONE STEP", "EXECUTION", "FEEDBACK LOOPS", "COMMIT", "FINAL RULES"]);
  assert.match(text, /Continue the change `demo` through the `factory` skill: invoke it first/);
  assert.match(text, /exactly ONE step of the cycle \(spec → approve → build → review → approve → ship\)/);
  assert.match(text, /specs\/demo\/implementation\.md/, "the ledger is the active change's");
  assert.match(text, /docs\/task-model\.md/, "the task vocabulary is pointed at, not restated");
  assert.match(text, /`stage:`, `round:`, `builder:`, `lenses:`/, "the cycle's position is read from the ledger frontmatter");
  assert.match(text, /If the ledger says `stage: shipped`, emit the line\nNO MORE TASKS\n/);
  assert.match(text, /\nABORT\n/);
  assert.match(text, /\nHANG ON A SECOND\n/);
  assert.match(text, /Never write \.praxis\/approved\/ or \.praxis\/needs-human\//, "the two markers are named as off limits");
  assert.match(text, /pass them paths, never content/);
  assert.match(text, /A red gate is not committed/);
  assert.match(text, /same commit/, "the ledger line is updated in the commit");
  assert.match(text, /Do ONE step\./);
  assert.match(text, /stand alone on a line/, "the own-line rule is stated to the model");
});

test("--task is optional once a change resolves: the goal defaults to continue <change>", () => {
  const { spawn, prompt } = loopRepo({ 1: "NO MORE TASKS" });
  assert.equal(spawn().status, 0);
  assert.match(prompt(1), /Goal: continue demo\n/);
});

test("the next iteration inherits the previous loop commits", () => {
  const { run, prompt } = loopRepo({ 2: "NO MORE TASKS" });
  assert.equal(run("--history", "5").status, 0);
  assert.match(prompt(1), /# LEDGER\n[\s\S]*none yet\n\n# ONE STEP/);
  assert.match(prompt(2), /feat: iteration 1[\s\S]*Praxis-Loop: T01[\s\S]*---/);
});

test("ABORT on its own line ends the run with exit 1 after that iteration", () => {
  const { run, iterations } = loopRepo({ 1: "Cannot proceed: the fixture server is down.\nABORT" });
  const res = run("--max-iterations", "5");
  assert.equal(res.status, 1);
  assert.equal(iterations(), 1, "no iteration runs after ABORT");
  assert.match(res.stdout, /\[loop\] ABORT: agent blocked on iteration 1; diagnostics in /);
});

test("HANG ON A SECOND re-scopes and the next iteration runs", () => {
  const { run, iterations, repo } = loopRepo({
    1: "HANG ON A SECOND\nSplit T01 into T01a and T01b; did T01a.",
    2: "NO MORE TASKS",
  });
  const res = run("--max-iterations", "5");
  assert.equal(res.status, 0);
  assert.equal(iterations(), 2);
  assert.match(res.stdout, /\[loop\] HANG ON A SECOND: task re-scoped on iteration 1; continuing\n/);
  assert.match(res.stdout, /\[loop\] iteration 2\/5\n/);
  assert.doesNotMatch(readFileSync(join(repo, "specs/demo/implementation.md"), "utf8"), /ABORT/);
});

test("NO MORE TASKS, or its alias COMPLETE, exits 0", () => {
  const done = loopRepo({ 1: "Nothing pending in the ledger.\nNO MORE TASKS" });
  const res = done.run();
  assert.equal(res.status, 0);
  assert.equal(done.iterations(), 1);
  assert.match(res.stdout, /\[loop\] DONE: no more tasks — completion confirmed 1 time\(s\)\n/);

  const alias = loopRepo({ 1: "COMPLETE" });
  assert.equal(alias.run().status, 0);
});

test("the iteration cap stops the run with exit 4, outside the model", () => {
  const { run, iterations } = loopRepo();
  const res = run("--max-iterations", "3");
  assert.equal(res.status, 4);
  assert.equal(iterations(), 3);
  assert.match(res.stdout, /\[loop\] STOP: max iterations reached without completion\n$/);
  assert.doesNotMatch(res.stdout, /no progress/, "three committed iterations are progress, not a stall");
});

// The discriminating case for the own-line rule. Matt's afk-claude.sh matched `*ABORT*`
// as a substring, so this first iteration would have ended the run.
test("a signal inside prose is not a signal", () => {
  const { run, iterations } = loopRepo({
    1: "I will not ABORT this one; NO MORE TASKS is a long way off. COMPLETE the slice instead.",
    2: "NO MORE TASKS",
  });
  const res = run("--max-iterations", "5");
  assert.equal(res.status, 0, res.stdout);
  assert.equal(iterations(), 2, "iteration 1 must not be read as ABORT or as completion");
  assert.doesNotMatch(res.stdout, /\[loop\] ABORT/);
  assert.match(res.stdout, /\[loop\] iteration 2\/5\n/);
});

test("--done-streak N asks for the completion signal N consecutive times", () => {
  const { run, iterations } = loopRepo({ 1: "NO MORE TASKS", 2: "NO MORE TASKS" });
  const res = run("--done-streak", "2", "--max-iterations", "5");
  assert.equal(res.status, 0);
  assert.equal(iterations(), 2);
  assert.match(res.stdout, /completion signal seen \(1\/2\)[\s\S]*completion signal seen \(2\/2\)/);
});

// The ESCALATE path (specs/factory-cycle/architecture.md §2): the approver wrote ESCALATE, the
// hook wrote the marker. The loop reads the file, not the output — the fake says nothing about it.
test("exit 5 when .praxis/needs-human/<change> appears, naming what rework and approve do", () => {
  const { run, iterations } = loopRepo(
    { 1: "Round 2 still CHANGES on security; approver dispatched." },
    { 1: "mkdir -p .praxis/needs-human && : > .praxis/needs-human/demo" },
  );
  const res = run("--max-iterations", "5");
  assert.equal(res.status, 5, res.stdout);
  assert.equal(iterations(), 1, "no iteration runs on an escalated change");
  assert.match(res.stdout, /\[loop\] STOP: demo needs a human — \.praxis\/needs-human\/demo exists/);
  assert.match(res.stdout, /\/praxis:rework demo "<note>"\s+archive the review rounds[^\n]*reset the round counter[^\n]*resume the builder/);
  assert.match(res.stdout, /\/praxis:approve demo\s+ship as is: decision\.md APPROVE \(human\), push praxis\/demo, open the PR/);
});

test("exit 0 when the ledger reaches stage: shipped, whatever the output said", () => {
  const { run, iterations } = loopRepo(
    { 1: "PR #142 open." },
    { 1: `cat > specs/demo/implementation.md <<'EOF'\n${LEDGER("shipped")}EOF` },
  );
  const res = run("--max-iterations", "5");
  assert.equal(res.status, 0, res.stdout);
  assert.equal(iterations(), 1);
  assert.match(res.stdout, /\[loop\] DONE: demo is shipped — the ledger says stage: shipped \(after iteration 1\)\n$/);
});

test("a change already shipped or escalated before the first iteration never invokes claude", () => {
  const shipped = loopRepo();
  writeFileSync(join(shipped.repo, "specs/demo/implementation.md"), LEDGER("shipped"));
  assert.equal(shipped.run().status, 0);
  assert.equal(shipped.iterations(), 0);

  const escalated = loopRepo();
  mkdirSync(join(escalated.repo, ".praxis", "needs-human"), { recursive: true });
  writeFileSync(join(escalated.repo, ".praxis", "needs-human", "demo"), "");
  assert.equal(escalated.run().status, 5);
  assert.equal(escalated.iterations(), 0);
});

// Unattended runs cannot answer the floor's ask (evals/floor: the host refuses it under -p).
// `--approve` is the person's answer, given before anything runs.
test("--approve runs approve.sh before the first iteration; nothing to approve stops the run at 2", () => {
  const { run, repo, iterations } = loopRepo({ 1: "NO MORE TASKS" });
  writeFileSync(join(repo, "specs", "demo", "spec.md"), "---\ntitle: demo\nready: true\n---\n# demo — Spec\n");
  const res = run("--approve");
  assert.equal(res.status, 0, res.stdout);
  assert.ok(existsSync(join(repo, ".praxis/approved/demo")), "the marker the floor opens on");
  assert.ok(res.stdout.indexOf("approved demo → .praxis/approved/demo") < res.stdout.indexOf("[loop] iteration 1"), "approval precedes the first iteration");
  assert.equal(iterations(), 1);

  const bare = loopRepo({ 1: "NO MORE TASKS" });
  const refused = bare.run("--approve");
  assert.equal(refused.status, 2);
  assert.match(refused.stderr, /specs\/demo\/spec\.md does not exist/);
  assert.equal(bare.iterations(), 0, "a precondition failure runs no iteration");
});
