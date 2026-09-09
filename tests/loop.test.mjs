// scripts/loop.sh, driven end to end with a fake `claude` on PATH inside a throwaway git
// repo. The fake prints a canned output per iteration from a fixture directory, records the
// prompt it was handed, and commits once — so the loop sees progress the way it would from a
// real iteration.
//
// What is pinned: the three signals and their exit codes, that a signal is a whole line and
// never a substring (mutation: drop the `x` from `grep -qxE` in has_signal → the prose test
// below fails; restore → passes), and the seven-section shape of the prompt.
import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { chmodSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const ROOT = new URL("..", import.meta.url).pathname;
const LOOP = join(ROOT, "scripts", "loop.sh");

const FAKE_CLAUDE = `#!/usr/bin/env bash
# Fake \`claude -p <prompt>\`: canned output per iteration, prompt recorded, one commit.
dir="$FAKE_CLAUDE_DIR"
n=1
[ -f "$dir/count" ] && n=$(( $(<"$dir/count") + 1 ))
printf '%s' "$n" > "$dir/count"
printf '%s' "$2" > "$dir/prompt-$n.txt"
if [ -f "$dir/$n.out" ]; then printf '%s\\n' "$(<"$dir/$n.out")"; else echo "iteration $n: implemented one task"; fi
if [ ! -f "$dir/$n.nocommit" ]; then
  echo "iteration $n" >> work.log
  git add -A >/dev/null
  git -c user.name=t -c user.email=t@t commit -qm "feat: iteration $n

Task: T0$n
Praxis-Loop: T0$n" >/dev/null
fi
exit 0
`;

function loopRepo(outputs = {}) {
  const repo = mkdtempSync(join(tmpdir(), "praxis-loop-"));
  const home = mkdtempSync(join(tmpdir(), "praxis-loop-home-"));
  const fixtures = mkdtempSync(join(tmpdir(), "praxis-loop-fake-"));
  const bin = join(fixtures, "bin");
  mkdirSync(bin);
  writeFileSync(join(bin, "claude"), FAKE_CLAUDE);
  chmodSync(join(bin, "claude"), 0o755);
  for (const [iteration, text] of Object.entries(outputs)) writeFileSync(join(fixtures, `${iteration}.out`), text);

  execFileSync("git", ["init", "-q"], { cwd: repo });
  mkdirSync(join(repo, "specs", "demo"), { recursive: true });
  mkdirSync(join(repo, ".praxis"), { recursive: true });
  writeFileSync(join(repo, ".praxis", "active-change"), "demo\n");
  writeFileSync(
    join(repo, "specs", "demo", "implementation.md"),
    "---\ntitle: demo\nstage: planned\n---\n\n## Tasks\n- [ ] T01 · phase: build · state: pending · one thing\n      files:  work.log\n      verify: test -f work.log\n",
  );
  execFileSync("git", ["add", "-A"], { cwd: repo });
  execFileSync("git", ["-c", "user.name=t", "-c", "user.email=t@t", "commit", "-qm", "chore: seed"], { cwd: repo });

  const run = (...flags) =>
    spawnSync("bash", [LOOP, "--task", "demo goal", ...flags], {
      cwd: repo,
      env: { PATH: `${bin}:${process.env.PATH}`, HOME: home, FAKE_CLAUDE_DIR: fixtures },
      encoding: "utf8",
      timeout: 30_000,
    });
  const iterations = () => Number(readFileSync(join(fixtures, "count"), "utf8"));
  const prompt = (n) => readFileSync(join(fixtures, `prompt-${n}.txt`), "utf8");
  return { repo, run, iterations, prompt };
}

test("the iteration prompt has the seven sections, the priority order, and the ledger", () => {
  const { run, prompt } = loopRepo({ 1: "NO MORE TASKS" });
  assert.equal(run().status, 0);
  const text = prompt(1);
  const headings = [...text.matchAll(/^# (.+)$/gm)].map((m) => m[1]);
  assert.deepEqual(headings, [
    "LEDGER", "TASK BREAKDOWN", "TASK SELECTION", "EXPLORATION", "EXECUTION", "FEEDBACK LOOPS", "COMMIT", "FINAL RULES",
  ]);
  assert.match(text, /specs\/demo\/implementation\.md/, "the ledger is the active change's");
  assert.match(text, /1\. Critical bugfixes\n2\. Tracer bullets[^\n]*\n3\. Polish and quick wins\n4\. Refactors/);
  assert.match(text, /outrun the headlights/);
  assert.match(text, /\nNO MORE TASKS\n/);
  assert.match(text, /\nABORT\n/);
  assert.match(text, /\nHANG ON A SECOND\n/);
  assert.match(text, /Before committing, run the typecheck and the tests\. Both must pass\./);
  assert.match(text, /same commit/, "the ledger line is updated in the commit");
  assert.match(text, /Work on a SINGLE task/);
  assert.match(text, /stand alone on a line/, "the own-line rule is stated to the model");
});

test("the next iteration inherits the previous loop commits", () => {
  const { run, prompt } = loopRepo({ 2: "NO MORE TASKS" });
  assert.equal(run("--history", "5").status, 0);
  assert.match(prompt(1), /# LEDGER\n[\s\S]*none yet\n\n# TASK BREAKDOWN/);
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
