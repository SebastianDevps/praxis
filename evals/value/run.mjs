// run.mjs — does a skill produce something the model does not produce without it?
//
// The question the activation audit cannot answer. "0 activations" says a skill was not used; it
// says nothing about what it would have contributed. This runs the same task twice against the
// same fixture — once with the plugin intact and the skill invoked, once against a plugin copy
// with that skill's directory REMOVED — and scores both outputs against a criterion computed from
// the fixture rather than judged from the prose.
//
// The control has the skill deleted rather than merely not invoked, so a stray activation cannot
// contaminate it. The treatment names the skill in the prompt because routing is a separate
// question, measured by scripts/routing-audit.mjs; this measures CONTENT.
//
// n=1 per arm is a screening pass, not a proof. It separates clearly-contributes from
// clearly-does-not and leaves a band in the middle. Re-run an ambiguous unit rather than reading
// tea leaves in a single pair.
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, cpSync, writeFileSync, mkdirSync, readFileSync } from "node:fs";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { tmpdir } from "node:os";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");

// `mode` defaults to plan: a unit scored on what the model SAYS needs no write access, and plan
// mode keeps the fixture pristine between arms. A unit scored on what the model BUILDS has to be
// able to write, and passes acceptEdits.
const cell = (pluginDir, cwd, prompt, mode = "plan") => {
  const out = execFileSync("claude", [
    "-p", prompt, "--plugin-dir", pluginDir, "--setting-sources", "project,local",
    "--permission-mode", mode, "--output-format", "stream-json", "--verbose",
  ], { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], maxBuffer: 64 * 1024 * 1024 });
  // An ATTEMPT is not an invocation. The control arm, seeing design-system-swiss/clean/bento in
  // its list, inferred design-system-brutalist existed and called it; the call failed, and the
  // first version of this parser recorded it as a successful invocation and made the control look
  // contaminated. Attempts are correlated with their tool_result and only successes are reported.
  let text = [], attempted = new Map(), failed = new Set(), cost = 0;
  for (const line of out.split("\n")) {
    if (!line.startsWith("{")) continue;
    const r = JSON.parse(line);
    if (r.type === "assistant") for (const b of r.message?.content ?? []) {
      if (b.type === "text") text.push(b.text);
      if (b.type === "tool_use" && b.name === "Skill") attempted.set(b.id, b.input?.skill);
    }
    if (r.type === "user" && Array.isArray(r.message?.content)) for (const b of r.message.content) {
      if (b.type === "tool_result" && b.is_error) failed.add(b.tool_use_id);
    }
    if (r.type === "result") cost = r.total_cost_usd ?? 0;
  }
  const skills = [...new Set([...attempted].filter(([id]) => !failed.has(id)).map(([, s]) => s))];
  const rejected = [...new Set([...attempted].filter(([id]) => failed.has(id)).map(([, s]) => s))];
  return { text: text.join("\n"), skills, rejected, cost, raw: out };
};

// A plugin copy with one skill removed. .git is skipped: it is 90% of the tree and no hook reads it.
const withoutSkill = (skill) => {
  const dir = mkdtempSync(join(tmpdir(), `noskill-${skill}-`));
  cpSync(ROOT, dir, { recursive: true, filter: (s) => !s.includes(`${ROOT}/.git/`) });
  rmSync(join(dir, "skills", skill), { recursive: true, force: true });
  return dir;
};

const seed = (unit) => {
  const work = mkdtempSync(join(tmpdir(), `fixture-${unit.id}-`));
  for (const [rel, body] of Object.entries(unit.files ?? {})) {
    mkdirSync(dirname(join(work, rel)), { recursive: true });
    writeFileSync(join(work, rel), body);
  }
  return work;
};

export async function runUnit(unit) {
  // Each arm gets its OWN fixture copy. Sharing one directory lets the first arm's files brief the
  // second, which would read as the skill's contribution and is not.
  const controlPlugin = withoutSkill(unit.skill);
  const tDir = seed(unit), cDir = seed(unit);
  const treatment = cell(ROOT, tDir, `Invoke praxis:${unit.skill} first, then: ${unit.task}`, unit.mode);
  const control = cell(controlPlugin, cDir, unit.task, unit.mode);
  rmSync(controlPlugin, { recursive: true, force: true });
  // Raw streams are kept so a scorer defect costs a re-score, not a re-run. Two of this harness's
  // scorers were wrong on first contact; re-running to find that out would have cost $6 a time.
  const runs = join(ROOT, "evals", "value", "runs");
  mkdirSync(runs, { recursive: true });
  writeFileSync(join(runs, `${unit.id}-treatment.jsonl`), treatment.raw);
  writeFileSync(join(runs, `${unit.id}-control.jsonl`), control.raw);
  return {
    id: unit.id, skill: unit.skill, dirs: { treatment: tDir, control: cDir },
    treatment: { ...unit.score(treatment.text, tDir), invoked: treatment.skills, rejected: treatment.rejected, cost: treatment.cost },
    control: { ...unit.score(control.text, cDir), invoked: control.skills, rejected: control.rejected, cost: control.cost },
  };
}
