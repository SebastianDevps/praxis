// Referential integrity for eval drivers: a driver that reads a name its unit module does not
// export produces `undefined`, and `undefined` only throws where it is dereferenced — deep inside
// a cell that has already spent money. `node --check` passes on it; so does `import`, because
// `import * as U` never throws on a missing property. T09's driver sat broken this way through a
// whole published unit: it bound `U.investigationSuite` against a module exporting
// `INVESTIGATION_SUITE`, and nothing said so until someone tried to re-run it.
//
// So: static, like the rest of this suite. The driver's source names its imports; the unit's
// source names its exports; the two lists must agree. Nothing here executes an eval harness —
// importing one to read its exports would be a gate that can start a run.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, existsSync, statSync } from "node:fs";
import { join, dirname, resolve, relative } from "node:path";

const ROOT = new URL("..", import.meta.url).pathname;

// Whole-line comments only. A `//` mid-line lives inside a URL far more often than it opens a
// comment here (`https://packages.ecosyste.ms/...`), and cutting the line at it would hide any
// binding that follows — a false negative, which is the failure mode this file exists to prevent.
// A trailing comment naming `U.foo` therefore still counts as a read. That over-reports; it never
// under-reports, and over-reporting is the safe direction for a gate.
const stripBlockAndLineComments = (src) =>
  src
    .replace(/^[ \t]*\/\*[\s\S]*?\*\/[ \t]*$/gm, "")
    .split("\n")
    .filter((l) => !l.trimStart().startsWith("//"))
    .join("\n");

// `export const|let|var|function|async function|class NAME`, plus the re-export forms. If a module
// ever grows `export { a, b }` or `export default`, the forms below catch it; a module that parses
// to zero exports fails its own test rather than silently passing every driver that reads it.
function exportedNames(src) {
  const names = new Set();
  for (const m of src.matchAll(/^export\s+(?:async\s+)?(?:const|let|var|function\*?|class)\s+([A-Za-z_$][\w$]*)/gm)) {
    names.add(m[1]);
  }
  for (const m of src.matchAll(/^export\s*\{([^}]*)\}/gm)) {
    for (const part of m[1].split(",")) {
      const as = part.split(/\bas\b/);
      const name = (as[1] ?? as[0]).trim();
      if (name) names.add(name);
    }
  }
  if (/^export\s+default\b/m.test(src)) names.add("default");
  return names;
}

// Every import in a driver, paired with what the driver then reads through it.
//
// An import counts only where a statement can start — column 0, or after a `;` on the same line.
// Scanning anywhere found `import { now } from "./clock.js"` inside `t05-scorer-proof.mjs`'s
// fixture template and reported a missing module for source the scorer merely writes to disk.
// The residual looseness is stated rather than papered over: a template literal whose own first
// column holds an `import` would still be read as code — `units.mjs` has exactly that shape at
// lines 139, 219, 300 and 776, and only the drivers are scanned here. It fails loud when it
// misfires, which is the direction a gate is allowed to be wrong in.
const STATEMENT_START = "(?:^|;[ \\t]*)";
function importsOf(src) {
  const body = stripBlockAndLineComments(src);
  const specs = [];
  for (const m of body.matchAll(new RegExp(`${STATEMENT_START}import\\s+\\*\\s+as\\s+([A-Za-z_$][\\w$]*)\\s+from\\s+["']([^"']+)["']`, "gm"))) {
    const [, alias, spec] = m;
    const read = new Set(
      [...body.matchAll(new RegExp(`\\b${alias}\\.([A-Za-z_$][\\w$]*)`, "g"))].map((x) => x[1]),
    );
    specs.push({ spec, kind: `namespace \`${alias}\``, names: [...read] });
  }
  for (const m of body.matchAll(new RegExp(`${STATEMENT_START}import\\s*\\{([^}]*)\\}\\s*from\\s*["']([^"']+)["']`, "gm"))) {
    const names = m[1]
      .split(",")
      .map((p) => p.split(/\bas\b/)[0].trim())
      .filter(Boolean);
    specs.push({ spec: m[2], kind: "named import", names });
  }
  return specs;
}

// Bare specifiers are builtins or packages — not ours to resolve. Everything else must land on a
// real file: a driver carrying an absolute path from another machine is the same rot in a
// different coat, and it fails here rather than at run time.
const isLocal = (spec) => spec.startsWith(".") || spec.startsWith("/");

function discoverDrivers() {
  const evals = join(ROOT, "evals");
  if (!existsSync(evals)) return [];
  const found = [];
  for (const suite of readdirSync(evals, { withFileTypes: true }).filter((e) => e.isDirectory())) {
    const runs = join(evals, suite.name, "runs");
    if (!existsSync(runs) || !statSync(runs).isDirectory()) continue;
    for (const f of readdirSync(runs).filter((f) => f.endsWith(".mjs"))) {
      found.push(join(runs, f));
    }
  }
  return found.sort();
}

const DRIVERS = discoverDrivers();

// `evals/*/runs/` is gitignored (run workspaces, kept locally for `--rescore`), so a fresh clone —
// CI included — has no driver to check and every test below would vanish silently. A gate that
// quietly checks nothing is worse than one that says it checked nothing, so the absence is a
// visible skip with its reason rather than an empty loop.
test("eval drivers are present to check", {
  skip: DRIVERS.length === 0 &&
    "no evals/*/runs/*.mjs in this checkout — the directory is gitignored, so this gate is local-only",
}, () => {
  assert.ok(DRIVERS.length > 0);
});

for (const driver of DRIVERS) {
  const rel = relative(ROOT, driver);
  test(`${rel}: every imported binding exists in the module it comes from`, () => {
    const src = readFileSync(driver, "utf8");
    const unresolved = [];
    const missing = [];
    for (const { spec, kind, names } of importsOf(src)) {
      if (!isLocal(spec)) continue;
      const target = spec.startsWith("/") ? spec : resolve(dirname(driver), spec);
      if (!existsSync(target)) {
        unresolved.push(`${spec} (${kind})`);
        continue;
      }
      const exported = exportedNames(readFileSync(target, "utf8"));
      assert.ok(
        exported.size > 0,
        `${relative(ROOT, target)} parsed to zero exports — the export forms above do not cover it, ` +
          `so this gate would pass every binding read from it. Extend exportedNames().`,
      );
      for (const name of names) {
        if (!exported.has(name)) missing.push(`${name} (${kind} from ${relative(ROOT, target)})`);
      }
    }
    assert.deepEqual(unresolved, [], `imports a module that does not exist: ${unresolved.join(", ")}`);
    assert.deepEqual(missing, [], `reads names its module does not export: ${missing.join(", ")}`);
  });
}
