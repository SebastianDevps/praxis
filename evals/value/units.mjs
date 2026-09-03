// Fixtures whose correct answer is computed, not judged. A criterion the grader can derive from
// the fixture is the only kind that survives disagreement about the output's prose.

// ── prose-tells ───────────────────────────────────────────────────────────────────────────────
// Twelve tells planted from the skill's own tables, each with a unique surface string so a scorer
// can count detections without reading. The control has the skill deleted, so a detection there is
// the model's own taste, which is exactly the baseline in question.
export const PLANTED = [
  "delve", "pivotal moment", "serves as", "Not just", "experts believe", "In order to",
  "utilize", "leverage", "significantly improves", "queries are validated",
  "Our Engineering Philosophy", "—",
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
    const found = PLANTED.filter((p) => out.includes(p));
    return { detected: found.length, of: PLANTED.length, missed: PLANTED.filter((p) => !found.includes(p)) };
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
