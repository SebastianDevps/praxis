// routing-audit.mjs — does a description actually route the prompt it claims?
//
// Praxis measured its own activation from 961 transcripts once: 154 agent dispatches against 3
// skill invocations. That instrument is honest but expensive and retrospective — it can only tell
// you what already went wrong, weeks later. This one runs on the corpus itself, costs nothing,
// and fails CI.
//
// WHAT IT IS: a deterministic proxy, not the model's attention. It ranks each eval prompt against
// every resource description with TF-IDF cosine similarity. A real router is an LLM reading those
// same descriptions; this approximates the signal available to it. Treat the absolute numbers as a
// baseline to hold, and the DELTA as the thing that means something.
//
// WHAT IT CATCHES that nothing else does:
//   - a description that no longer wins its own prompts (drift)
//   - two descriptions so alike neither can be picked over the other (collision)
//   - a near-miss prompt whose declared sibling is unreachable (a routing dead end)
//   - a `route_to` naming a resource that does not exist (the class that shipped twice here)
//
// Floors are RATCHETS: set from the first real measurement with a small margin, never
// aspirationally. A floor above what the corpus can do trains people to ignore the gate; a floor
// far below it is decorative. Raise one only after a change actually raises the number.
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

// Set from the first honest measurement (2026-08-28: rank-1 54.4 · top-3 73.3 · route 81.4 ·
// owner-at-1 11.8 · collision 0.57), each with a few points of margin so ordinary edits do not
// flap the gate. The first floors written here were aspirational — 60/80/80 — and failed on the
// corpus they were meant to describe. That is the wrong direction: a floor is a description of
// what holds today, and a ratchet upward when a change earns it.
export const FLOORS = {
  rank1: 50,          // a positive prompt puts its own skill first
  top3: 68,           // …or at least in the top three
  routedTop3: 76,     // a near-miss prompt reaches its declared sibling
  maxOwnerAtOne: 16,  // a near-miss must NOT be won by the skill it was written against
  maxCollision: 0.62, // two descriptions this alike cannot be told apart by a reader either
};

// WHY rank-1 SITS NEAR 54 AND NOT 90 — read before "fixing" it.
//
// Part of it is real: an abstract description ("2–4 plausible approaches") shares no vocabulary
// with the concrete prompt that should reach it ("Redis or in-memory for sessions?"). That is a
// genuine discriminative weakness and raising it is legitimate work.
//
// Part of it is structural and will never move. Several positives deliberately test POLICY rather
// than topic — "Build me a dashboard" must reach `brainstorming` because it is vague, not because
// it shares words with it. A lexical ranker cannot resolve vagueness by construction, and those
// cases still belong in the file because an LLM router can. Chasing them by stuffing keywords into
// descriptions would raise this number while making the descriptions worse.
//
// So: treat the DELTA as the signal. A drop means something changed. The absolute value is a
// property of the proxy as much as of the corpus.
//
// Known tension worth keeping in view: adding `od.triggers` raised recall (top-3 69.4 → 73.3) and
// simultaneously worsened precision on near-misses (owner-at-1 7.6 → 11.8). Triggers make a skill
// match its own topic vocabulary harder, including on prompts that belong to a sibling.

// Words that carry no routing signal. Kept short on purpose: an aggressive stoplist hides real
// vocabulary overlap, which is the thing this audit exists to find.
const STOP = new Set(`a an the and or of to in on for with is are be by that this it its use used
using when whether not never only just from as at into over under after before your you we our
they i me my do does did can could should would will shall than then them their there here what
which who whom how why if else so such other another each every any some all more most less least
own same too very s t don now`.split(/\s+/));

const tokenize = (text) =>
  String(text)
    .toLowerCase()
    .split(/[^\p{L}\p{N}]+/u)
    .filter((w) => w.length > 1 && !STOP.has(w));

// ── corpus ────────────────────────────────────────────────────────────────────────────────────
// Agents are in the corpus alongside skills because a near-miss may legitimately route to an
// agent (`refuter-security`, `reviewer`). Leaving them out would report a live route as a dead one.
function frontmatter(text) {
  const m = /^---\r?\n([\s\S]*?)\r?\n---/.exec(text);
  return m ? m[1] : "";
}
function field(fm, key) {
  const m = new RegExp(`^${key}:[ \\t]*(.*)$`, "m").exec(fm);
  return m ? m[1].trim().replace(/^["']|["']$/g, "") : "";
}
// `od.triggers` are part of the routing surface, so they belong in the ranked text.
//
// Written first as a single regex anchored at four-space indentation. The real format indents
// `triggers:` by two, so it matched nothing and every skill ranked without its triggers — and the
// numbers looked plausible enough that nothing said so. Hence loadCorpus is asserted in
// tests/routing.test.mjs against a skill whose triggers are known: a parser that silently returns
// empty is the failure mode this whole audit exists to catch elsewhere.
function triggers(fm) {
  const lines = fm.split(/\r?\n/);
  const start = lines.findIndex((l) => /^\s+triggers:\s*$/.test(l));
  if (start === -1) return [];
  const indent = lines[start].match(/^\s*/)[0].length;
  const out = [];
  for (let i = start + 1; i < lines.length; i++) {
    const line = lines[i];
    if (!line.trim()) continue;
    if (line.match(/^\s*/)[0].length <= indent) break; // dedented — the block ended
    const m = /^\s*-\s*(.+)$/.exec(line);
    if (m) out.push(m[1].trim().replace(/^["']|["']$/g, ""));
  }
  return out;
}

export function loadCorpus(root = ROOT) {
  const out = [];
  const skillsDir = join(root, "skills");
  for (const id of readdirSync(skillsDir).sort()) {
    const file = join(skillsDir, id, "SKILL.md");
    if (!existsSync(file)) continue;
    const fm = frontmatter(readFileSync(file, "utf8"));
    out.push({ id, kind: "skill", text: [id.replace(/-/g, " "), field(fm, "description"), ...triggers(fm)].join(" ") });
  }
  const agentsDir = join(root, "agents");
  for (const f of readdirSync(agentsDir).sort()) {
    if (!f.endsWith(".md")) continue;
    const id = f.slice(0, -3);
    const fm = frontmatter(readFileSync(join(agentsDir, f), "utf8"));
    out.push({ id, kind: "agent", text: [id.replace(/-/g, " "), field(fm, "description")].join(" ") });
  }
  return out;
}

// ── cases ─────────────────────────────────────────────────────────────────────────────────────
// Line-scanned rather than YAML-parsed: no dependency, and the shape is enforced by
// tests/routing.test.mjs, so a malformed file fails there with a better message than a parser gives.
export function loadCases(root = ROOT) {
  const cases = [];
  const skillsDir = join(root, "skills");
  for (const id of readdirSync(skillsDir).sort()) {
    const file = join(skillsDir, id, "evals", "cases.yaml");
    if (!existsSync(file)) continue;
    const lines = readFileSync(file, "utf8").split(/\r?\n/);
    let section = "";
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (/^should_trigger:/.test(line)) { section = "positive"; continue; }
      if (/^should_not_trigger:/.test(line)) { section = "negative"; continue; }
      if (/^capability:/.test(line)) { section = ""; continue; }
      const p = /^ {2}- prompt:\s*"(.*)"\s*$/.exec(line);
      if (!p || !section) continue;
      let routeTo = null;
      if (section === "negative") {
        // Scan forward to the next entry only — a route_to belongs to the prompt above it.
        for (let j = i + 1; j < lines.length; j++) {
          if (/^ {2}- prompt:|^\S/.test(lines[j])) break;
          const r = /^\s+route_to:\s*(.+?)\s*$/.exec(lines[j]);
          if (r) { routeTo = r[1].replace(/^["']|["']$/g, ""); break; }
        }
      }
      cases.push({ owner: id, kind: section, prompt: p[1], routeTo });
    }
  }
  return cases;
}

// ── ranking ───────────────────────────────────────────────────────────────────────────────────
export function buildRanker(corpus) {
  const docs = corpus.map((c) => tokenize(c.text));
  const df = new Map();
  for (const doc of docs) for (const w of new Set(doc)) df.set(w, (df.get(w) ?? 0) + 1);
  const N = docs.length;
  const idf = (w) => Math.log((N + 1) / ((df.get(w) ?? 0) + 1)) + 1;

  const vectorize = (tokens) => {
    const tf = new Map();
    for (const w of tokens) tf.set(w, (tf.get(w) ?? 0) + 1);
    const v = new Map();
    let norm = 0;
    for (const [w, n] of tf) {
      const x = (1 + Math.log(n)) * idf(w);
      v.set(w, x);
      norm += x * x;
    }
    norm = Math.sqrt(norm) || 1;
    for (const [w, x] of v) v.set(w, x / norm);
    return v;
  };

  const vectors = docs.map(vectorize);
  const cosine = (a, b) => {
    // Iterate the smaller vector: the cost is the overlap, not the vocabulary.
    const [s, l] = a.size < b.size ? [a, b] : [b, a];
    let sum = 0;
    for (const [w, x] of s) { const y = l.get(w); if (y) sum += x * y; }
    return sum;
  };

  return {
    vectors,
    rank(prompt) {
      const q = vectorize(tokenize(prompt));
      return corpus
        .map((c, i) => ({ id: c.id, score: cosine(q, vectors[i]) }))
        .sort((a, b) => b.score - a.score || a.id.localeCompare(b.id));
    },
    similarity: (i, j) => cosine(vectors[i], vectors[j]),
  };
}

// ── audit ─────────────────────────────────────────────────────────────────────────────────────
export function audit(root = ROOT) {
  const corpus = loadCorpus(root);
  const known = new Set(corpus.map((c) => c.id));
  const cases = loadCases(root);
  const ranker = buildRanker(corpus);

  const positives = cases.filter((c) => c.kind === "positive");
  const negatives = cases.filter((c) => c.kind === "negative");

  let r1 = 0, r3 = 0, r5 = 0;
  const gaps = new Map(); // owner -> count of its own prompts outside top-5
  for (const c of positives) {
    const top = ranker.rank(c.prompt).slice(0, 5).map((x) => x.id);
    if (top[0] === c.owner) r1++;
    if (top.slice(0, 3).includes(c.owner)) r3++;
    if (top.includes(c.owner)) r5++;
    else gaps.set(c.owner, (gaps.get(c.owner) ?? 0) + 1);
  }

  let ownerAtOne = 0, routedTop3 = 0, routable = 0;
  const deadRoutes = [];
  for (const c of negatives) {
    const top = ranker.rank(c.prompt).slice(0, 5).map((x) => x.id);
    if (top[0] === c.owner) ownerAtOne++;
    if (!c.routeTo) continue;
    if (c.routeTo === "none" || c.routeTo.startsWith("external:")) continue;
    if (!known.has(c.routeTo)) { deadRoutes.push(`${c.owner} → ${c.routeTo}`); continue; }
    routable++;
    if (top.slice(0, 3).includes(c.routeTo)) routedTop3++;
  }

  const collisions = [];
  for (let i = 0; i < corpus.length; i++)
    for (let j = i + 1; j < corpus.length; j++)
      collisions.push({ pair: [corpus[i].id, corpus[j].id], score: ranker.similarity(i, j) });
  collisions.sort((a, b) => b.score - a.score);

  const pct = (n, d) => (d === 0 ? 0 : (n / d) * 100);
  return {
    corpusSize: corpus.length,
    positives: positives.length,
    negatives: negatives.length,
    rank1: pct(r1, positives.length),
    top3: pct(r3, positives.length),
    top5: pct(r5, positives.length),
    ownerAtOne: pct(ownerAtOne, negatives.length),
    routedTop3: pct(routedTop3, routable),
    routable,
    deadRoutes,
    collisions: collisions.slice(0, 10),
    gaps: [...gaps.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10),
  };
}

// ── report ────────────────────────────────────────────────────────────────────────────────────
function main() {
  const r = audit();
  const f1 = (n) => n.toFixed(1);
  console.log(`routing-audit: ${r.corpusSize} resources · ${r.positives + r.negatives} prompts`);
  console.log(`positive recall:  rank-1 ${f1(r.rank1)}% · top-3 ${f1(r.top3)}% · top-5 ${f1(r.top5)}%`);
  console.log(`near-miss:        owner-at-1 ${f1(r.ownerAtOne)}% · declared route top-3 ${f1(r.routedTop3)}% (n=${r.routable})`);

  if (r.deadRoutes.length) {
    console.log(`\nDEAD ROUTES — route_to names a resource that does not exist:`);
    for (const d of r.deadRoutes) console.log(`  ${d}`);
  }
  console.log(`\nhighest description overlaps:`);
  for (const c of r.collisions.slice(0, 6)) console.log(`  ${c.score.toFixed(2)}  ${c.pair[0]} ↔ ${c.pair[1]}`);
  if (r.gaps.length) console.log(`\nown prompts outside top-5: ${r.gaps.map(([k, v]) => `${k} (${v})`).join(", ")}`);

  const worst = r.collisions[0]?.score ?? 0;
  const breaches = [];
  if (r.rank1 < FLOORS.rank1) breaches.push(`rank-1 ${f1(r.rank1)}% < ${FLOORS.rank1}%`);
  if (r.top3 < FLOORS.top3) breaches.push(`top-3 ${f1(r.top3)}% < ${FLOORS.top3}%`);
  if (r.routedTop3 < FLOORS.routedTop3) breaches.push(`declared route top-3 ${f1(r.routedTop3)}% < ${FLOORS.routedTop3}%`);
  if (r.ownerAtOne > FLOORS.maxOwnerAtOne) breaches.push(`owner-at-1 ${f1(r.ownerAtOne)}% > ${FLOORS.maxOwnerAtOne}%`);
  if (worst > FLOORS.maxCollision) breaches.push(`collision ${worst.toFixed(2)} > ${FLOORS.maxCollision}`);
  if (r.deadRoutes.length) breaches.push(`${r.deadRoutes.length} dead route(s)`);

  if (breaches.length) {
    console.log(`\nFAIL — ${breaches.join(" · ")}`);
    process.exit(1);
  }
  console.log(`\nPASS`);
}

if (import.meta.url === `file://${process.argv[1]}`) main();
