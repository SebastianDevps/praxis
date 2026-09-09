// Fixtures whose correct answer is computed, not judged. A criterion the grader can derive from
// the fixture is the only kind that survives disagreement about the output's prose.

// ── prose-tells ───────────────────────────────────────────────────────────────────────────────
// Twelve tells planted from the skill's own tables, each with a unique surface string so a scorer
// can count detections without reading. The control has the skill deleted, so a detection there is
// the model's own taste, which is exactly the baseline in question.
// Each entry is a matcher, not a bare string. The em-dash tell was a bare "—" in the first
// version and every output contains one, so both arms scored it for free — a scorer that cannot
// be failed measures nothing. It now requires the tell to be identified: the model either names
// the construct or quotes the clause it opens.
export const PLANTED = [
  { tell: "delve", match: /delve/i },
  { tell: "pivotal moment", match: /pivotal moment/i },
  { tell: "serves as", match: /serves as/i },
  { tell: "not just X but Y", match: /not just/i },
  { tell: "experts believe", match: /experts believe/i },
  { tell: "In order to", match: /in order to/i },
  { tell: "utilize", match: /utilize/i },
  { tell: "leverage", match: /leverage/i },
  { tell: "significantly improves", match: /significantly improves/i },
  { tell: "passive, hidden actor", match: /queries are validated/i },
  { tell: "Title Case heading", match: /title case|Our Engineering Philosophy/i },
  { tell: "em dash as connector", match: /em[\s-]?dash|—\s*the 2024 rewrite/i },
];

const DRAFT = `# Our Engineering Philosophy

Our platform serves as the backbone of modern commerce. In order to delve into what makes it
work, we must first understand a pivotal moment in its history — the 2024 rewrite.

Experts believe that our approach significantly improves throughput. All queries are validated
before they reach the database. We utilize a caching layer and leverage connection pooling.

This is not just an architecture; it is a philosophy.
`;

export const proseTells = {
  id: "prose-tells",
  skill: "prose-tells",
  files: { "DRAFT.md": DRAFT },
  task: "Review DRAFT.md and list every writing problem you find. Quote each one.",
  score: (out) => {
    const found = PLANTED.filter((p) => p.match.test(out));
    return {
      detected: found.length, of: PLANTED.length,
      missed: PLANTED.filter((p) => !found.includes(p)).map((p) => p.tell),
    };
  },
};

// ── color-expert ──────────────────────────────────────────────────────────────────────────────
// WCAG contrast is arithmetic. The grader computes it from the hexes the model emits, so "is this
// palette accessible" is settled by a function rather than by the model's claim about itself.
const BG = "#F5EFE6";
const lum = (hex) => {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
    .map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
export const contrast = (a, b) => {
  const [x, y] = [lum(a), lum(b)].sort((m, n) => n - m);
  return (x + 0.05) / (y + 0.05);
};

export const colorExpert = {
  id: "color-expert",
  skill: "color-expert",
  files: { "TOKENS.md": `Surface background is ${BG} (warm beige). No palette defined yet.\n` },
  task: `Give me an accessible text palette on the ${BG} surface: body text, muted text, and a link colour. Output each as a hex value.`,
  score: (out) => {
    const hexes = [...new Set(out.match(/#[0-9a-fA-F]{6}\b/g) ?? [])].filter((h) => h.toUpperCase() !== BG);
    const ratios = hexes.map((h) => ({ hex: h, ratio: +contrast(h, BG).toFixed(2) }));
    const body = ratios.filter((r) => r.ratio >= 4.5).length;
    return {
      hexes: ratios.length,
      passAA: body,
      worst: ratios.length ? Math.min(...ratios.map((r) => r.ratio)) : null,
      statesRatios: /\b\d\.\d+\s*:\s*1|\b\d+(\.\d+)?:1/.test(out),
      ratios,
    };
  },
};

// ── baseline-status ───────────────────────────────────────────────────────────────────────────
// Web-platform support has a published answer. `:has()` reached Baseline newly available in
// December 2023 (Firefox 121 was the last engine) and is widely available since. The criterion is
// whether the answer is grounded in that vocabulary and gets the verdict right — not whether it
// sounds confident.
export const baselineStatus = {
  id: "baseline-status",
  skill: "baseline-status",
  files: { "browserslist": "defaults\nnot IE 11\n" },
  task: "Is the CSS `:has()` selector safe for us to ship? Answer with the support facts you are relying on.",
  score: (out) => {
    const o = out.toLowerCase();
    return {
      saysBaseline: o.includes("baseline"),
      saysWidely: o.includes("widely available"),
      namesFirefox121: /firefox\s*1(2[0-9]|19)/.test(o),
      namesDate2023: /2023/.test(o),
      verdictShip: /\bsafe\b|\byes\b|ship it|go ahead/.test(o),
    };
  },
};

// ── apple-hig ─────────────────────────────────────────────────────────────────────────────────
// The HIG publishes numbers. A settings screen that ignores safe areas, uses sub-44pt targets, or
// hard-codes point sizes is wrong against a document, not against taste.
export const appleHig = {
  id: "apple-hig",
  skill: "apple-hig",
  files: { "README.md": "SwiftUI app, iOS 18 target. No screens built yet.\n" },
  task: "Design the account settings screen for our iOS app. Give me the layout rules you are applying.",
  score: (out) => {
    const o = out.toLowerCase();
    return {
      safeArea: /safe area|safeareainsets/.test(o),
      touch44: /44\s*(pt|point)/.test(o),
      dynamicType: /dynamic type|\.body|texstyle|font\(\./.test(o),
      grouped: /grouped|insetgrouped|form\b|section/.test(o),
      hitAll: 0,
    };
  },
};

// ── design-system-brutalist ───────────────────────────────────────────────────────────────────
// The unit with the most at stake: four design-system-* skills compete for one decision, and none
// has ever been measured. Brutalist is the discriminating one because its rules are the OPPOSITE
// of the default aesthetic — a model building a dashboard unprompted produces rounded cards and
// soft shadows, which is exactly what the skill forbids.
//
// BOTH arms are asked for a brutalist dashboard. Asking only the treatment would test whether
// naming a style changes the output, which is trivially yes. The question is whether the skill
// produces MORE FAITHFUL brutalism than the model's own notion of the word.
//
// The criteria are the skill's own declarations (SKILL.md:24-28), so a failure is falsifiable
// against the file rather than against taste.
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const readAll = (dir, depth = 3) => {
  let out = "";
  const walk = (d, k) => {
    if (k > depth) return;
    for (const e of readdirSync(d)) {
      if (e === "node_modules" || e.startsWith(".")) continue;
      const p = join(d, e);
      if (statSync(p).isDirectory()) walk(p, k + 1);
      else if (/\.(html|css|jsx?|tsx?|svelte|vue)$/.test(e)) out += readFileSync(p, "utf8") + "\n";
    }
  };
  try { walk(dir, 0); } catch { }
  return out;
};

export const designSystemBrutalist = {
  id: "design-system-brutalist",
  skill: "design-system-brutalist",
  mode: "acceptEdits",
  files: { "README.md": "Static site. No framework, no build step. Write plain HTML and CSS.\n" },
  task: "Build a metrics dashboard page as a single index.html with inline CSS. Brutalist visual style. Four metric cards and a data table.",
  score: (_text, dir) => {
    const raw = readAll(dir);
    // Resolve custom properties first. Both arms declared their fonts as `var(--sans)`, so a
    // literal scan reported "no system font" for the arm that had set --sans to system-ui. A
    // scorer that cannot see through one indirection measures the CSS author's style, not the rule.
    const vars = Object.fromEntries([...raw.matchAll(/(--[\w-]+):\s*([^;]+);/g)].map((m) => [m[1], m[2].trim()]));
    let src = raw;
    for (let i = 0; i < 3; i++) src = src.replace(/var\((--[\w-]+)[^)]*\)/g, (m, n) => vars[n] ?? m);
    const radii = [...src.matchAll(/border-radius:\s*([^;}]+)/g)]
      .flatMap((m) => (m[1].match(/(\d+(?:\.\d+)?)(px|rem|em|%)/g) ?? []))
      .map((v) => (v.endsWith("px") ? parseFloat(v) : v.endsWith("%") ? 999 : parseFloat(v) * 16));

    // Soft is BLUR, not offset. The first version flagged "4px 4px 0 #F2F0EA" as soft because the
    // offsets were large — but a zero-blur hard-offset shadow is the canonical brutalist one, so
    // the scorer penalised the arm that followed the rule. Blur is the third length.
    const blurs = [...src.matchAll(/box-shadow:\s*([^;}]+)/g)].map((m) => {
      const lens = m[1].match(/-?[\d.]+px/g) ?? [];
      return lens.length >= 3 ? parseFloat(lens[2]) : 0;
    });

    // The SANS stack decides, not any stack: every arm writes `ui-monospace` for code, so a scan
    // over all font-family declarations passes both regardless of the rule.
    const stacks = [...src.matchAll(/font-family:\s*([^;}]+)/g)].map((m) => m[1].trim());
    const sans = stacks.filter((s) => !/mono/i.test(s));
    const systemSans = sans.filter((s) => /^\s*(system-ui|-apple-system|ui-sans-serif)/.test(s)).length;

    return {
      wroteCode: src.length > 200,
      maxRadiusPx: radii.length ? Math.max(...radii) : 0,
      radiusOk: (radii.length ? Math.max(...radii) : 0) <= 2,
      sansStacks: sans.length,
      systemSans,
      systemSansOnly: sans.length > 0 && systemSans === sans.length,
      webfont: /@import[^;]*fonts\.googleapis|<link[^>]*fonts\.googleapis/i.test(src),
      borderDecls: (src.match(/\bborder(-(top|right|bottom|left))?:\s*[^;}]*\d/g) ?? []).length,
      shadows: blurs.length,
      blurredShadows: blurs.filter((b) => b > 0).length,
    };
  },
};

// ── tdd / red-first — scored from the STREAM, not the prose ───────────────────────────────────
// Both skills make claims about ORDER: seams confirmed before a test file exists; a red command
// before a hypothesis; a failing test before the implementation. Order is not in the final text,
// it is in the sequence of tool calls, so these scorers parse the stream-json the harness keeps
// in runs/. `score(text, dir)` keeps the harness contract by locating its own stream: run.mjs
// writes `runs/<id>-{treatment,control}.jsonl` before it scores, and the arm is the file whose
// assistant text equals `text`. `scoreEvents` is exported so a saved stream can be re-scored
// without a re-run.
//
// Both units run in acceptEdits: a stop-before-writing criterion that cannot be failed because
// plan mode forbids writing is a GAP, not a PASS. The spec floor (hooks/pre-tool-use) would deny
// the first source write in a spec-less fixture and force both arms into the same ritual, so the
// driver sets PRAXIS_FLOOR=off for these cells — the floor is measured by evals/floor, not here.
// `-p` auto-denies Bash, so the fixture allows node/npm through `.claude/settings.local.json` —
// measured 2026-09-09: the same rules in `.claude/settings.json` were not honoured (1 denial vs 0).
import { existsSync } from "node:fs";

const RUNS = new URL("./runs/", import.meta.url).pathname;

export const parseStream = (raw) => {
  const events = [];
  const results = new Map();
  let meta = {};
  for (const line of raw.split("\n")) {
    if (!line.startsWith("{")) continue;
    let r; try { r = JSON.parse(line); } catch { continue; }
    if (r.type === "system" && r.subtype === "init") meta = { cwd: r.cwd, model: r.model };
    if (r.type === "assistant") for (const b of r.message?.content ?? []) {
      if (b.type === "text") events.push({ kind: "text", text: b.text });
      if (b.type === "tool_use") events.push({ kind: "tool", id: b.id, name: b.name, input: b.input ?? {} });
    }
    if (r.type === "user" && Array.isArray(r.message?.content)) for (const b of r.message.content) {
      if (b.type === "tool_result") {
        const c = Array.isArray(b.content) ? b.content.map((x) => x.text ?? "").join("\n") : String(b.content ?? "");
        results.set(b.tool_use_id, { text: c, error: !!b.is_error });
      }
    }
    if (r.type === "result") meta.cost = r.total_cost_usd ?? 0;
  }
  for (const e of events) if (e.kind === "tool") e.result = results.get(e.id) ?? null;
  return { events, meta, text: events.filter((e) => e.kind === "text").map((e) => e.text).join("\n") };
};

const streamFor = (id, text) => {
  for (const arm of ["treatment", "control"]) {
    const p = join(RUNS, `${id}-${arm}.jsonl`);
    if (!existsSync(p)) continue;
    const s = parseStream(readFileSync(p, "utf8"));
    if (s.text === text) return s;
  }
  return null;
};

const WRITE_TOOLS = new Set(["Write", "Edit", "MultiEdit"]);
const IS_TEST_PATH = (p) => /(^|\/)tests?\/|\.test\.[cm]?js$|\.spec\.[cm]?js$/.test(p);
const IS_SRC_PATH = (p) => /(^|\/)src\//.test(p) && !IS_TEST_PATH(p);
const RUNS_TESTS = (cmd) => /\bnode\s+--test\b|\bnpm\s+(run\s+)?test\b|\bnode\s+(-e|--eval)\b|\bnode\s+\S+\.[cm]?js\b|\bnpx\b/.test(cmd);
// Red is a FAILED assertion or a load failure, never a summary line. The first version matched
// `fail\s*\d`, which `# fail 0` satisfies, so a green baseline run scored as the red command and
// every green-after-fix run scored as still red.
const RED_OUTPUT = (out) => /\bnot ok\b|# fail [1-9]\d*|AssertionError|ERR_ASSERTION|does not provide an export|Missing expected|\bexpected:|expected \d+, got \d+/i.test(out);
const GREEN_OUTPUT = (out) => /# fail 0\b|# pass [1-9]\d*/.test(out) && !RED_OUTPUT(out);

// Every file a tool call touches; a Bash heredoc or redirect is a write too.
const touched = (e) => {
  if (WRITE_TOOLS.has(e.name)) return [e.input.file_path ?? ""];
  if (e.name === "Bash") {
    const cmd = e.input.command ?? "";
    return [...cmd.matchAll(/(?:>{1,2}|tee(?:\s+-a)?)\s*['"]?([\w./-]+\.[cm]?js)/g)].map((m) => m[1]);
  }
  return [];
};

const indexOf = (events, pred) => events.findIndex(pred);
const textBefore = (events, idx) => events.slice(0, idx < 0 ? events.length : idx)
  .filter((e) => e.kind === "text").map((e) => e.text).join("\n");
const textAfter = (events, idx) => idx < 0 ? "" : events.slice(idx + 1)
  .filter((e) => e.kind === "text").map((e) => e.text).join("\n");
const lastText = (events) => [...events].reverse().find((e) => e.kind === "text")?.text ?? "";

const CART_SRC = (totalLine) => `// A cart: items with a price and a quantity.
export function createCart() {
  return { items: [] };
}

export function addItem(cart, { sku, price, quantity = 1 }) {
  cart.items.push({ sku, price, quantity });
  return cart;
}

export function total(cart) {
  return cart.items.reduce((sum, item) => ${totalLine}, 0);
}
`;

const CART_TEST = `import { test } from "node:test";
import assert from "node:assert/strict";
import { createCart, addItem, total } from "../src/cart.js";

test("total of one item at quantity one is its price", () => {
  const cart = addItem(createCart(), { sku: "apple", price: 3, quantity: 1 });
  assert.equal(total(cart), 3);
});
`;

const cartFixture = (totalLine) => ({
  "package.json": JSON.stringify({ name: "cart-fixture", version: "0.0.0", type: "module", scripts: { test: "node --test" } }, null, 2) + "\n",
  "README.md": "Node 22, no dependencies. Tests: `npm test` (node --test, files under test/).\n",
  "src/cart.js": CART_SRC(totalLine),
  "test/cart.test.js": CART_TEST,
  ".claude/settings.local.json": JSON.stringify({ permissions: { allow: ["Bash(node:*)", "Bash(npm:*)", "Bash(npx:*)"] } }, null, 2) + "\n",
});

// ── tdd ───────────────────────────────────────────────────────────────────────────────────────
// The task is fully specified on purpose: an underspecified one lets BOTH arms stop to ask what a
// discount is (the kernel says clarify, don't guess), and that stop would be read as the skill's.
// The only thing left to confirm is the seam, which is the skill's claim.
const DISCOUNT_TASK = "Add an `applyDiscount(cart, code)` capability to the cart in src/cart.js, with tests. " +
  "Rules: code `SAVE10` takes 10% off the total, `FLAT5` takes 5 off the total but never below 0, " +
  "any other code throws an Error. The existing addItem/total API must keep working.";

export const scoreTddEvents = (events) => {
  const firstTest = indexOf(events, (e) => e.kind === "tool" && touched(e).some(IS_TEST_PATH));
  const firstImpl = indexOf(events, (e) => e.kind === "tool" && touched(e).some(IS_SRC_PATH));
  const before = textBefore(events, firstTest);
  const final = lastText(events);
  const testEditsBeforeImpl = events.slice(0, firstImpl < 0 ? events.length : firstImpl)
    .filter((e) => e.kind === "tool" && touched(e).some(IS_TEST_PATH));
  // Count TESTS, not writes: one Write carrying eleven `test(` blocks is the horizontal slice the
  // skill forbids, and a per-write count reported it as 1.
  const countTests = (s) => ((s ?? "").match(/\btest\(/g) ?? []).length;
  const testsBeforeImpl = testEditsBeforeImpl.reduce((n, e) => n + countTests(e.input.content ?? e.input.new_string) - countTests(e.input.old_string), 0);
  const runs = events.filter((e) => e.kind === "tool" && e.name === "Bash" && RUNS_TESTS(e.input.command ?? ""));
  const redRun = runs.find((r) => events.indexOf(r) > firstTest && (firstImpl < 0 || events.indexOf(r) < firstImpl) && RED_OUTPUT(r.result?.text ?? ""));
  const lastImpl = events.reduce((m, e, i) => (e.kind === "tool" && touched(e).some(IS_SRC_PATH) ? i : m), -1);
  // A red cycle is a red run whose nearest preceding write was a test file. A red that follows a
  // source write is a mutation check (both arms do those), not a slice.
  const redCycles = runs.filter((r) => RED_OUTPUT(r.result?.text ?? "")).filter((r) => {
    const prev = events.slice(0, events.indexOf(r)).reverse().find((e) => e.kind === "tool" && touched(e).some((p) => IS_TEST_PATH(p) || IS_SRC_PATH(p)));
    return prev && touched(prev).some(IS_TEST_PATH) && !touched(prev).some(IS_SRC_PATH);
  }).length;
  return {
    redCycles,
    namesSeam: /\bseams?\b/i.test(before) && /applyDiscount/.test(before),
    asksConfirm: /\?/.test(final) && /confirm|agree|proceed|should (we|i)|do you want|okay|ok to|which of|go ahead/i.test(final),
    testFileWritten: firstTest >= 0,
    stoppedBeforeTest: firstTest < 0 && /\?/.test(final) && /confirm|agree|proceed|should (we|i)|do you want|okay|ok to|which of|go ahead/i.test(final),
    // Red before green, first slice: the first test write precedes the first src write, and a
    // test run went red in between. Unobservable when the arm stopped → null, reported as GAP.
    redFirstOrder: firstTest < 0 ? null : firstImpl < 0 ? true : firstTest < firstImpl,
    sawRed: firstTest < 0 ? null : !!redRun,
    statedRedFirst: /(failing test|red)[^.]{0,80}(first|before)|write the test first|test-first|red\s*(→|->|then)\s*green/i.test(before + final),
    testWritesBeforeImpl: testEditsBeforeImpl.length,
    testsBeforeImpl,
    // ADR-003: the skill removed refactor from the loop; a refactor step after the first test is
    // the model putting it back.
    // Inside the loop means between the first test write and the last source write; the final
    // report is outside it, and "refactoring belongs to review, not inside the loop" is not a
    // refactor step — the first version flagged exactly that sentence.
    refactorInLoop: firstTest >= 0 && events.slice(firstTest + 1, lastImpl + 1)
      .some((e) => e.kind === "text" && e.text.split(/(?<=[.!?])\s+|\n+/)
        .some((s) => /\brefactor(ing|ed)?\b/i.test(s) && !/\b(no|not|never|belongs to review|instead|left|without)\b/i.test(s))),
    testRuns: runs.filter((r) => !r.result?.error).length,
    testRunsDenied: runs.filter((r) => r.result?.error).length,
    edits: events.filter((e) => e.kind === "tool" && touched(e).length).flatMap((e) => touched(e).map((p) => p.replace(/^.*\/fixture-[^/]+\//, ""))),
  };
};

export const tdd = {
  id: "tdd",
  skill: "tdd",
  mode: "acceptEdits",
  files: cartFixture("sum + item.price * item.quantity"),
  task: DISCOUNT_TASK,
  score: (text) => {
    const s = streamFor("tdd", text);
    if (!s) return { stream: "unavailable", namesSeam: /\bseams?\b/i.test(text) && /applyDiscount/.test(text) };
    const r = scoreTddEvents(s.events);
    return { ...r, pass: r.namesSeam && r.stoppedBeforeTest, model: s.meta.model };
  },
};

// ── red-first ─────────────────────────────────────────────────────────────────────────────────
// The planted bug: total() drops the quantity. The one existing test uses quantity 1, so the
// suite is green on arrival and the model has to BUILD the red command; reading src/cart.js and
// spotting the bug is the exact anti-pattern the skill names.
// A hypothesis names a MECHANISM. Two defects in the first version, both found by reading the
// streams: bare `bug is` matched "Bug is small and self-contained" (a sizing remark) and failed
// two treatment cells; and `ignores quantity` missed "ignores `quantity`" — a backtick between the
// words — so a control cell that stated the cause before any test run scored as a PASS.
const HYPOTHESIS = /\b(root cause|cause|culprit)\b[^.\n]{0,24}(\bis\b|\bwas\b|\blies\b|:)|\bthe bug is (in|that)\b|\bbecause\b|\bignor(es|ing|ed)\W{0,3}(the |item\.)?\W{0,3}quantity\b|\b(never|not|doesn't|does not|isn't|without)\W{0,3}(multipl\w+|read\w*|account\w*|us\w+)\b[^.\n]{0,24}quantity|\bquantity\W{0,3}(is |being |was )?(never |not )?(ignored|multiplied|dropped|read)\b/i;
const sentenceAt = (text, at) => text.split(/(?<=[.!?])\s+|\n+/).find((s) => {
  const i = text.indexOf(s); return i <= at && at < i + s.length;
})?.trim().slice(0, 200) ?? null;

export const scoreRedFirstEvents = (events) => {
  const isRun = (e) => e.kind === "tool" && e.name === "Bash" && RUNS_TESTS(e.input.command ?? "");
  const firstRun = indexOf(events, isRun);
  const firstRed = indexOf(events, (e) => isRun(e) && RED_OUTPUT(e.result?.text ?? "") && !e.result?.error);
  const firstFix = indexOf(events, (e) => e.kind === "tool" && touched(e).some(IS_SRC_PATH));
  const firstTestWrite = indexOf(events, (e) => e.kind === "tool" && touched(e).some(IS_TEST_PATH));
  const firstRead = indexOf(events, (e) => e.kind === "tool" && e.name === "Read" && /src\/cart\.js$/.test(e.input.file_path ?? ""));
  let firstHypothesis = -1, hypothesisSentence = null;
  events.forEach((e, i) => {
    if (firstHypothesis >= 0 || e.kind !== "text") return;
    const m = e.text.match(HYPOTHESIS);
    if (!m) return;
    firstHypothesis = i;
    hypothesisSentence = sentenceAt(e.text, m.index ?? 0);
  });
  const ranked = Math.max(0, ...events.filter((e) => e.kind === "text" && /hypothes/i.test(e.text))
    .map((e) => (e.text.match(/^\s*(\d+[.)]|H\d|[-*])\s+\S/gm) ?? []).length));
  const greenAfterFix = firstFix >= 0 && events.slice(firstFix + 1).some((e) => isRun(e) && GREEN_OUTPUT(e.result?.text ?? ""));
  const precedes = (a, b) => a >= 0 && (b < 0 || a < b);
  return {
    redCommand: firstRed >= 0,
    redBeforeHypothesis: precedes(firstRed, firstHypothesis),
    redBeforeFix: precedes(firstRed, firstFix),
    readSourceBeforeRed: firstRead >= 0 && (firstRed < 0 || firstRead < firstRed),
    hypothesisSentence,
    rankedHypotheses: ranked,
    regressionTestBeforeFix: precedes(firstTestWrite, firstFix),
    regressionTestProposed: /regression test/i.test(textBefore(events, firstFix)),
    fixed: firstFix >= 0,
    greenAfterFix,
    // Probes are tags written into code; the cleanup grep the skill asks for also says DEBUG-.
    debugProbes: events.filter((e) => e.kind === "tool" && WRITE_TOOLS.has(e.name) && touched(e).some((p) => IS_SRC_PATH(p) || IS_TEST_PATH(p)) && /DEBUG-/.test(e.input.content ?? e.input.new_string ?? "")).length,
    runs: events.filter(isRun).map((e) => (e.input.command ?? "").slice(0, 80)),
  };
};

export const redFirst = {
  id: "red-first",
  skill: "systematic-debugging",
  mode: "acceptEdits",
  files: cartFixture("sum + item.price"),
  task: "Bug report: total() returns the wrong number when an item has quantity > 1. Fix it.",
  score: (text) => {
    const s = streamFor("red-first", text);
    if (!s) return { stream: "unavailable", hypothesisSentence: text.match(HYPOTHESIS)?.[0] ?? null };
    const r = scoreRedFirstEvents(s.events);
    return { ...r, pass: r.redCommand && r.redBeforeHypothesis && r.redBeforeFix, model: s.meta.model };
  },
};

// ── investigation-suite — the dossier, scored against the target rather than read ──────────────
// design.md §Acceptance, four criteria: (a) a `path:line` that RESOLVES, (b) a computed signal
// with the API call that produced it, (c) a named verdict, (d) at least one `SKIP` where the
// target gave nothing. ADR-006 makes (d) load-bearing: a dossier with no SKIP on a partial target
// is a failure, so the scorer counts SKIPs with reasons and reports zero as zero.
//
// Every criterion is checked against something outside the prose: (a) opens the cited file at the
// cited line, (b) matches the reported number against a live API snapshot AND against the tool
// call in the stream that fetched it, (d) requires a reason after the token. (c) is the weak one
// and is reported as two numbers — a verdict token anywhere, and a token on a line that labels
// itself a verdict — because any answer to "should we adopt X" contains the word "adopt".
//
// The unit has no `skill:` field: the ablation removes FOUR skill directories (and, for the bare
// arm, the agent, pipeline and command), which `run.mjs`'s single-skill `withoutSkill` cannot
// express. The driver in `runs/t09-driver.mjs` owns the arms and calls the scorers below; the
// fixture, the task and the scoring live here with the other units.

export const INVESTIGATION_SUITE = {
  skills: ["project-teardown", "dependency-adoption", "architecture-evaluation", "buy-vs-build"],
  extra: ["agents/analyst.md", "pipelines/investigation.md", "commands/investigate.md"],
};

const API_HOSTS = ["packages.ecosyste.ms", "repos.ecosyste.ms", "api.deps.dev", "api.scorecard.dev",
  "api.securityscorecards.dev", "api.github.com", "registry.npmjs.org"];

// A citation is a path plus a line. The lookbehind keeps `https://host:443/x.ts:12` and bare
// `2:30` timestamps out; the extension list keeps `v2.0.4:1` out.
const CITE = /(?<![\w/:-])((?:[\w.@-]+\/)*[\w.@-]+\.(?:ts|tsx|js|jsx|mjs|cjs|json|md|ya?ml|toml|txt|sh)):(\d+)(?:[-–—](\d+))?/g;

// The four verdict vocabularies, design.md §1 table. `adopt-with-guard` is tested before `adopt`
// so the longer token wins its own match.
const VERDICT_TOKENS = [
  /adopt[-\s]with[-\s]guard/i, /\bavoid\b/i, /\badopt\b/i,
  /\bbounded[-\s]buy\b/i, /\bextend[-\s]what[-\s]exists\b/i, /\bbuild\b/i, /\bbuy\b/i,
  /\bnon[-\s]risk\b/i, /\bsensitivity point\b/i, /\btradeoff point\b/i, /\brisk\b/i,
  /\btrial\b/i, /\bassess\b/i, /\bcaution\b/i,
];
const VERDICT_LABEL = /verdict|recommendation|ruling|bottom line/i;

// The signals `dependency-adoption` computes, each with the API field it comes from. The live
// value arrives in a snapshot taken at score time and saved beside the streams, so a re-score is
// stable and a number in the dossier can be wrong rather than merely present.
export const SIGNAL_FIELDS = [
  { key: "maintainers", label: /maintainer/i },
  { key: "dependent_repos_count", label: /dependent[_\s]repo|dependent repositor/i },
  { key: "dependent_packages_count", label: /dependent[_\s]packages?/i },
  { key: "versions_count", label: /versions?[_\s]count|\bversions\b|releases\b/i },
  { key: "downloads", label: /downloads?/i },
  { key: "stargazers_count", label: /stars?|stargazers/i },
  { key: "forks_count", label: /forks?/i },
  { key: "open_issues_count", label: /open issues?/i },
  { key: "advisories", label: /advisor|vulnerabilit|CVE/i },
];

const linesOf = (s) => s.split("\n");
const num = (s) => Number(String(s).replace(/[,_]/g, ""));

// ── (a) citations that resolve ────────────────────────────────────────────────────────────────
// `dir` is the cell's fixture; the clone sits at `dir/target`. A citation is resolved only when
// the file exists, the line is within it, AND the line is not blank — an out-of-range or
// whitespace line is the shape a fabricated citation takes.
export const resolveCitations = (text, dir) => {
  // A dossier cites `target/src/cli/emitter.ts:104` once and then shortens to `emitter.ts:109`.
  // The first version resolved only `dir/rel` and `dir/target/rel`, so 95 of skills-off's 168
  // citations came back "no such file" — the shorthand, not a fabrication — and `README.md:102`
  // resolved against the FIXTURE's 10-line README instead of the target's, scoring a real citation
  // as out of range. A basename index over the target fixes both; ambiguous basenames stay
  // unresolved, because a citation that could mean two files is not checkable.
  const files = [];
  const walk = (d, k = 0) => {
    if (k > 8) return;
    let entries = []; try { entries = readdirSync(d); } catch { return; }
    for (const e of entries) {
      if (e === ".git" || e === "node_modules") continue;
      const p = join(d, e);
      let st; try { st = statSync(p); } catch { continue; }
      if (st.isDirectory()) walk(p, k + 1);
      else files.push(p);
    }
  };
  walk(join(dir, "target"));
  // Match by path SUFFIX, not basename. `register/index.ts:60` is unambiguous under the target,
  // but a basename index keyed it as `index.ts` — which the repo has many of — and 45 real
  // citations came back "ambiguous". A suffix match resolves the sub-path the dossier actually
  // wrote; still ambiguous ones stay unresolved, because a citation that could mean two files is
  // not checkable.
  const bySuffix = (rel) => {
    const hits = files.filter((f) => f === join(dir, "target", rel) || f.endsWith("/" + rel));
    return hits.length === 1 ? hits[0] : hits.length > 1 ? "AMBIGUOUS" : null;
  };

  const check = (file, line) => {
    let body; try { body = linesOf(readFileSync(file, "utf8")); } catch { return null; }
    if (line < 1 || line > body.length) return { ok: false, why: `line ${line} > ${body.length} lines`, file };
    if (!body[line - 1].trim()) return { ok: false, why: "cited line is blank", file };
    return { ok: true, file, text: body[line - 1].trim().slice(0, 120) };
  };

  const seen = new Map();
  for (const m of text.matchAll(CITE)) {
    const [cite, path, lineStr] = [m[0], m[1], m[2]];
    if (seen.has(cite)) continue;
    const line = Number(lineStr);
    const rel = path.replace(/^\.*\//, "");
    const hit = bySuffix(rel);
    const candidates = [join(dir, "target", rel), join(dir, rel), hit && hit !== "AMBIGUOUS" ? hit : null].filter(Boolean);
    // In range beats merely existing: the same basename can exist in both trees.
    const tried = candidates.map((c) => check(c, line)).filter(Boolean);
    const good = tried.find((t) => t.ok);
    const res = good ?? tried[0] ?? { ok: false, why: hit === "AMBIGUOUS" ? "ambiguous basename" : "no such file" };
    seen.set(cite, { cite, ...res, file: res.file ? res.file.replace(dir + "/", "") : undefined });
  }
  const all = [...seen.values()];
  return { total: all.length, resolved: all.filter((c) => c.ok), unresolved: all.filter((c) => !c.ok) };
};

// ── (b) a computed signal with the call that produced it ──────────────────────────────────────
// Three independent halves, so a pass cannot come from prose alone:
//   inStream  — a Bash/WebFetch call to an API host that returned without error
//   cited     — the host, URL or command appears in the dossier itself
//   correct   — the number the dossier reports for that field equals the live value
export const scoreSignals = (text, events, snapshot) => {
  const calls = (events ?? []).filter((e) => e.kind === "tool" && (
    (e.name === "Bash" && API_HOSTS.some((h) => (e.input.command ?? "").includes(h))) ||
    (e.name === "WebFetch" && API_HOSTS.some((h) => (e.input.url ?? "").includes(h)))))
    .map((e) => ({ host: API_HOSTS.find((h) => `${e.input.command ?? ""}${e.input.url ?? ""}`.includes(h)), ok: !e.result?.error }));
  // The host must be one a SUCCESSFUL call reached. Scoring any cited host passed a dossier whose
  // only URL was `api.scorecard.dev` inside a 404 SKIP line — a citation for a lookup that
  // returned nothing, standing in for the call that produced a number. Found by mutation, not review.
  const okHosts = new Set(calls.filter((c) => c.ok).map((c) => c.host));
  const cited = API_HOSTS.filter((h) => text.includes(h) && okHosts.has(h));
  // The number must sit NEXT TO the label, not merely on the same line. Line-scoped matching put
  // `maintainers: 1` on "The contributor list is not one person" (a false PASS) and put
  // `downloads` on a STATUS line reading "3 denied (git, downloads, deps.dev)". It also stopped at
  // the FIRST line carrying a label, so a correct value further down never counted (a false FAIL
  // on skills-off). Now: a window of 40 characters after the label, every line scanned, any
  // correct hit wins. Table cells `| label | 82 |` fall inside that window.
  const stated = [];
  for (const f of SIGNAL_FIELDS) {
    const live = snapshot?.[f.key];
    if (live === undefined || live === null) continue;
    let best = null;
    for (const ln of linesOf(text)) {
      const m = ln.match(f.label);
      if (!m) continue;
      const window = ln.slice((m.index ?? 0) + m[0].length, (m.index ?? 0) + m[0].length + 40);
      const nums = (window.match(/\b[\d][\d,_]*\b/g) ?? []).map(num);
      if (!nums.length) continue;
      const correct = nums.includes(num(live));
      const row = { field: f.key, live, fragment: ln.trim().slice(0, 150), saw: nums.slice(0, 4), correct };
      if (correct) { best = row; break; }
      best = best ?? row;
    }
    if (best) stated.push(best);
  }
  return {
    apiCallsInStream: calls.filter((c) => c.ok).length,
    apiCallsFailed: calls.filter((c) => !c.ok).length,
    apiHostsCitedInDossier: cited,
    signalsStated: stated.length,
    signalsCorrect: stated.filter((s) => s.correct).length,
    stated,
    pass: calls.some((c) => c.ok) && cited.length > 0 && stated.some((s) => s.correct),
  };
};

// ── (c) a named verdict, and (d) a SKIP with a reason ─────────────────────────────────────────
// The SKIP line that merely QUOTES the four-state vocabulary ("PASS · FAIL · SKIP · GAP") is not
// a SKIP; nor is one with nothing after it. A reason is >= 20 characters of text following the
// token on its line or the line under it.
export const scoreVerdictAndSkips = (text) => {
  const ls = linesOf(text);
  // The token must come AFTER the label and close to it. Matching "label anywhere + token
  // anywhere" scored the pipeline's own phase list — "scope → sweep → assess → synthesize →
  // verdict" — as a named verdict in the treatment, and a note about an unreadable pipeline file
  // in skills-off. Both contain a label word and a vocabulary word and neither is a verdict.
  // `## Verdict` on its own line with the call underneath is the most natural form, and a
  // same-line-only window scored it as "no named verdict" for the control — a false negative that
  // would have handed the criterion to the treatment on a formatting difference. When the label
  // line carries nothing after it, the next three non-blank lines are the window.
  const verdictLines = ls.filter((l, i) => {
    const m = l.match(VERDICT_LABEL);
    if (!m) return false;
    const rest = l.slice((m.index ?? 0) + m[0].length);
    const after = rest.replace(/^[\s:—–-]+/, "").length >= 3
      ? rest.slice(0, 60)
      : ls.slice(i + 1).filter((x) => x.trim()).slice(0, 3).join(" ").slice(0, 200);
    return VERDICT_TOKENS.some((t) => t.test(after));
  });
  const anyToken = VERDICT_TOKENS.filter((t) => t.test(text)).length;
  const skips = [];
  ls.forEach((l, i) => {
    if (!/\bSKIP\b/.test(l)) return;
    // A line that also says GAP is the vocabulary being DEFINED, not a section being skipped —
    // the ledger's own `verify:` line ("a citation, a SKIP with reason, or a GAP") was counted as
    // a SKIP in every arm. A real skipped section names the section, not the contract.
    if (/\bGAP\b/.test(l)) return;
    if (/PASS/.test(l) && /FAIL/.test(l)) return;
    const after = l.split(/\bSKIP\b/).slice(1).join(" ").replace(/^[\s:—–-]+/, "");
    const next = (ls[i + 1] ?? "").trim();
    const continues = next && !/^#|^[-*|]\s|\b(SKIP|PASS|FAIL|GAP)\b/.test(next);
    const reason = after.length >= 20 ? after : (continues ? next : "");
    if (reason.length >= 20) skips.push({ line: l.trim().slice(0, 140), reason: reason.slice(0, 140) });
  });
  return {
    namedVerdict: verdictLines.length > 0,
    verdictLines: verdictLines.map((l) => l.trim().slice(0, 160)),
    verdictTokensAnywhere: anyToken,
    skipsWithReason: skips.length,
    skips,
  };
};

// The dossier is what the reader gets: every markdown file the cell wrote under `specs/` plus the
// final assistant text. A cell that answers in the transcript without writing a file is scored on
// the same criteria — the format is not the claim under test.
export const readDossier = (dir, text) => {
  // The acceptance criterion is about the DOSSIER, not the narration. Folding the transcript in
  // scored a truncated treatment cell at 602 citations and 16 SKIPs — nearly all of them sweep
  // commentary, not artifact. Files and transcript are returned separately and scored separately;
  // `both` exists only so an arm that wrote no file is still scored on what it actually delivered.
  let files = "";
  const walk = (d, k = 0) => {
    if (k > 4) return;
    let entries = []; try { entries = readdirSync(d); } catch { return; }
    for (const e of entries) {
      if (e === "_templates" || e === "node_modules" || e === ".git") continue;
      const p = join(d, e);
      if (statSync(p).isDirectory()) walk(p, k + 1);
      else if (/\.md$/.test(e)) files += "\n" + readFileSync(p, "utf8");
    }
  };
  walk(join(dir, "specs"));
  return { files, text: text ?? "", both: files + "\n" + (text ?? "") };
};

const scoreOne = (dossier, events, dir, snapshot) => {
  const a = resolveCitations(dossier, dir);
  const b = scoreSignals(dossier, events, snapshot);
  const cd = scoreVerdictAndSkips(dossier);
  return {
    chars: dossier.length,
    a_resolved: a.resolved.length, a_total: a.total, a_unresolved: a.unresolved, a_pass: a.resolved.length >= 1,
    b, b_pass: b.pass,
    c_pass: cd.namedVerdict, c_verdictLines: cd.verdictLines,
    d_skips: cd.skipsWithReason, d_pass: cd.skipsWithReason >= 1, d_examples: cd.skips.slice(0, 8),
    citations: a.resolved.slice(0, 6),
    pass: a.resolved.length >= 1 && b.pass && cd.namedVerdict && cd.skipsWithReason >= 1,
  };
};

export const scoreDossier = ({ text, events, dir, snapshot }) => {
  const d = readDossier(dir, text);
  const skillsUsed = (events ?? []).filter((e) => e.kind === "tool" && e.name === "Skill");
  // An arm that wrote no artifact is scored on its transcript answer — that IS its deliverable.
  const primary = d.files.trim() ? scoreOne(d.files, events, dir, snapshot) : scoreOne(d.text, events, dir, snapshot);
  return {
    wroteFile: !!d.files.trim(),
    dossier: primary,
    transcript: scoreOne(d.text, events, dir, snapshot),
    skillsInvoked: [...new Set(skillsUsed.filter((e) => !e.result?.error).map((e) => e.input?.skill))],
    skillsRejected: [...new Set(skillsUsed.filter((e) => e.result?.error).map((e) => e.input?.skill))],
    pass: primary.pass,
  };
};
