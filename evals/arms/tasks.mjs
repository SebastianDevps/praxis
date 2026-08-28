// Tasks and scorers for the arms comparison.
//
// Every scorer is deterministic and ships a `good` and a `bad` reference. The
// selftest requires the good one to pass and the bad one to be caught, BEFORE any
// API call — an instrument that cannot catch its own bad reference is not an
// instrument. No LLM judge: these claims are binary (is the font Inter, did it
// dispatch, did it ask), and a judge would add cost, nondeterminism and an
// argument about the rubric where a grep suffices.

// The craft bans DEFAULTING to Inter/Roboto/Open Sans, not their presence anywhere.
// The first scoring pass flagged every arm for emitting the standard system stack
// (`-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, ...`), where Roboto is
// the Android fallback — a legitimate choice, not the AI fingerprint. Classify by
// the PRIMARY family instead.
const AI_DEFAULTS = /^(Inter|Roboto|Open Sans|Helvetica Neue)$/i;
const SYSTEM_FIRST = /^(-apple-system|system-ui|BlinkMacSystemFont|sans-serif|serif|ui-sans-serif)$/i;

function primaryFont(files) {
  const m = text(files).match(/font-family\s*:\s*([^;}]+)/i);
  if (!m) return null;
  return m[1].split(",")[0].trim().replace(/^["']|["']$/g, "");
}

const text = (files) => Object.values(files).join("\n");
export const TASKS = [
  {
    id: "hero",
    // An over-build trap with a taste surface: the arm chooses its own font, and
    // the anti-slop craft is the only thing that says which fonts are a tell.
    prompt:
      "Create index.html and styles.css: a landing page hero for a payroll product — " +
      "headline, one paragraph, an email capture input with a submit button, and a hero image. " +
      "Self-contained, no build step, no CDN frameworks. Write the files and stop.",
    metrics: {
      "font is not an AI default": {
        score: ({ files }) => {
          const f = primaryFont(files);
          if (!f) return { pass: null, detail: "no font-family declared" };
          return { pass: !AI_DEFAULTS.test(f), detail: f };
        },
        good: { "styles.css": "body { font-family: 'Geist', system-ui, sans-serif; }" },
        bad: { "styles.css": "body { font-family: Inter, sans-serif; }" },
      },
      // The craft asks for a deliberate choice ("choose Geist, Outfit, Satoshi,
      // Cabinet Grotesk"). A bare system stack is the absence of one — not slop,
      // but not taste either, and it is where the arms actually separate.
      "made a deliberate type choice": {
        score: ({ files }) => {
          const f = primaryFont(files);
          if (!f) return { pass: null, detail: "no font-family declared" };
          const deliberate = !SYSTEM_FIRST.test(f) && !AI_DEFAULTS.test(f);
          return { pass: deliberate, detail: deliberate ? f : `${f} (default stack)` };
        },
        good: { "styles.css": "body { font-family: 'Cabinet Grotesk', sans-serif; }" },
        bad: { "styles.css": "body { font-family: -apple-system, BlinkMacSystemFont, Roboto, sans-serif; }" },
      },
      "image has alt text": {
        score: ({ files }) => {
          const imgs = [...text(files).matchAll(/<img\b[^>]*>/gi)].map((m) => m[0]);
          if (!imgs.length) return { pass: null, detail: "no <img> produced" };
          const bare = imgs.filter((i) => !/\balt\s*=\s*["'][^"']/.test(i));
          return { pass: bare.length === 0, detail: `${imgs.length - bare.length}/${imgs.length} with alt` };
        },
        good: { "index.html": '<img src="a.png" alt="A payroll dashboard">' },
        bad: { "index.html": '<img src="a.png">' },
      },
      "input is labelled": {
        score: ({ files }) => {
          const body = text(files);
          const inputs = [...body.matchAll(/<input\b[^>]*>/gi)].map((m) => m[0]);
          if (!inputs.length) return { pass: null, detail: "no <input> produced" };
          const labelled = inputs.filter(
            (i) => /\baria-label\s*=/.test(i) || (/\bid\s*=\s*["']([^"']+)/.exec(i) && new RegExp(`<label[^>]*\\bfor\\s*=\\s*["']${/\bid\s*=\s*["']([^"']+)/.exec(i)[1]}`, "i").test(body)),
          );
          return { pass: labelled.length === inputs.length, detail: `${labelled.length}/${inputs.length} labelled` };
        },
        good: { "index.html": '<label for="e">Email</label><input id="e" type="email">' },
        bad: { "index.html": '<input type="email" placeholder="Email">' },
      },
    },
  },
  {
    id: "delegate",
    // Two disjoint domains in one ticket. The orchestration craft says fan out;
    // an unaided agent typically writes both inline.
    prompt:
      "This repo needs two unrelated things: a REST endpoint in api/items.py that returns a JSON " +
      "list of items, and a standalone web/status.html page showing a service status badge. " +
      "They share no files. Do both.",
    metrics: {
      "dispatched at least one specialist": {
        score: ({ parent }) => {
          const n = [...parent.matchAll(/"subagent_type"\s*:\s*"[^"]+"/g)].length;
          return { pass: n > 0, detail: `${n} dispatches` };
        },
        good: { __parent: '{"subagent_type":"praxis:backend"}' },
        bad: { __parent: '{"tool":"Write"}' },
      },
      "both deliverables exist": {
        score: ({ files }) => {
          const has = (re) => Object.keys(files).some((p) => re.test(p));
          const api = has(/items\.py$/), page = has(/status\.html$/);
          return { pass: api && page, detail: `api:${api ? "y" : "n"} page:${page ? "y" : "n"}` };
        },
        good: { "api/items.py": "x", "web/status.html": "y" },
        bad: { "api/items.py": "x" },
      },
    },
  },
  {
    id: "vague",
    // The clarify gate. Deliberately underspecified: a correct run asks one
    // question and stops; building anything here is guessing.
    prompt: "make it better",
    metrics: {
      "asked instead of building": {
        score: ({ files, reply }) => {
          const wrote = Object.keys(files).length > 0;
          const asked = /\?/.test(reply ?? "");
          if (wrote) return { pass: false, detail: `wrote ${Object.keys(files).length} file(s)` };
          return { pass: asked, detail: asked ? "asked a question" : "neither asked nor built" };
        },
        good: { __files: {}, __reply: "Better in what sense — performance, or the layout?" },
        bad: { __files: { "index.html": "<h1>Better</h1>" }, __reply: "Done." },
      },
    },
  },
];

// Reference shapes differ per metric (files, a transcript, or both), so unpack
// the __-prefixed keys into the same context object a real run produces.
export function refContext(ref) {
  if (ref.__parent !== undefined) return { files: {}, parent: ref.__parent, reply: "" };
  if (ref.__files !== undefined) return { files: ref.__files, parent: "", reply: ref.__reply ?? "" };
  return { files: ref, parent: "", reply: "" };
}
