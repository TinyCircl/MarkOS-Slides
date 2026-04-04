# Cobalt

Cobalt is a cool analytic theme derived from the `cobalt` HTML mockups.

## Theme Summary

- Shell: `slide-shell`
- Tone: cool, analytic, and presentation-oriented
- Good fit: executive summaries, KPI pages, process decks, and structured comparison slides

## Authoring Rules

- Use the theme name `Cobalt` in file-level frontmatter
- Use `class` for `cover` slides
- Use `layoutClass` for `two-cols` slides
- Keep the deck Markdown-only; do not depend on Chart.js or page scripts
- Prefer strong slide hierarchy over one-off layout hacks

## Template Catalog

### `title-slide`

- Layout: `cover`
- Attach Point: `class`
- Purpose: opening title page with centered card composition
- Best For: presentation titles, short framing copy, and polished openers
- Avoid When: dense tables or long operational detail
- Expected Markdown Shape:
  - `#` title
  - one or two short supporting paragraphs
  - optional list
- Wiring:
  - `layout: cover`
  - `class: slide-shell title-slide`

### `closing-slide`

- Layout: `cover`
- Attach Point: `class`
- Purpose: Q&A, thank-you, or contact closing page
- Best For: short final CTA, recap, or call for next steps
- Avoid When: detailed follow-up content still needs multiple sections
- Expected Markdown Shape:
  - `#` closing title
  - one or more short supporting paragraphs
  - optional list
- Wiring:
  - `layout: cover`
  - `class: slide-shell closing-slide`

### `summary-slide`

- Layout: `two-cols`
- Attach Point: `layoutClass`
- Purpose: executive summary with a visual placeholder on the left and insight cards on the right
- Best For: trip or project overview, summary framing, and key takeaways
- Avoid When: both columns are dense tables or long procedural lists
- Expected Markdown Shape:
  - left column contains the main title, framing sentence, and optional blockquote placeholder
  - right column contains `##` insight sections with short paragraphs
- Wiring:
  - `layout: two-cols`
  - `layoutClass: slide-shell summary-slide`
- Notes:
  - supports a left-column `blockquote` as a visual placeholder

### `overview-slide`

- Layout: `two-cols`
- Attach Point: `layoutClass`
- Purpose: project or market overview with metric-led blocks and a visual placeholder
- Best For: context pages, overview stats, and summary-plus-visual layouts
- Avoid When: the left column is mostly long narrative prose
- Expected Markdown Shape:
  - left column contains the main title, short framing subtitle, and metric-led blocks
  - right column contains a blockquote or other short supporting note
- Wiring:
  - `layout: two-cols`
  - `layoutClass: slide-shell overview-slide`

### `comparison-slide`

- Layout: `two-cols`
- Attach Point: `layoutClass`
- Purpose: market landscape, evidence summary, or table-plus-notes comparison page
- Best For: tables with right-column commentary, recommendation pages, and structured differences
- Avoid When: there is no clear comparison or structured reference element
- Expected Markdown Shape:
  - left column contains a table and optional follow-up note
  - right column contains `##` sections with short supporting paragraphs
- Wiring:
  - `layout: two-cols`
  - `layoutClass: slide-shell comparison-slide`
- Notes:
  - supports a left-column `blockquote` as a visual placeholder

### `metrics-slide`

- Layout: `two-cols`
- Attach Point: `layoutClass`
- Purpose: KPI, scorecard, or chart-adjacent slide using metric cards and insight cards
- Best For: numeric highlights, scorecards, and metric-led progress reporting
- Avoid When: the page is primarily prose or sequential steps
- Expected Markdown Shape:
  - left column contains a metric-card list
  - right column contains `##` insight sections with short paragraphs
- Wiring:
  - `layout: two-cols`
  - `layoutClass: slide-shell metrics-slide`
- Notes:
  - inline code inside each left-column list item is styled as the headline value

### `process-slide`

- Layout: `two-cols`
- Attach Point: `layoutClass`
- Purpose: phased process or implementation methodology with numbered steps and notes
- Best For: itineraries, ordered plans, methodology slides, and staged execution
- Avoid When: the left side is not a real sequence
- Expected Markdown Shape:
  - left column contains an ordered list
  - right column contains `##` notes with short paragraphs
- Wiring:
  - `layout: two-cols`
  - `layoutClass: slide-shell process-slide`
- Notes:
  - ordered-list steps are the primary visual element
  - `strong` at the start of each item becomes the step title

## Template Selection Guide

- Use `title-slide` for clean openers.
- Use `closing-slide` for thank-you pages and final CTAs.
- Use `summary-slide` for a high-level overview with insight cards.
- Use `overview-slide` when the left side is metric-led and the right side supports context.
- Use `comparison-slide` when a table and commentary need to live together.
- Use `metrics-slide` when numbers are the story.
- Use `process-slide` when the left side is sequential.

## Content Fidelity Guidance

- Preserve facts, names, dates, numbers, ordering, and intent.
- Feel free to convert source prose into headings, ordered steps, metric bullets, or table rows when the meaning stays the same.
- Do not add invented strategic claims or synthetic metrics just to make the slide feel more “business-like”.
- If the content does not naturally fit a metric or process shape, choose a simpler template instead of forcing it.

## Examples

Closing wiring:

```md
---
layout: cover
class: slide-shell closing-slide
---
```

Process wiring:

```md
---
layout: two-cols
layoutClass: slide-shell process-slide
---
```
