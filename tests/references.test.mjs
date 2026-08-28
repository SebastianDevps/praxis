// Referential integrity: a routing table that names an agent which does not
// exist sends the orchestrator to dispatch nothing. Nothing caught this before,
// so `platform` and `incident-responder` sat in the routing table unnoticed.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const ROOT = new URL("..", import.meta.url).pathname;
const read = (p) => readFileSync(join(ROOT, p), "utf8");
const dirNames = (d) =>
  readdirSync(join(ROOT, d), { withFileTypes: true }).filter((e) => e.isDirectory()).map((e) => e.name);

const AGENTS = new Set(
  readdirSync(join(ROOT, "agents")).filter((f) => f.endsWith(".md")).map((f) => f.slice(0, -3)),
);
const CRAFTS = dirNames("crafts");
// A routing table cell may name an agent OR the discipline skill for that row.
const SKILLS = new Set(dirNames("skills"));

// Backticked kebab tokens from the ONE table whose header names a specialist
// column. Scanning every table would also pick up the Run Card's field names.
function routedAgents(body, headerWord) {
  const names = new Set();
  let inTable = false;
  for (const line of body.split("\n")) {
    const isRow = line.trim().startsWith("|");
    if (!isRow) { inTable = false; continue; }
    if (line.includes(headerWord)) { inTable = true; continue; }
    if (!inTable) continue;
    for (const cell of line.split("|")) {
      const m = cell.trim().match(/^`([a-z][a-z0-9-]*)`$/);
      if (m) names.add(m[1]);
    }
  }
  return [...names];
}

// The Run Card's `approach:` line enumerates dispatch targets in prose.
function approachTargets(body) {
  const line = body.split("\n").find((l) => l.includes("approach:") && l.includes("→"));
  if (!line) return null;
  return line
    .split("→")[1]
    .split(/[/|<>]/)
    .map((s) => s.trim())
    .filter((s) => /^[a-z][a-z0-9-]*$/.test(s) && s !== "inline" && s !== "delegate");
}

for (const [file, header] of [
  ["agents/orchestrator.md", "Specialist"],
  ["skills/using-praxis/SKILL.md", "Specialist"],
]) {
  test(`${file}: every routed specialist exists`, () => {
    const unresolved = routedAgents(read(file), header).filter((n) => !AGENTS.has(n) && !SKILLS.has(n));
    assert.deepEqual(unresolved, [], `routes to nonexistent agents or skills: ${unresolved}`);
  });
}

for (const file of ["hooks/context/contract.md", "skills/using-praxis/SKILL.md"]) {
  test(`${file}: every Run Card approach target exists`, () => {
    const targets = approachTargets(read(file));
    assert.ok(targets, `${file} lost its Run Card approach line`);
    const unresolved = targets.filter((n) => !AGENTS.has(n));
    assert.deepEqual(unresolved, [], `approach line names nonexistent agents: ${unresolved}`);
  });
}

test("every craft an agent requires exists on disk", () => {
  const missing = [];
  for (const agent of AGENTS) {
    const block = (read(`agents/${agent}.md`).split("---")[1] ?? "").split(/^\s*requires:\s*$/m)[1];
    if (!block) continue;
    for (const line of block.split("\n")) {
      const m = line.match(/^\s*-\s+(\S+)/);
      if (!m) break;
      if (!CRAFTS.includes(m[1])) missing.push(`${agent} → ${m[1]}`);
    }
  }
  assert.deepEqual(missing, [], `agents require nonexistent crafts: ${missing}`);
});

test("every craft on disk is documented in AGENTS.md", () => {
  const agentsMd = read("AGENTS.md");
  const undocumented = CRAFTS.filter((c) => !agentsMd.includes(`\`${c}\``));
  assert.deepEqual(undocumented, [], `crafts exist but AGENTS.md never mentions them: ${undocumented}`);
});
