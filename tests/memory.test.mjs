// The memory store lives in the USER's project, so CI can never exercise it directly.
// What CI CAN check is the thing that actually broke: the documents describing the store
// drifted apart. `sessions.jsonl` was written by a hook and read by nobody; `gaps.md` was
// defined as the work queue and never written. Both were documented contracts with no
// implementation, and every existing test passed the whole time.
//
// So the gate is structural: every artifact the contract declares must have a producer
// somewhere other than its own definition. That catches the next orphan by construction,
// not by name.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = new URL("..", import.meta.url).pathname;
const read = (p) => readFileSync(join(ROOT, p), "utf8");

const CONTRACT = "skills/praxis-memory/SKILL.md";
const contract = read(CONTRACT);

// Everything that could produce or consume an artifact. The contract file is deliberately
// absent: it declares the artifacts, so finding a name there proves nothing.
const IMPLEMENTORS = [
  "hooks/subagent-stop",
  "hooks/session-start",
  "hooks/lib.sh",
  "commands/learn.md",
  "skills/learn-prune/SKILL.md",
  "skills/learn-graduate/SKILL.md",
].map((p) => ({ path: p, text: read(p) }));

// Pull the artifact names out of the fenced block under "## The five artifacts".
// Templated entries (skills/<name>/SKILL.md) are skipped: there is no literal to match.
const artifactBlock = contract.split("## The five artifacts")[1]?.split("```")[1] ?? "";
const ARTIFACTS = artifactBlock
  .split("\n")
  .map((line) => line.trim().split(/\s+/)[0])
  .filter((tok) => /^[.\w][\w.-]*\.(md|jsonl|gitignore)$|^\.gitignore$/.test(tok));

test("the contract block declares the artifacts this test can check", () => {
  // A refactor that renames the heading would otherwise silently check nothing —
  // an empty list passing every assertion below is a GAP, not a PASS.
  assert.ok(ARTIFACTS.length >= 4, `parsed only ${ARTIFACTS.length} artifacts`);
});

for (const artifact of ARTIFACTS) {
  test(`${artifact} has a producer or consumer outside the contract`, () => {
    const owners = IMPLEMENTORS.filter((f) => f.text.includes(artifact)).map((f) => f.path);
    assert.ok(owners.length > 0, `${artifact} is declared but nothing reads or writes it`);
  });
}

// The three wirings the redesign added. Each was absent before and each is load-bearing:
// without them the artifacts above have a "producer" only in the loosest textual sense.
const WIRING = [
  [
    "commands/learn.md",
    "consumes the captured rows rather than letting them pile up",
    /"state":"pending"[\s\S]{0,400}consolidated|pending[\s\S]{0,200}→ .{0,40}consolidated/,
  ],
  [
    "commands/learn.md",
    "records a single sighting as a gap instead of discarding it",
    /seen exactly once[\s\S]{0,200}gaps\.md/i,
  ],
  [
    "hooks/subagent-stop",
    "excludes the local capture file from the team's commits",
    /\.gitignore[\s\S]{0,120}sessions\.jsonl/,
  ],
  [
    "skills/learn-prune/SKILL.md",
    "decays on last_used, which is the only signal that a lesson still earns its line",
    /last_used/,
  ],
  [
    CONTRACT,
    "states the admission rule that keeps personal notes out of the team store",
    /new teammate would not need it/i,
  ],
  [
    CONTRACT,
    "requires provenance on a lesson, so a distilled claim keeps its evidence",
    /- Source:/,
  ],
];

for (const [file, guarantee, re] of WIRING) {
  test(`${file} ${guarantee}`, () => {
    assert.match(read(file), re);
  });
}
