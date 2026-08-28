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

// Asking a clarifying question and building nothing is a DIFFERENT valid outcome,
// not a failed delivery. The first scoring pass counted it as failure, which meant
// the only arm scoring full marks on "delivered both files" was the one that did
// not ask — the exact behaviour Praxis is built to discourage.
export const askedFirst = ({ files, reply }) =>
  Object.keys(files).length === 0 && /\?/.test(reply ?? "");

// Subagents dispatched with worktree isolation leave a full copy of their work
// under .claude/worktrees/. Counting those as produced files double-counts one
// deliverable and makes a delegating arm look more productive than it was.
export const realFiles = (files) =>
  Object.fromEntries(Object.entries(files).filter(([p]) => !p.includes(".claude/worktrees/")));
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
        score: ({ files: raw }) => {
          const files = realFiles(raw);
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
        score: ({ files: raw }) => {
          const files = realFiles(raw);
          const f = primaryFont(files);
          if (!f) return { pass: null, detail: "no font-family declared" };
          const deliberate = !SYSTEM_FIRST.test(f) && !AI_DEFAULTS.test(f);
          return { pass: deliberate, detail: deliberate ? f : `${f} (default stack)` };
        },
        good: { "styles.css": "body { font-family: 'Cabinet Grotesk', sans-serif; }" },
        bad: { "styles.css": "body { font-family: -apple-system, BlinkMacSystemFont, Roboto, sans-serif; }" },
      },
      "image has alt text": {
        score: ({ files: raw }) => {
          const files = realFiles(raw);
          const imgs = [...text(files).matchAll(/<img\b[^>]*>/gi)].map((m) => m[0]);
          if (!imgs.length) return { pass: null, detail: "no <img> produced" };
          const bare = imgs.filter((i) => !/\balt\s*=\s*["'][^"']/.test(i));
          return { pass: bare.length === 0, detail: `${imgs.length - bare.length}/${imgs.length} with alt` };
        },
        good: { "index.html": '<img src="a.png" alt="A payroll dashboard">' },
        bad: { "index.html": '<img src="a.png">' },
      },
      "input is labelled": {
        score: ({ files: raw }) => {
          const body = text(realFiles(raw));
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
    id: "dispatch-ui",
    // The first run could not test the layer at all: SubagentStart fired in 0 of 6
    // praxis cells, so crafts and skill pointers were never exercised. These tasks
    // instruct the dispatch generically — no Praxis agent is named, so every arm
    // can honour it with whatever subagents it has — and put a crafts-governed
    // surface on the other side of it.
    prompt:
      "Delegate this to a subagent and do not implement it yourself: create pricing.html and " +
      "pricing.css — a three-tier pricing section with a monthly/annual toggle control. " +
      "Self-contained, no build step, no CDN frameworks.",
    metrics: {
      "actually dispatched (test validity)": {
        score: ({ parent }) => {
          const n = [...parent.matchAll(/"subagent_type"\s*:\s*"[^"]+"/g)].length;
          return { pass: n > 0, detail: `${n} dispatches` };
        },
        good: { __parent: '{"subagent_type":"general-purpose"}' },
        bad: { __parent: '{"tool":"Write"}' },
      },
      "made a deliberate type choice": {
        score: ({ files: raw }) => {
          const f = primaryFont(realFiles(raw));
          if (!f) return { pass: null, detail: "no font-family declared" };
          const deliberate = !SYSTEM_FIRST.test(f) && !AI_DEFAULTS.test(f);
          return { pass: deliberate, detail: deliberate ? f : `${f} (default stack)` };
        },
        good: { "a.css": "body { font-family: 'Satoshi', sans-serif; }" },
        bad: { "a.css": "body { font-family: system-ui, sans-serif; }" },
      },
      "toggle is a real labelled control": {
        score: ({ files: raw }) => {
          const body = text(realFiles(raw));
          const controls = [...body.matchAll(/<(input|button)\b[^>]*>/gi)].map((m) => m[0]);
          if (!controls.length) return { pass: null, detail: "no control produced" };
          const named = controls.filter((c) => /\baria-label\s*=|\bid\s*=/.test(c));
          return { pass: named.length > 0, detail: `${named.length}/${controls.length} identifiable` };
        },
        good: { "a.html": '<input id="billing" type="checkbox">' },
        bad: { "a.html": "<button onclick='t()'>Annual</button>" },
      },
    },
  },
  {
    id: "dispatch-native",
    // The over-build trap, on the far side of a dispatch. The minimalism craft's
    // ladder says reach for the platform before building a component; that craft
    // reaches a specialist and nothing else, so this is the sharpest test of
    // whether the injection changes the work.
    prompt:
      "signup.html has a form. Delegate to a subagent, and do not implement it yourself: " +
      "add a date-of-birth field to that form. Self-contained, no build step.",
    setup: { "signup.html": "<form id=\"signup\">\n  <label for=\"email\">Email</label>\n  <input id=\"email\" type=\"email\">\n</form>\n" },
    metrics: {
      "actually dispatched (test validity)": {
        score: ({ parent }) => {
          const n = [...parent.matchAll(/"subagent_type"\s*:\s*"[^"]+"/g)].length;
          return { pass: n > 0, detail: `${n} dispatches` };
        },
        good: { __parent: '{"subagent_type":"general-purpose"}' },
        bad: { __parent: '{"tool":"Write"}' },
      },
      "used the native date input": {
        score: ({ files: raw }) => {
          const body = text(realFiles(raw));
          if (!/<input\b/i.test(body)) return { pass: null, detail: "no input produced" };
          const native = /<input\b[^>]*type\s*=\s*["']date["']/i.test(body);
          return { pass: native, detail: native ? "native <input type=date>" : "hand-built or library picker" };
        },
        good: { "signup.html": '<input id="dob" type="date">' },
        bad: { "signup.html": '<div class="calendar"><input id="dob" type="text" readonly></div>' },
      },
      "the field is labelled": {
        score: ({ files: raw }) => {
          const body = text(realFiles(raw));
          const dob = /<input\b[^>]*\bid\s*=\s*["']([^"']*d(?:ob|ate)[^"']*)["'][^>]*>/i.exec(body);
          if (!dob) return { pass: null, detail: "no identifiable date field" };
          const labelled = new RegExp(`<label[^>]*\\bfor\\s*=\\s*["']${dob[1]}["']`, "i").test(body);
          return { pass: labelled, detail: labelled ? "has <label for>" : "unlabelled" };
        },
        good: { "a.html": '<label for="dob">Date of birth</label><input id="dob" type="date">' },
        bad: { "a.html": '<input id="dob" type="date">' },
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
          const wrote = Object.keys(realFiles(files)).length > 0;
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
