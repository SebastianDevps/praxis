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

const cell = (pluginDir, cwd, prompt) => {
  const out = execFileSync("claude", [
    "-p", prompt, "--plugin-dir", pluginDir, "--setting-sources", "project,local",
    "--permission-mode", "plan", "--output-format", "stream-json", "--verbose",
  ], { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], maxBuffer: 64 * 1024 * 1024 });
  let text = [], skills = [], cost = 0;
  for (const line of out.split("\n")) {
    if (!line.startsWith("{")) continue;
    const r = JSON.parse(line);
    if (r.type === "assistant") for (const b of r.message?.content ?? []) {
      if (b.type === "text") text.push(b.text);
      if (b.type === "tool_use" && b.name === "Skill") skills.push(b.input?.skill);
    }
    if (r.type === "result") cost = r.total_cost_usd ?? 0;
  }
  return { text: text.join("\n"), skills, cost };
};

// A plugin copy with one skill removed. .git is skipped: it is 90% of the tree and no hook reads it.
const withoutSkill = (skill) => {
  const dir = mkdtempSync(join(tmpdir(), `noskill-${skill}-`));
  cpSync(ROOT, dir, { recursive: true, filter: (s) => !s.includes(`${ROOT}/.git/`) });
  rmSync(join(dir, "skills", skill), { recursive: true, force: true });
  return dir;
};

export async function runUnit(unit) {
  const work = mkdtempSync(join(tmpdir(), `fixture-${unit.id}-`));
  for (const [rel, body] of Object.entries(unit.files ?? {})) {
    mkdirSync(dirname(join(work, rel)), { recursive: true });
    writeFileSync(join(work, rel), body);
  }
  const controlPlugin = withoutSkill(unit.skill);
  const treatment = cell(ROOT, work, `Invoke praxis:${unit.skill} first, then: ${unit.task}`);
  const control = cell(controlPlugin, work, unit.task);
  rmSync(controlPlugin, { recursive: true, force: true });
  return {
    id: unit.id, skill: unit.skill,
    treatment: { ...unit.score(treatment.text), invoked: treatment.skills, cost: treatment.cost, text: treatment.text },
    control: { ...unit.score(control.text), invoked: control.skills, cost: control.cost, text: control.text },
  };
}
