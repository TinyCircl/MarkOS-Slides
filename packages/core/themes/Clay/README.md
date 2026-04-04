# Clay

Clay is a warm editorial shared theme for structured Markdown slides.

## Theme Summary

- Shell: `slide-shell`
- Tone: warm, editorial, and content-led
- Good fit: narrative decks, structured summaries, comparison pages, tables, and staged plans

## Authoring Rules

- Use the theme name `Clay` in file-level frontmatter
- Use `class` for `cover` and `default` slides
- Use `layoutClass` for `two-cols` slides
- Preserve content first, then reshape hierarchy to fit the template
- Keep one primary template per slide

## Template Catalog

### `title-slide`

- Layout: `cover`
- Attach Point: `class`
- Purpose: opening cover or title-led closing page
- Best For: title, subtitle, short framing copy, and a final closing note
- Avoid When: dense tables, long lists, or multi-section analysis
- Expected Markdown Shape:
  - optional short opener paragraph or badge
  - `#` title
  - `##` subtitle
  - optional supporting paragraph
- Wiring:
  - `layout: cover`
  - `class: slide-shell title-slide`
- Notes:
  - first and last paragraphs receive positional styling

### `overview-slide`

- Layout: `two-cols`
- Attach Point: `layoutClass`
- Purpose: mixed summary with table and supporting notes
- Best For: overview tables, trip summaries, compact schedules, and summary-plus-callout pages
- Avoid When: purely narrative prose with no structured summary element
- Expected Markdown Shape:
  - left column contains the main `#` heading and a table
  - right column contains short note blocks, callouts, or a blockquote
- Wiring:
  - `layout: two-cols`
  - `layoutClass: slide-shell overview-slide`

### `competitors-slide`

- Layout: `two-cols`
- Attach Point: `layoutClass`
- Purpose: narrative comparison with bullets
- Best For: day-part breakdowns, left-right contrasts, or prose sections with supporting bullet points
- Avoid When: metric-heavy pages that need tables or scorecards
- Expected Markdown Shape:
  - both columns start with headings
  - paragraphs carry the main story
  - lists add supporting details
- Wiring:
  - `layout: two-cols`
  - `layoutClass: slide-shell competitors-slide`

### `feature-slide`

- Layout: `default`
- Attach Point: `class`
- Purpose: full-width feature table or capability matrix
- Best For: tips tables, capability matrices, and dense structured reference pages
- Avoid When: pages that need side commentary more than a central table
- Expected Markdown Shape:
  - `#` title
  - table as the main content
  - optional short note after the table
- Wiring:
  - `class: slide-shell feature-slide`

### `pricing-slide`

- Layout: `two-cols`
- Attach Point: `layoutClass`
- Purpose: side-by-side package or plan comparison
- Best For: one side with structured data, the other side with sectioned lists
- Avoid When: there is no clear comparison axis
- Expected Markdown Shape:
  - left column contains the main heading and a table or structured summary
  - right column contains `##` sections followed by lists
- Wiring:
  - `layout: two-cols`
  - `layoutClass: slide-shell pricing-slide`
- Notes:
  - gives special treatment to `h2 + ul`

### `positioning-slide`

- Layout: `two-cols`
- Attach Point: `layoutClass`
- Purpose: positioning matrix with supporting notes
- Best For: matrix-style comparisons, category placement, and structured evaluation pages
- Avoid When: the content is better expressed as straightforward bullets
- Expected Markdown Shape:
  - left column contains a table or matrix-like summary
  - right column contains supporting bullet points or notes
- Wiring:
  - `layout: two-cols`
  - `layoutClass: slide-shell positioning-slide`

### `strengths-slide`

- Layout: `two-cols`
- Attach Point: `layoutClass`
- Purpose: balanced two-column strengths or highlights
- Best For: paired highlight lists, morning/afternoon splits, or balanced section summaries
- Avoid When: one side is much heavier than the other
- Expected Markdown Shape:
  - both columns contain `##` sections followed by unordered lists
- Wiring:
  - `layout: two-cols`
  - `layoutClass: slide-shell strengths-slide`

### `differentiation-slide`

- Layout: `two-cols`
- Attach Point: `layoutClass`
- Purpose: differentiation summary with table and talking points
- Best For: evidence summary, structured differences, or table-plus-argument pages
- Avoid When: both sides are mostly long narrative prose
- Expected Markdown Shape:
  - left column contains a table
  - right column contains short callouts, paragraphs, and lists
- Wiring:
  - `layout: two-cols`
  - `layoutClass: slide-shell differentiation-slide`

### `swot-slide`

- Layout: `two-cols`
- Attach Point: `layoutClass`
- Purpose: SWOT-style paired analysis
- Best For: four ordered buckets that naturally map to strengths, weaknesses, opportunities, and threats
- Avoid When: the content does not clearly split into four stable categories
- Expected Markdown Shape:
  - each column begins with a heading
  - each column alternates `##` sections and unordered lists
- Wiring:
  - `layout: two-cols`
  - `layoutClass: slide-shell swot-slide`
- Notes:
  - relies on ordered section placement to map the four SWOT buckets

### `roadmap-slide`

- Layout: `two-cols`
- Attach Point: `layoutClass`
- Purpose: staged roadmap or next-steps plan
- Best For: phased plans, itineraries, ordered sequences, or timeline-like content
- Avoid When: the left side is not naturally sequential
- Expected Markdown Shape:
  - left column contains an ordered list
  - right column contains short `##` sections and supporting paragraphs
- Wiring:
  - `layout: two-cols`
  - `layoutClass: slide-shell roadmap-slide`

## Template Selection Guide

- Use `title-slide` for opening and closing pages with strong framing.
- Use `overview-slide` when one side can hold a table and the other side can hold concise notes.
- Use `competitors-slide` for narrative left-right storytelling with supporting bullets.
- Use `strengths-slide` when both columns are structurally balanced.
- Use `feature-slide` when the page is really a table.
- Use `roadmap-slide` when the left side is sequential and ordered.

## Content Fidelity Guidance

- Preserve facts, names, dates, numbers, ordering, and intent.
- Reshape hierarchy freely: headings, bullets, tables, blockquotes, and pagination are all valid adaptation tools.
- Do not invent extra claims or decorative filler just to satisfy a template.
- If the content and the template are a slightly awkward fit, prefer a simpler structure over rewriting the source.

## Examples

Cover wiring:

```md
---
layout: cover
class: slide-shell title-slide
---
```

Roadmap wiring:

```md
---
layout: two-cols
layoutClass: slide-shell roadmap-slide
---
```
