// Load-bearing phrases. A byte-for-byte comparison is wrong here: the router,
// the Cursor adapter, and the injected contract legitimately differ (the Cursor
// copy names Cursor's own tools). What must NOT differ is the guarantee each
// one carries. Reword a rule and this fails — which is the reminder to propagate
// the change everywhere it is claimed. A canary, not a proof.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = new URL("..", import.meta.url).pathname;
// Whitespace is collapsed before matching: these are prose files, and where a
// sentence happens to wrap is not a semantic change. Without this the gate fails
// on reflowed text and trains people to ignore it.
const read = (p) => readFileSync(join(ROOT, p), "utf8").replace(/\s+/g, " ");

// Every surface that primes a run must carry the same non-negotiables. If one
// drifts, a host silently loses a discipline the README still advertises.
const PRIMING_SURFACES = [
  "skills/using-praxis/SKILL.md",
  ".cursor/rules/praxis.mdc",
  "hooks/context/contract.md",
];

const PRIMING_INVARIANTS = [
  ["clarify gate", /ONE question/],
  ["research before deciding", /stale assumptions/],
  ["delegation over inline building", /inline/i],
  ["verify, not assurance", /should work|Red → fix|acceptance gate/],
];

for (const surface of PRIMING_SURFACES) {
  for (const [label, re] of PRIMING_INVARIANTS) {
    test(`${surface} keeps the ${label}`, () => {
      assert.match(read(surface), re);
    });
  }
}

// The taste guarantees the README sells by name. Dropping one would make the
// Ship Gate claim false without any other test noticing.
const CRAFT_INVARIANTS = [
  ["crafts/anti-slop/anti-slop.md", "the Inter/Roboto ban", /never fall back to Inter/i],
  ["crafts/a11y-baseline/a11y-baseline.md", "the 4.5:1 contrast floor", /4\.5:1/],
  ["crafts/motion-discipline/motion-discipline.md", "the reduced-motion fallback", /prefers-reduced-motion/],
  ["crafts/minimalism/minimalism.md", "the ladder", /Stop at the first rung/],
  ["crafts/orchestration/orchestration.md", "thin orchestrator context", /context thin/],
];

for (const [file, label, re] of CRAFT_INVARIANTS) {
  test(`${file} keeps ${label}`, () => {
    assert.match(read(file), re);
  });
}

// The safety carve-outs are the line between lazy and careless. They are the
// one part of the contract that must never be trimmed for brevity.
test("the injected contract keeps every safety carve-out", () => {
  const contract = read("hooks/context/contract.md");
  for (const phrase of ["trust boundaries", "data loss", "security", "accessibility"]) {
    assert.match(contract, new RegExp(phrase), `contract dropped: ${phrase}`);
  }
});
