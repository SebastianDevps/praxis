// Seeded-defect tasks for the refuter panel.
//
// THE QUESTION: does a panel with a mandate to refute find defects a reviewer with the builder's
// full context does not — and is any gain the MANDATE or just three times the compute?
//
// That second half is why there are three arms and not two. `reviewer-x3` runs the ordinary
// reviewer three times: same agent count, same spend, same mandate. If `refuters` only matches it,
// the panel is buying sampling, not asymmetry, and the honest conclusion is that the contract does
// not earn its complexity.
//
// SCORING READS THE REPLY, NEVER THE TRANSCRIPT. The transcript contains the seeded file as tool
// output, so any regex for `limit - 1` matches the moment an arm merely READS the code — scoring
// reading as finding. The reply is the synthesis a tech lead actually receives, and "reported it"
// is the only definition of found that means anything. (The same trap made the live smoke test
// report a false pass once, by matching injected text quoted back in tool output.)
//
// Every metric ships a `good` and a `bad` reply. The selftest requires the good one to pass and the
// bad one to be caught before any API call.

// A finding must NAME the mechanism, not gesture at the area. "There may be issues with
// pagination" is not finding an off-by-one — it is the shape of a review that found nothing and
// said something anyway, and a scorer that accepts it cannot tell the arms apart.
const found = (reply, ...required) =>
  required.every((re) => re.test(reply ?? ""));

// Does the report CLAIM a blocker? Negated forms are neutralised first, because "does not block"
// contains the word "block" and a naive test reads a refusal to block as a block.
const NEGATED = /\b(does|do|did|doesn't|don't|will|would|should)\s+not\s+block\w*|\bnon-?blocking\b|\bnot\s+blocking\b|\bno\s+block(er|ing)?s?\b|\bnothing\s+(here\s+)?blocks\b|\bblocking:\s*0\b|\bBLOCK\s+0\b/gi;
const CLAIMS = /\[\s*BLOCK(ER)?\s*\]|\bBLOCK\s+[1-9]\b|\bblocking:\s*[1-9]|\bblocks?\s+readiness\b|\*\*critical\*\*|\bCRITICAL\b|must not (merge|ship)|do not (merge|ship)/i;

export const claimsBlocker = (reply) => CLAIMS.test(String(reply ?? "").replace(NEGATED, " "));

// Dispatch is test VALIDITY, not a result: an arm that never dispatched the agents its prompt
// named did not run the condition, so its cells score `null` rather than fail. Read from the
// parent transcript, where the Task tool calls are recorded.
export const dispatched = (parent, name, atLeast = 1) =>
  (String(parent ?? "").match(new RegExp(`praxis:${name}\\b`, "g")) ?? []).length >= atLeast;

// ── the fixture ───────────────────────────────────────────────────────────────────────────────
// One small service, realistic enough that a defect is a defect rather than a puzzle. Each task
// seeds the same base plus its own defective file, so the arms review comparable surface area.

const BASE = {
  "package.json": JSON.stringify({ name: "billing-api", type: "module", version: "1.0.0" }, null, 2) + "\n",
  "src/db.js": `// Thin data layer. Every query is scoped by the id it is given.
export function invoicesFor(userId) {
  return DB.invoices.filter((i) => i.userId === userId);
}
export function userById(id) {
  return DB.users.find((u) => u.id === id) ?? null;
}
const DB = { invoices: [], users: [] };
`,
};

const withBase = (files) => ({ ...BASE, ...files });

const REVIEW_PROMPT =
  "Review the change on this branch against its contract. The contract is: " +
  "`GET /api/invoices` returns the signed-in user's own invoices, one page at a time; " +
  "expired tokens are rejected; nothing sensitive reaches the logs. " +
  "Report findings with severity, and say where you looked. Do not fix anything.";

export const TASKS = [
  {
    id: "boundary",
    prompt: REVIEW_PROMPT,
    setup: withBase({
      "src/paginate.js": `// Returns one page of items.
// Contract: given limit=20, a full page contains 20 items.
export function paginate(items, offset, limit) {
  return items.slice(offset, offset + limit - 1);
}
`,
    }),
    metrics: {
      "found the off-by-one": {
        // Must name the arithmetic or the symptom, AND locate it. Either alone is a guess.
        score: ({ reply }) => ({
          pass: found(
            reply,
            /paginate|slice|pagination/i,
            /limit\s*-\s*1|off[- ]by[- ]one|wrong by one|one (fewer|less|short)|\b19\b|n\s*-\s*1|(drops|misses|omits|loses) the last/i,
          ),
        }),
        good: { __reply: "BLOCK — src/paginate.js: `slice(offset, offset + limit - 1)` is an off-by-one; a page of limit=20 returns 19 items." },
        bad: { __reply: "IMPORTANT — the pagination logic could use a closer look and some tests." },
        // Genuine finds phrased differently — all four MUST pass. The first version of this
        // scorer rejected two of them, which would have counted a real find as a miss and biased
        // the result against whichever arm phrases findings that way.
        alt: [
          "paginate() is wrong by one: a page of 20 comes back with 19 rows.",
          "src/paginate.js drops the last item of every page.",
        ],
        // Near-misses that name the AREA without naming the defect — MUST NOT pass.
        near: [
          "The paginate function uses Array.slice with an offset and a limit.",
          "Pagination has no test coverage and should get some.",
        ],
      },
    },
  },

  {
    id: "authz",
    prompt: REVIEW_PROMPT,
    setup: withBase({
      "src/routes.js": `import { invoicesFor } from "./db.js";

// requireAuth rejects anyone without a valid session.
export function register(app, requireAuth) {
  app.get("/api/invoices", requireAuth, (req, res) => {
    res.json(invoicesFor(req.query.userId));
  });
}
`,
    }),
    metrics: {
      "found the authorization gap": {
        score: ({ reply }) => ({
          pass: found(
            reply,
            /query\.userId|query param|querystring|user_?id from the (query|url)/i,
            /authoriz|authz|idor|another user|other users|any user|someone else|impersonat/i,
          ),
        }),
        good: { __reply: "BLOCK — src/routes.js reads `req.query.userId` after requireAuth. Authenticated is not authorized: any signed-in user can pass another user's id and read their invoices (IDOR)." },
        bad: { __reply: "IMPORTANT — the invoices route should probably validate its input more carefully." },
        alt: ["src/routes.js trusts req.query.userId, so a signed-in user can read invoices belonging to someone else."],
        near: [
          "The invoices route reads userId from the query string and passes it to invoicesFor.",
          "requireAuth is applied to the invoices route, which is good.",
        ],
      },
    },
  },

  {
    id: "leak",
    prompt: REVIEW_PROMPT,
    setup: withBase({
      "src/errors.js": `import { logger } from "./logger.js";

// Last-resort handler. Logs enough context to debug a failed request.
export function errorHandler(err, req, res, _next) {
  logger.error("request failed", { path: req.path, body: req.body });
  res.status(500).json({ error: "internal" });
}
`,
      "src/logger.js": `export const logger = { error: (...a) => console.error(...a) };\n`,
      "src/login.js": `// POST /login receives { email, password } and forwards it to the session layer.\nexport const LOGIN_FIELDS = ["email", "password"];\n`,
    }),
    metrics: {
      "found the credential leak": {
        score: ({ reply }) => ({
          pass: found(
            reply,
            /req\.body|request body|body.*log|log.*body/i,
            /password|credential|secret|pii|sensitive/i,
          ),
        }),
        good: { __reply: "BLOCK — src/errors.js logs `req.body` wholesale. On the /login route that body carries the password, so credentials land in plaintext logs." },
        bad: { __reply: "MINOR — consider adding more structure to the error logging." },
        alt: ["The error handler writes the whole request body to the log; on /login that includes the user's password."],
        near: [
          "src/errors.js logs the request path and body for debugging.",
          "Passwords are handled in src/login.js and look fine.",
        ],
      },
    },
  },

  {
    id: "vacuous-test",
    prompt: REVIEW_PROMPT,
    setup: withBase({
      "src/token.js": `export function verify(token) {
  if (token.exp < Date.now()) return { ok: false, reason: "expired" };
  return { ok: true, userId: token.sub };
}
`,
      "test/token.test.js": `import { test, expect } from "vitest";
import { verify } from "../src/token.js";

test("rejects an expired token", () => {
  const result = verify({ exp: 0, sub: "u1" });
  expect(result).toBeDefined();
});
`,
    }),
    metrics: {
      "found the assertion that cannot fail": {
        score: ({ reply }) => ({
          pass: found(
            reply,
            /toBeDefined|token\.test|expired[- ]token/i,
            /cannot fail|can never fail|(always|still) pass|vacuous|asserts nothing|checks nothing|never fails|would (still )?pass (even )?if|proves nothing|does not (check|assert|verify|test)|never asserts/i,
          ),
        }),
        good: { __reply: "BLOCK — test/token.test.js asserts `toBeDefined()` on a value that is always an object. It cannot fail: the test passes unchanged if verify() stopped rejecting expired tokens entirely." },
        bad: { __reply: "IMPORTANT — test coverage around token verification looks thin; consider adding cases." },
        alt: [
          "test/token.test.js should assert result.ok is false and reason is 'expired'; toBeDefined() does not check the rejection at all.",
          "The expired-token test would still pass if verify() always returned ok:true.",
        ],
        near: [
          "There is one test for token verification; more cases would help.",
          "test/token.test.js covers the expired token path.",
        ],
      },
    },
  },

  {
    id: "clean",
    // No seeded defect — and, the second time around, actually none.
    //
    // The first version wired nothing: `paginate.js` was correct, `routes.js` was correct, and
    // routes.js never imported paginate. Against a contract that says "one page at a time" that is
    // a real defect, and all six cells reported it. They were right; the metric marked them wrong.
    // The guard test passed too, because it only checked that the three KNOWN defects were absent —
    // it never asked whether the fixture satisfies its own contract. That is the "can it pass?"
    // question, asked of the eval instead of the code, and it had not been asked.
    //
    // This version satisfies every clause of the contract explicitly, so a blocking finding here is
    // a false positive again rather than a correct one.
    prompt: REVIEW_PROMPT,
    setup: withBase({
      // clause 1: one page at a time — paginate is imported AND applied.
      "src/paginate.js": `// Returns one page of items.
export function paginate(items, offset, limit) {
  return items.slice(offset, offset + limit);
}
`,
      // clause 1 + the user's OWN invoices — the id comes from the session, never the query.
      "src/routes.js": `import { invoicesFor } from "./db.js";
import { paginate } from "./paginate.js";

const PAGE_SIZE = 20;

export function register(app, requireAuth) {
  app.get("/api/invoices", requireAuth, (req, res) => {
    const offset = Number(req.query.offset ?? 0);
    res.json(paginate(invoicesFor(req.session.userId), offset, PAGE_SIZE));
  });
}
`,
      // clause 2: expired tokens are rejected, and a test that can actually fail says so.
      "src/token.js": `export function verify(token) {
  if (token.exp < Date.now()) return { ok: false, reason: "expired" };
  return { ok: true, userId: token.sub };
}
`,
      "test/token.test.js": `import { test, expect } from "vitest";
import { verify } from "../src/token.js";

test("rejects an expired token", () => {
  const result = verify({ exp: 0, sub: "u1" });
  expect(result.ok).toBe(false);
  expect(result.reason).toBe("expired");
});

test("accepts a live token", () => {
  const result = verify({ exp: Date.now() + 60_000, sub: "u1" });
  expect(result.ok).toBe(true);
  expect(result.userId).toBe("u1");
});
`,
      // clause 3: nothing sensitive reaches the logs — the path only, never the body.
      "src/errors.js": `import { logger } from "./logger.js";

export function errorHandler(err, req, res, _next) {
  logger.error("request failed", { path: req.path, status: 500 });
  res.status(500).json({ error: "internal" });
}
`,
      "src/logger.js": `export const logger = { error: (...a) => console.error(...a) };\n`,
    }),
    metrics: {
      "did not invent a blocker": {
        // Inverted: passing means the arm did NOT claim a blocking finding on correct code.
        // Over-blocking is not the safe side — a gate that fires on correct work gets muted.
        //
        // The first version tested /\bBLOCK\b/ and therefore matched "Does not block." — counting a
        // report that explicitly DECLINES to block as if it blocked. Worse than a bug: the arm most
        // likely to write that sentence is the panel, whose contract asks it to grade a finding as
        // non-blocking. The scorer was biased against the exact behaviour under test, and the
        // selftest never caught it because no probe contained a negation.
        score: ({ reply }) => {
          const blocking = claimsBlocker(reply ?? "");
          return { pass: !blocking, detail: blocking ? "claimed a blocker" : "no blocker claimed" };
        },
        good: { __reply: "No blocking findings. Attacked: pagination boundaries, the invoices route's authorization path, and log surfaces. MINOR — paginate() does not clamp a negative offset." },
        bad: { __reply: "BLOCK — the pagination implementation is unsafe and must not ship." },
        alt: [
          "No blockers. I attacked the pagination boundary and the session lookup; both hold.",
          // The regression that made this metric lie. All three must read as NOT blocking.
          "[NON-BLOCKING] Negative offset normalizes to a tail slice. Severity LOW. Does not block.",
          "STATUS refute-correctness | findings | attacked: token, routes, logs | blocking: 0 | questions: 2",
          "One GAP and two questions. Nothing here blocks the merge.",
        ],
        near: [
          "CRITICAL: invoicesFor is not paginated at the database level.",
          "STATUS review | done | findings: BLOCK 1, IMPORTANT 1, MINOR 0",
        ],
      },
      // A clean verdict that does not say where it looked is indistinguishable from not looking.
      "said where it looked": {
        score: ({ reply }) => ({
          pass: /attacked|looked at|examined|checked|surface[sd]?|reviewed the/i.test(reply ?? ""),
        }),
        good: { __reply: "No blocking findings. Attacked: pagination boundaries, the authorization path, and log surfaces." },
        bad: { __reply: "Looks fine to me." },
        alt: [
          "I examined the pagination arithmetic, the session lookup in the invoices route, and every log call. Nothing blocking.",
          "Surfaces reviewed: paginate() boundaries, req.session.userId, and the error path. Clean.",
        ],
        near: [
          "I went through the change carefully and did not find anything that would block a merge.",
          "The code is clean and well structured; no issues.",
        ],
      },
    },
  },
];

// Reference replies arrive as { __reply }, so unpack them into the shape a real record has.
export function refContext(ref) {
  return { reply: ref.__reply ?? "", parent: ref.__parent ?? "", files: {} };
}
