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
  ["crafts/evidence-discipline/evidence-discipline.md", "the both-directions mutation", /watch it fail\. Then restore and watch it pass/],
];

// One pin outside the crafts, and only one. A revert here does not lose nuance — it reintroduces a
// vulnerability. This line has been wrong twice: first as a denylist (`localhost` / `10.*`, which
// misses decimal-encoded IPs and every IPv6 form), then as "reject if not unicast", which reads as
// stricter and is not — Go's net.IP.IsGlobalUnicast() returns true for RFC 1918 and says so in its
// own doc comment, so that predicate passes 10.0.0.5. Both wrong forms look like protection.
//
// Deliberately NOT pinned: the aria-live section and the reviewer's review axes. Both are additive
// — removing them degrades gracefully rather than resurrecting a known-bad pattern — and a pin per
// line of doctrine would fire on every legitimate rewording, which is how a gate gets muted.
test("skills/security keeps the SSRF rule that replaced two broken ones", () => {
  const src = read("skills/security/SKILL.md");
  assert.match(src, /publicly routable/i, "the SSRF check lost its allowlist form");
  assert.match(src, /IsGlobalUnicast/, "the SSRF rule dropped the named trap that makes it correct");
});

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

// ── the task model ────────────────────────────────────────────────────────────────────────────
// Before docs/task-model.md there were four ledger names (PROGRESS.md, plan.md, progress.md,
// tasks/*.md), four phase vocabularies, and the word `status` meaning a change's phase in one
// skill and a task's state in another. Work handed between skills arrived in a shape the receiver
// did not recognise. These three tests are what stops that from growing back: the failure mode is
// not a broken build, it is a second definition quietly appearing in a skill that felt like the
// natural place for it.
import { readdirSync, existsSync } from "node:fs";

const LEDGER_CONSUMERS = [
  "skills/writing-plans/SKILL.md",
  "skills/subagent-driven-development/SKILL.md",
  "skills/autonomous-loop/SKILL.md",
  "skills/agentic-lifecycle/SKILL.md",
  "commands/loop.md",
];

test("every skill that touches the ledger names PROGRESS.md and nothing else", () => {
  for (const f of LEDGER_CONSUMERS) {
    const src = read(f);
    assert.match(src, /PROGRESS\.md/, `${f} does not name the canonical ledger`);
    for (const alias of [/\bplan\.md\b/, /\bprogress\.md\b/, /\btasks\/\*\.md\b/]) {
      assert.doesNotMatch(src, alias, `${f} still names a ledger alias — there is one ledger`);
    }
  }
});

test("the phase and state vocabularies are defined once, in docs/task-model.md", () => {
  const canon = read("docs/task-model.md");
  for (const phase of ["define", "plan", "build", "verify", "review", "ship"]) {
    assert.match(canon, new RegExp(`\`${phase}\``), `canon is missing phase ${phase}`);
  }
  for (const state of ["pending", "in_progress", "review", "done", "blocked\\(technical\\)", "blocked\\(user\\)"]) {
    assert.match(canon, new RegExp(`\`${state}\``), `canon is missing state ${state}`);
  }
  // The consumers must POINT at it, not restate it. A skill that redefines the table is how the
  // four vocabularies happened the first time.
  for (const f of LEDGER_CONSUMERS) {
    assert.match(read(f), /docs\/task-model\.md/, `${f} does not point at the canonical task model`);
  }
});

// v0.4.0 shipped docs/task-model.md and the behaviour did not change: the three surfaces injected
// into every turn named neither `define` nor `ship` and linked no canon, so the Run Card's
// `phase:` field was free text and the model wrote whatever it invented. The gate above missed it
// because LEDGER_CONSUMERS means "skill that touches the ledger" — a scope that excludes the
// highest-traffic files in the repo. The instrument was real; its scope was wrong.
//
// The gate must assert the vocabulary WHERE IT IS FILLED IN, not anywhere in the file. An earlier
// version checked that `define` and `ship` appeared somewhere — on the argument that the other
// four are ordinary English and would pass vacuously. A refuter broke it in two lines: shrink the
// field to `<define | ship — ...>` and four of six phases vanish with the test still green, and a
// sentence like "define the acceptance gate — never ship what you cannot verify" satisfies it with
// the field gone entirely. Rare tokens were substituted for co-occurrence; only co-occurrence is
// the thing worth protecting. Matching inside `<...>` also survives a punctuation change, which a
// literal `define | plan | ...` match would not — a gate that fires on correct work gets muted.
const PHASES = ["define", "plan", "build", "verify", "review", "ship"];

test("every priming surface enumerates the phase vocabulary where the Run Card fills it in", () => {
  for (const f of PRIMING_SURFACES) {
    const src = read(f);
    // The delimiter is a style choice, not the contract. Pinning `<` failed this gate on a
    // bracket swap that removed nothing — the same fire-on-correct-work class the comment
    // above claims to have fixed, moved from field names to a glyph. Accept any placeholder.
    const fields = [...src.matchAll(/phase:\s*[<[{(]([^>\]})]*)[>\]})]/g)].map((m) => m[1]);
    assert.ok(fields.length > 0, `${f} has no Run Card \`phase:\` field to enumerate`);
    const missing = PHASES.filter((ph) => !fields.some((v) => new RegExp(`\\b${ph}\\b`).test(v)));
    assert.deepEqual(
      missing,
      [],
      `${f} names no phase: field carrying the full vocabulary — missing ${missing}`,
    );
    assert.match(src, /docs\/task-model\.md/, `${f} does not link the canonical task model`);
  }
});

// Five surfaces render a Run Card and two had drifted apart unnoticed: the kernel and the README
// showed four fields while `agents/orchestrator.md` and `AGENTS.md` — the file that calls itself
// the host-agnostic source of truth every host reads — still documented six, sharing exactly one
// field name with the card the product shows.
//
// The first version of this gate asserted the four field NAMES appeared anywhere in the file. Half
// of it was vacuous: deleting the `approach` row from orchestrator.md left the test green, because
// "approach" is an ordinary word that appears in that file's prose. Presence in a file is not
// presence in a Run Card. This version parses the two real shapes — `field:` inside the fenced
// block, and `| \`field\` |` as a table row — and asserts against what it actually parsed.
const RUN_CARD_SURFACES = [...PRIMING_SURFACES, "agents/orchestrator.md", "AGENTS.md"];
const RUN_CARD_FIELDS = ["phase", "approach", "research", "verify"];

// read() collapses whitespace, which destroys the line structure this parser needs.
const rawRead = (p) => readFileSync(join(ROOT, p), "utf8");

function runCardFields(src) {
  const found = new Set();
  for (const line of src.split("\n")) {
    const fenced = line.match(/^\s*([a-z_]+):\s+[<[{(]/);
    if (fenced) found.add(fenced[1]);
    const row = line.match(/^\|\s*`([a-z_]+)`\s*\|/);
    if (row) found.add(row[1]);
  }
  return found;
}

test("every surface that renders a Run Card renders the same four fields", () => {
  for (const f of RUN_CARD_SURFACES) {
    const src = rawRead(f);
    const found = runCardFields(src);
    // Without this the parser could match nothing and every assertion below would pass on an
    // empty set — the exact failure this gate was rewritten to remove.
    assert.ok(found.size >= 4, `${f}: parsed ${found.size} Run Card fields — the format changed`);
    const missing = RUN_CARD_FIELDS.filter((x) => !found.has(x));
    assert.deepEqual(missing, [], `${f} renders a Run Card missing ${missing}`);
    assert.doesNotMatch(src, /review_gate/, `${f} still documents the retired six-field Run Card`);
  }
});

test("`status` no longer means two things — spec-lifecycle tracks a stage", () => {
  const spec = read("skills/spec-lifecycle/SKILL.md");
  assert.match(spec, /Advance the `stage:` frontmatter field/, "spec-lifecycle must advance `stage:`");
  // Matches the USE, not the mention: the skill deliberately says "the field is `stage:`, not
  // `status:`" to catch a reader who learned the old name, and a test that forbade the word
  // outright would delete the sentence that prevents the mistake.
  assert.doesNotMatch(spec, /Advance the `status:`/, "the collided field name came back");
  // …and the task surfaces must not borrow it either.
  for (const f of ["skills/agentic-lifecycle/assets/task.template.md", "docs/task-model.md"]) {
    assert.doesNotMatch(read(f), /^.*\bstatus:\s/m, `${f} uses \`status\` for a task — that is \`state\``);
  }
});

test("every referenced template exists on disk", () => {
  // templates/spec.md was cited by three files and did not exist. links.test.mjs missed it: the
  // citations sit in backticks, and that test deliberately checks prose paths only. A path inside
  // code fences is "shown, not promised" — except when the sentence around it is a promise.
  const cited = [
    "skills/spec-lifecycle/templates/spec.md",
    "skills/agentic-lifecycle/assets/task.template.md",
    "skills/agentic-lifecycle/assets/progress.template.md",
    "skills/agentic-lifecycle/assets/spec.template.json",
    "docs/task-model.md",
  ];
  for (const p of cited) {
    assert.ok(existsSync(join(ROOT, p)), `${p} is cited by a skill and does not exist`);
  }
});
