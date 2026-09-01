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

// Both surfaces sell the same inventory: the marketplace entry a directory
// renders, and the README table a human reads. Either one drifting is the bug.
const SURFACES = [
  ["marketplace description", marketplace.plugins[0].description],
  ["README inventory table", readFileSync(join(ROOT, "README.md"), "utf8")],
];

for (const [label, text] of SURFACES) {
  for (const [resource, count] of Object.entries(ACTUAL)) {
    test(`${label} states the real ${resource} count`, () => {
      // Matches "38 skills" and the README's "**38** skills" alike.
      const claim = new RegExp(`\\*{0,2}(\\d+)\\*{0,2}\\s+${resource}\\b`);
      const found = text.match(claim);
      assert.ok(found, `no ${resource} count found in ${label}`);
      assert.equal(Number(found[1]), count, `${label} claims ${found[1]} ${resource}`);
    });
  }
}
