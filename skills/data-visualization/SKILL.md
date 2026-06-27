---
name: data-visualization
description: Use when building any chart, graph, metric card, dashboard panel, or D3 data viz — picks the right chart for the question, removes chartjunk, labels directly, and keeps it accessible.
kind: skill
od:
  category: data-viz
  surface: web
  triggers:
    - chart
    - data viz
    - graph
    - dashboard chart
    - d3
  craft:
    requires:
      - a11y-baseline
      - anti-slop
---

> Curated from open-design d3-visualization and data-report.

## Chart Selection by Question

| Question | Chart | Avoid |
|----------|-------|-------|
| Compare values across categories | Bar (horizontal if labels are long) | 3-D bars |
| Track change over time | Line | Bar for continuous time series |
| Part of a whole | Stacked bar or treemap (>7 parts) | Pie (hard to compare slices) |
| Correlation between two variables | Scatter | Line (implies time causality) |
| Distribution | Histogram or box plot | Bar chart with average only |
| Ranking | Sorted horizontal bar | Unsorted anything |

When in doubt, prefer the simplest chart that answers the question.

## Chartjunk Rules

- No 3-D effects — they distort magnitude
- No gridlines darker than the data
- No dual-axis unless explicitly required; if used, label both axes clearly
- No decorative icons or backgrounds inside the chart area
- Legends are a fallback — direct labels are always better

## Labeling

- Label data points directly when ≤ 8 series
- Use legends only when direct labels would collide
- Axis labels: units in parentheses, not as a separate annotation
- Truncate long category labels rather than rotating them 45°

## Color

- Max 6 categorical colors — diverging palette for bipolar data, sequential for ordered magnitude
- Never encode the same variable with both position AND color
- Colorblind-safe: test with deuteranopia simulation before shipping
- See `a11y-baseline` for contrast requirements

## Implementation Choice

- **D3** for custom layouts (force graph, tree, custom axes, animated transitions)
- **Chart lib** (Recharts, Nivo, Chart.js) for standard charts in component trees — lower boilerplate
- Both choices: separate data-fetching from rendering; pass cleaned, typed data to the chart component
