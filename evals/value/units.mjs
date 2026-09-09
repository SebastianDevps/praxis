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
