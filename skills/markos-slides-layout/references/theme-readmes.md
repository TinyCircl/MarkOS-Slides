# Theme README Notes

Use this file as a quick index. Before editing a real deck, still read the live theme README in the target repo.

## Locate the live theme README

- Search from the repo root with `rg --files . | rg 'packages/core/themes/.+/README.md$'`
- In the current workspace, the main paths are:
  - `/Users/xuao/Desktop/MarkOS/MarkOS-Slides/packages/core/themes/Clay/README.md`
  - `/Users/xuao/Desktop/MarkOS/MarkOS-Slides/packages/core/themes/Cobalt/README.md`

## Clay

Source: theme README only.

- `title-slide`: opening cover or title-led closing page
- `overview-slide`: mixed summary with table and supporting notes
- `competitors-slide`: narrative comparison with bullets
- `feature-slide`: full-width feature or capability matrix
- `pricing-slide`: side-by-side package or plan comparison
- `positioning-slide`: positioning matrix with supporting notes
- `strengths-slide`: balanced two-column strengths or highlights
- `differentiation-slide`: differentiation summary with table and talking points
- `swot-slide`: SWOT-style paired analysis
- `roadmap-slide`: staged roadmap or next-steps plan

Clay-specific notes from README:

- `title-slide` uses positional paragraph styling for the first and last paragraph
- `swot-slide` depends on ordered sections
- `pricing-slide` gives special treatment to `h2 + ul`

Clay wiring examples from README:

```md
---
layout: cover
class: slide-shell title-slide
---
```

```md
---
layout: two-cols
layoutClass: slide-shell roadmap-slide
---
```

## Cobalt

Source: theme README only.

- `title-slide` (`cover`, `class`): opening title page with centered card composition
- `closing-slide` (`cover`, `class`): Q&A, thank-you, or contact closing page
- `summary-slide` (`two-cols`, `layoutClass`): executive summary with a visual placeholder on the left and insight cards on the right
- `overview-slide` (`two-cols`, `layoutClass`): project or market overview with metric-led blocks and a visual placeholder
- `comparison-slide` (`two-cols`, `layoutClass`): market landscape, evidence summary, or table-plus-notes comparison page
- `metrics-slide` (`two-cols`, `layoutClass`): KPI, scorecard, or chart-adjacent slide using metric cards and insight cards
- `process-slide` (`two-cols`, `layoutClass`): phased process or implementation methodology with numbered steps and notes

Cobalt-specific notes from README:

- Use the theme name `Cobalt` in file-level frontmatter
- Stay in Markdown only; do not depend on Chart.js or custom page scripts
- `metrics-slide` expects a metric-card list in the left column, with inline code as the headline value
- `process-slide` expects an ordered list in the left column, with leading `strong` text as the step title
- `summary-slide` and `comparison-slide` can use a left-column `blockquote` as a visual placeholder
