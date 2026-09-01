// The manifest is the only artifact a directory renders. Nothing else in CI
// reads it, so it drifted silently: it advertised 0.3.0 and "34 skills, 7 agents"
// while the tree held 0.5.0 and 38/11. A plugin whose thesis is evidence over
// assertion cannot ship a stale claim about itself — this gate is the check that
// was missing, not a new rule.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join } from "node:path";

const ROOT = new URL("..", import.meta.url).pathname;
const readJson = (p) => JSON.parse(readFileSync(join(ROOT, p), "utf8"));

const plugin = readJson(".claude-plugin/plugin.json");
const marketplace = readJson(".claude-plugin/marketplace.json");

// One release, one number. Three places state the version and a human updates
// them by hand; two of the three are easy to forget on a release commit.
test("every declared version agrees with plugin.json", () => {
  const declared = [
    ["marketplace metadata", marketplace.metadata.version],
    ...marketplace.plugins.map((p) => [`marketplace entry ${p.name}`, p.version]),
  ];
  for (const [where, version] of declared) {
    assert.equal(version, plugin.version, `${where} claims ${version}`);
  }
});

// Counted the way the README counts them: a skill is a directory carrying a
// SKILL.md; a craft is a directory; agents, pipelines and commands are flat.
const dirs = (rel) =>
  readdirSync(join(ROOT, rel), { withFileTypes: true }).filter((e) => e.isDirectory());
const mdFiles = (rel) =>
  readdirSync(join(ROOT, rel)).filter((f) => f.endsWith(".md"));

const ACTUAL = {
  skills: dirs("skills").filter((d) => existsSync(join(ROOT, "skills", d.name, "SKILL.md"))).length,
  agents: mdFiles("agents").length,
  crafts: dirs("crafts").length,
  pipelines: mdFiles("pipelines").length,
  commands: mdFiles("commands").length,
};

// The rule is "a stated number must be true", NOT "every surface must state a number".
// The first version of this gate demanded counts in the marketplace description too,
// which quietly forced the one line a directory renders to spend itself on an inventory
// instead of on what makes the plugin worth installing. A test should not dictate copy.
const SURFACES = [
  ["marketplace description", marketplace.plugins[0].description],
  ["README inventory table", readFileSync(join(ROOT, "README.md"), "utf8")],
];

for (const [label, text] of SURFACES) {
  for (const [resource, count] of Object.entries(ACTUAL)) {
    test(`${label} does not misstate the ${resource} count`, () => {
      // Matches "38 skills" and the README's "**38** skills" alike.
      const found = text.match(new RegExp(`\\*{0,2}(\\d+)\\*{0,2}\\s+${resource}\\b`));
      if (!found) return; // states no count — nothing to be wrong about
      assert.equal(Number(found[1]), count, `${label} claims ${found[1]} ${resource}`);
    });
  }
}

// ...but the inventory must be stated SOMEWHERE, or every assertion above passes by
// saying nothing. A gate with nothing left to check is a GAP, not a PASS.
test("the README states the full inventory, so the checks above have something to check", () => {
  const readme = readFileSync(join(ROOT, "README.md"), "utf8");
  for (const [resource, count] of Object.entries(ACTUAL)) {
    const found = readme.match(new RegExp(`\\*{0,2}(\\d+)\\*{0,2}\\s+${resource}\\b`));
    assert.ok(found, `README states no ${resource} count`);
    assert.equal(Number(found[1]), count);
  }
});
