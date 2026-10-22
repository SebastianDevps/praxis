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

// ADR-002 (specs/spec-driven-workflow): the ledger moved into the change folder. PROGRESS.md is
// now the index of changes — it may still be named, but only in a sentence that says so. A
// consumer that names it any other way is pointing the executor at a file with no task lines.
test("every skill that touches the ledger names specs/<change>/implementation.md and nothing else", () => {
  for (const f of LEDGER_CONSUMERS) {
    const src = read(f);
    assert.match(src, /specs\/<change>\/implementation\.md/, `${f} does not name the canonical ledger`);
    for (const alias of [/\bplan\.md\b/, /\bprogress\.md\b/, /\btasks\/\*\.md\b/]) {
      assert.doesNotMatch(src, alias, `${f} still names a ledger alias — there is one ledger`);
    }
    for (const m of src.matchAll(/PROGRESS\.md/g)) {
      const sentence = src.slice(src.lastIndexOf(". ", m.index) + 1, src.indexOf(".", m.index + 11) + 1);
      assert.match(sentence, /index/, `${f} names PROGRESS.md as something other than the index: "${sentence.trim()}"`);
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

// The Run Card left the kernel for the `factory` skill (specs/factory-cycle, "Contract diet"): the
// kernel keeps the rules that must hold every turn, the card is rendered where the cycle runs. Every
// Run Card assertion below reads the kernel's card from there.
const RUN_CARD_HOME = (s) => (s === "hooks/context/contract.md" ? "skills/factory/SKILL.md" : s);

test("every priming surface enumerates the phase vocabulary where the Run Card fills it in", () => {
  for (const f of PRIMING_SURFACES.map(RUN_CARD_HOME)) {
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
// `agents/orchestrator.md` left this list with specs/factory-cycle: the card is defined once, in the
// `factory` skill, and the orchestrator points at it instead of re-rendering the table.
const RUN_CARD_SURFACES = [...PRIMING_SURFACES.map(RUN_CARD_HOME), "AGENTS.md"];
// `spec` joined the card with the spec folder (specs/spec-driven-workflow §3). Its fenced form is
// `spec:     specs/<change>/   (stage: <stage>)` — a literal path carrying a placeholder rather
// than a bare `<placeholder>`, so the fenced parser accepts any value that holds one.
const RUN_CARD_FIELDS = ["spec", "phase", "approach", "research", "verify"];

// read() collapses whitespace, which destroys the line structure this parser needs.
const rawRead = (p) => readFileSync(join(ROOT, p), "utf8");

function runCardFields(src) {
  const found = new Set();
  for (const line of src.split("\n")) {
    const fenced = line.match(/^\s*([a-z_]+):\s+(?:[<[{(]|\S.*<[^>]+>)/);
    if (fenced) found.add(fenced[1]);
    const row = line.match(/^\|\s*`([a-z_]+)`\s*\|/);
    if (row) found.add(row[1]);
  }
  return found;
}

test("every surface that renders a Run Card renders the same five fields", () => {
  for (const f of RUN_CARD_SURFACES) {
    const src = rawRead(f);
    const found = runCardFields(src);
    // Without this the parser could match nothing and every assertion below would pass on an
    // empty set — the exact failure this gate was rewritten to remove.
    assert.ok(found.size >= 5, `${f}: parsed ${found.size} Run Card fields — the format changed`);
    const missing = RUN_CARD_FIELDS.filter((x) => !found.has(x));
    assert.deepEqual(missing, [], `${f} renders a Run Card missing ${missing}`);
    assert.doesNotMatch(src, /review_gate/, `${f} still documents the retired six-field Run Card`);
  }
});

// ── the spec folder ───────────────────────────────────────────────────────────────────────────
// The kernel and the router both say what a change leaves behind: the Run Card names its spec
// folder, `fast` writes implementation.md before stopping, `full`/`deep` stop once after design.md,
// and a resume starts from the ledger. Two surfaces, one guarantee each — reword one and the other
// still promises the old flow. Same canary as PRIMING_INVARIANTS: every surface that primes a run
// carries the spec rules, the Cursor always-apply rule included.
const SPEC_SURFACES = ["skills/using-praxis/SKILL.md", "hooks/context/contract.md", ".cursor/rules/praxis.mdc"];

const SPEC_INVARIANTS = [
  ["fast writes implementation.md before stopping", /specs\/<change>\/implementation\.md` — Status, Completed, verify evidence — before you stop/],
  ["resume reads the ledger first", /read `specs\/<change>\/implementation\.md` first/],
];

for (const surface of SPEC_SURFACES) {
  for (const [label, re] of SPEC_INVARIANTS) {
    test(`${surface} keeps the ${label}`, () => {
      assert.match(read(surface), re);
    });
  }
}

for (const surface of SPEC_SURFACES.map(RUN_CARD_HOME)) {
  test(`${surface} keeps the spec line on the Run Card`, () => {
    assert.match(read(surface), /spec:\s+specs\/<change>\/\s+\(stage: <stage>\)/);
  });
}

// The floor is hook-backed, so only the two surfaces on hosts that run the hooks may claim it. The
// Cursor rule stays out: hooks-cursor.json registers neither event, and a surface that promised a
// gate the host does not run would be the "inert gate that looks armed" the hooks warn about.
const FLOOR_SURFACES = ["skills/using-praxis/SKILL.md", "hooks/context/contract.md"];
const FLOOR_INVARIANT = /`hooks\/pre-tool-use` denies source edits[^;]*asks until `\.praxis\/approved\/<change>` exists — a record the model cannot write[^;]*`hooks\/stop` blocks once[^;]*; `PRAXIS_FLOOR=off` is the only override/;

// ADR-006: the approval stop is the host's permission prompt, not prose. The first live cell showed
// the prose STOP not holding while the mechanical deny did, so on hook-backed hosts the rule says
// "the first source edit will ask" and `stage: planned` is the record that someone answered. The
// Cursor rule keeps the prose STOP — it has no PreToolUse, so prose is all it has.
//
// specs/hook-owned-approval: evals/floor measured 3/3 unattended runs setting `stage: planned`
// themselves once the ask was refused. So the approval is now a marker the model cannot write —
// `.praxis/approved/<change>`, from `hooks/post-tool-use` or `/praxis:approve` — and `stage:
// planned` is prose that unlocks nothing. Both surfaces must say so, or the model reads the old
// contract and the field it owns looks like the gate again.
// specs/factory-cycle retargets the floor to `spec.md` and keeps accepting the legacy `design.md`
// (design.md, "Compatibility"); each surface names the file its hooks actually key on.
const ASK_INVARIANTS = [
  ["approval is the host's ask", /`specs\/<change>\/(spec|design)\.md`[^.;]*set the Run Card to `Needs your decision`; the first source edit will ask/i],
  ["approval is a record the model cannot write", /The approval is a record the model cannot write: `\.praxis\/approved\/<change>`, written by `hooks\/post-tool-use` when the approved edit ran, or by the person with `\/praxis:approve <change>`/],
  ["planned is the human-readable record and unlocks nothing", /After approval set `stage: planned` in `implementation\.md` — the human-readable record, it unlocks nothing/],
];
const CURSOR_STOP = /write `specs\/<change>\/design\.md`, set the Run Card to `Needs your decision`, STOP/;

for (const surface of FLOOR_SURFACES) {
  test(`${surface} states the mechanical floor and its single override`, () => {
    assert.match(read(surface), FLOOR_INVARIANT);
  });
  for (const [label, re] of ASK_INVARIANTS) {
    test(`${surface} keeps the ${label}`, () => {
      assert.match(read(surface), re);
    });
  }
}

test(".cursor/rules/praxis.mdc keeps the prose stop — it has no hook to ask with", () => {
  const src = read(".cursor/rules/praxis.mdc");
  assert.match(src, CURSOR_STOP);
  assert.doesNotMatch(src, /first source edit will ask/, "the Cursor rule promises an ask no Cursor hook performs");
  assert.doesNotMatch(src, /\.praxis\/approved/, "the Cursor rule names a marker no Cursor hook writes or reads");
});

test("the spec line sits first on the Run Card, above phase", () => {
  for (const surface of SPEC_SURFACES.map(RUN_CARD_HOME)) {
    const src = read(surface);
    const spec = src.search(/spec:\s+specs\/<change>\//);
    const phase = src.search(/phase:\s*[<[{(]/);
    assert.ok(spec !== -1 && phase !== -1, `${surface} lost a Run Card line`);
    assert.ok(spec < phase, `${surface}: the spec line must come before phase:`);
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
  // The spec templates moved to specs/_templates/ (one source; the two old copies diverged and
  // were deleted). spec-lifecycle promises every file in that folder, so every file is pinned.
  const cited = [
    "specs/_templates/spec.md",
    "specs/_templates/implementation.md",
    "specs/_templates/design.md",
    "specs/_templates/decisions.md",
    "specs/_templates/future-work.md",
    "specs/_templates/AGENTS.md",
    "specs/_templates/CLAUDE.md",
    "specs/_templates/docs/README.md",
    "skills/agentic-lifecycle/assets/task.template.md",
    "skills/agentic-lifecycle/assets/progress.template.md",
    "skills/agentic-lifecycle/assets/spec.template.json",
    "docs/task-model.md",
  ];
  for (const p of cited) {
    assert.ok(existsSync(join(ROOT, p)), `${p} is cited by a skill and does not exist`);
  }
});

// ── the Matt Pocock imports (specs/mattpocock-imports) ────────────────────────────────────────
// Three phrases carry a method the rest of the repo now leans on. Each is a canary in the sense
// of the header comment: reword it and the test fails, which is the reminder that the ledger, the
// bug pipeline and the value evals all quote it.

// The gate the whole debugging skill exists for. The default a bug report invites is to read code
// and guess; the sentence is what forbids that. `evals/value` unit `red-first` measures whether it
// holds in practice — this pins that the text still claims it.
test("systematic-debugging keeps the red-command gate", () => {
  assert.match(read("skills/systematic-debugging/SKILL.md"), /No red-capable command, no hypothesis/);
});

// docs/task-model.md owns the definition of a task; writing-plans applies it. Both quote the slice
// sentence, and they must quote the SAME sentence — a reword in one is a second definition, the
// drift the task-model tests above exist to stop. The sentence is extracted from the canon and
// looked up literally in the consumer, so the gate fires on either side drifting.
test("writing-plans and task-model agree on what a task is, word for word", () => {
  const canon = read("docs/task-model.md");
  const slice = canon.match(/a narrow but COMPLETE path through every layer[^*]*?context window/);
  assert.ok(slice, "task-model no longer states the vertical-slice sentence");
  assert.ok(
    read("skills/writing-plans/SKILL.md").includes(slice[0]),
    `writing-plans does not carry the canon's slice sentence verbatim: "${slice[0]}"`,
  );
});

// The three kinds of verification are the vocabulary a `verify:` line is written in, and the
// four states mean something different for each. Losing a kind silently collapses "the reviewer
// read the summary" into "a person reviewed it".
test("task-model names the three kinds of verification", () => {
  const canon = read("docs/task-model.md");
  for (const kind of ["automated check", "automated review", "human review"]) {
    assert.match(canon, new RegExp(`\\*\\*${kind}\\*\\*`, "i"), `task-model no longer defines "${kind}"`);
  }
  assert.match(canon, /Reading the diff counts; reading the summary does not/, "human review lost its one load-bearing rule");
});

// ── the reviewer's two axes (specs/mattpocock-imports, ADR-004) ─────────────────────────────
// The header note above says the reviewer's review axes are deliberately not pinned because they
// are additive. These two rules are not: drop either and a known-bad pattern comes back rather
// than a nuance being lost. A merged verdict lets one axis mask the other — code that follows
// every standard and implements the wrong thing reads as "mostly fine". And a Spec axis that
// infers requirements from the diff when `design.md` is missing passes by construction: the
// check that cannot fail dressed as a PASS, which the four-state rule exists to name as GAP.
test("reviewer keeps the two axes separate — never merged or reranked", () => {
  const src = read("agents/reviewer.md");
  assert.match(src, /never merged or reranked across axes/, "the no-reranking rule is gone");
  assert.match(src, /## Standards/, "the Standards section header is gone");
  assert.match(src, /## Spec/, "the Spec section header is gone");
});

test("reviewer reports GAP on a missing design.md and never infers requirements from the code", () => {
  const src = read("agents/reviewer.md");
  assert.match(src, /No `design\.md` → the Spec axis reports `GAP`/, "the GAP-on-missing-design rule is gone");
  assert.match(src, /never infers requirements from the code/, "the axis may read the diff as its own spec again");
});
