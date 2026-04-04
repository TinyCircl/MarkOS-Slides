# Theme Authoring

MarkOS shared themes are reusable theme folders stored in `packages/core/themes/`.

A shared theme is selected through file-level frontmatter in `slides.md`, loaded before the deck-local `slides.css`, and is expected to provide a stable authoring surface for deck writers.

This document is the repo-wide standard for making CSS themes and page templates.

## What A Theme Is

- A shared theme folder at `packages/core/themes/<ThemeName>/`
- A `theme.css` implementation file inside that folder
- A `README.md` manifest that explains the theme's public authoring API
- A reusable visual system that can be applied across multiple decks
- A documented set of page templates expressed through class names
- A CSS layer that works with MarkOS Markdown output and built-in layouts

## What A Theme Is Not

- A separate HTML template system
- A JavaScript runtime extension
- A Tailwind preset or external framework dependency
- A replacement for deck-local `slides.css`

## Theme Layout

The standard shared theme layout is:

```text
packages/core/themes/
  Clay/
    README.md
    theme.css
```

Use these files for different responsibilities:

- `README.md`: theme manifest, implemented templates, authoring notes, and deviations
- `theme.css`: tokens, shell styling, page templates, and contextual Markdown styling

## Theme README Standard

The theme `README.md` is the primary public authoring contract for humans and AI.

When someone needs to understand, use, or modify a theme, they should read the theme `README.md` first and the `theme.css` second.

A good theme README should be sufficient to:

- choose the right template for a piece of content
- understand what Markdown shape each template expects
- preserve source content while adapting hierarchy and pagination
- wire the template correctly without reverse-engineering CSS selectors

The recommended structure is:

```md
# ThemeName

## Theme Summary

## Authoring Rules

## Template Catalog

### title-slide

### overview-slide

## Template Selection Guide

## Content Fidelity Guidance

## Examples
```

The minimum required information is:

- theme name
- shell class name
- implemented templates
- theme-specific deviations or unsupported canonical templates when relevant
- one-line purpose for each implemented template
- wiring information for each implemented template

Recommended additional information:

- best-fit guidance for each template
- anti-patterns or "avoid when" guidance for templates that are easy to misuse
- expected Markdown shape for each template
- one or two short content examples
- explicit content-fidelity guidance for AI-assisted adaptation

If a theme is intentionally very small, sections may stay short, but the README should still answer three practical questions:

1. Which template should I pick?
2. What Markdown shape should I feed it?
3. What content changes are allowed during adaptation?

These expectations follow the [Developer Guide](./developer-guide.md#development-principles): clear README contracts matter more than forcing every theme into identical names or identical template inventories.

## Authoring Source Of Truth

Use this precedence order when documenting and maintaining themes:

1. `docs/theme-authoring.md` defines the global standard
2. `packages/core/themes/<Theme>/README.md` defines that specific theme's public API
3. `packages/core/themes/<Theme>/theme.css` implements the API

This means:

- shared rules belong in this document
- theme-specific availability and deviations belong in the theme `README.md`
- implementation details belong in the CSS

Avoid duplicating the full template contract in all three places.

For theme usage and content adaptation, prefer README-level rules over inferred CSS behavior. CSS should implement the contract, not define it implicitly.

## Runtime Contract

These rules come from the renderer and should be treated as hard constraints.

- A deck selects a theme through top-level frontmatter:

```md
---
theme: Clay
---
```

- `packages/core/themes/<Theme>/theme.css` is the shared theme entry point
- the `theme` value is the theme folder name only, for example `Clay`
- Shared themes are for reusable styling; `slides.css` is the main local override layer and `overrides.css` is an optional final incremental override layer
- Supported slide layouts are `default`, `cover`, and `two-cols`
- For `default` and `cover`, page classes are attached with `class`
- For `two-cols`, outer container classes are attached with `layoutClass`
- For `two-cols`, repeated pane classes are attached with `class`
- `two-cols` exposes `.col-left` and `.col-right` for pane-specific styling
- Theme CSS should target Markdown output such as headings, paragraphs, lists, tables, blockquotes, links, and code

Practical examples:

```md
---
layout: cover
class: slide-shell title-slide
---
```

```md
---
layout: two-cols
layoutClass: slide-shell pricing-slide
class: content-pane
---
```

## Theme Contract

Every shared theme added to this repo should follow this structure.

### 1. Design Tokens

Put visual tokens in `:root`.

Use tokens for:
- brand and accent colors
- surface and panel colors
- text and muted text colors
- borders and shadows
- spacing or radius values when reused

Example:

```css
:root {
  --mk-bg: #f5f5f5;
  --mk-card: #ffffff;
  --mk-accent: #ff8a65;
  --mk-text: #2d2d2d;
  --mk-muted: #666666;
  --mk-border: #e0e0e0;
  --mk-shadow: 0 18px 48px rgba(45, 45, 45, 0.08);
}
```

### 2. Base Typography

Use `.slidev-layout` for deck-wide typography defaults.

This is the right place for:
- `font-family`
- base text color
- baseline line-height rules
- shared heading tone only when it is truly global

Avoid using global `body` styling as the public theme API.

### 3. Shared Shell

Every theme should expose one stable shell class named `.slide-shell`.

`slide-shell` is the common visual frame for slides in the theme. It may provide:
- background treatment
- inner surface or card framing
- padding
- border radius
- box shadow

Deck authors should be able to recognize `.slide-shell` as the default outer wrapper for the theme.

### 4. Recommended CSS Layering Order

Across themes, the preferred CSS organization is:

1. `:root` design tokens
2. `.slidev-layout` base typography and shared text defaults
3. `.slide-shell` shared outer surface
4. shared layout helpers such as `two-cols` shell rules
5. optional shared template-family helpers
6. concrete page-template blocks such as `.title-slide` or `.metrics-slide`
7. export or responsive safety fixes when needed

This is the pattern both existing themes broadly follow, even when the intermediate helper layers differ.

The goal is to keep the file easy to scan:

- global decisions first
- shared structural helpers second
- individual templates last

Prefer this order over mixing template-specific selectors into the global layers.

Theme authors do not need to use these exact section titles, but the file should read in that order.

### 5. Page Types

Page templates are represented by page-type classes such as:
- `.title-slide`
- `.overview-slide`
- `.pricing-slide`
- `.swot-slide`
- `.roadmap-slide`

Page-type classes should:
- end with `-slide`
- describe slide role, not deck-specific content
- be applied together with `slide-shell` unless the template intentionally opts out
- use canonical names from this document whenever a standard role already exists

Good names:
- `.title-slide`
- `.comparison-slide`
- `.metrics-slide`
- `.roadmap-slide`

Avoid:
- `.page2`
- `.big-table`
- `.tokyo-day-three`
- `.customer-alpha-slide`

### 6. Contextual Element Styling

Style Markdown output inside the shell or page type, not globally.

Good:

```css
.pricing-slide h2 {
  color: var(--mk-accent);
}

.pricing-slide table {
  width: 100%;
}
```

Avoid:

```css
h2 {
  color: red;
}

table {
  width: 100%;
}
```

## Canonical Template Names

For reusable shared themes, canonical template names are the recommended shared vocabulary.

If a template matches one of the standard slide roles below, prefer the canonical name instead of inventing a theme-local name.

Themes do not need to implement every canonical template, and themes may keep distinct names when that improves author clarity. The key requirement is that the README makes the role, Markdown shape, and wiring obvious.

Canonical names:

- `title-slide`: cover, hero, opening title, or final closing page with title-driven composition
- `section-slide`: section divider or interstitial page with a short heading and minimal supporting content
- `summary-slide`: concise executive summary or high-level key-takeaways page
- `overview-slide`: mixed summary page with structured data plus supporting notes or callouts
- `comparison-slide`: side-by-side comparison of options, vendors, products, or strategic positions
- `feature-slide`: full-width matrix, capability table, or feature breakdown
- `metrics-slide`: KPI, scorecard, chart-adjacent metrics, or number-led insights page
- `process-slide`: implementation process, methodology, phased workflow, or ordered execution steps
- `swot-slide`: SWOT or other paired quadrant-style analysis
- `roadmap-slide`: roadmap, next steps, staged plan, or timeline-oriented action page
- `closing-slide`: ending page, thank-you page, or final recap page

Naming rules:

- Prefer canonical names over theme-specific names when the role is effectively the same
- Use a non-canonical name when the template role is materially different or the theme needs a clearer author-facing name
- When a non-canonical name is used, document the role and content shape explicitly in the README
- Public examples and docs should favor the clearest user-facing name for that theme

Examples:

- prefer `comparison-slide` over `positioning-slide` when the page is fundamentally a side-by-side comparison
- prefer `metrics-slide` over a theme-local KPI name when the page is mainly numbers, indicators, or chart support
- prefer `roadmap-slide` over a theme-local next-steps name when the page is phased action planning

## Page Template Standard

A page template is not a separate file. In MarkOS, a page template is the combination of:

- a slide layout such as `cover` or `two-cols`
- one or more class names attached through frontmatter
- a documented Markdown content shape
- CSS selectors scoped to that shape

Each page template in a shared theme should have a documented contract in the theme `README.md` with these fields:

- `Name`: template class name
- `Layout`: `default`, `cover`, or `two-cols`
- `Attach Point`: `class` or `layoutClass`
- `Purpose`: what kind of slide this template is for
- `Best For`: the content shape or job this template fits best
- `Avoid When`: common misuse or poor-fit content shapes
- `Expected Markdown Shape`: the heading/list/table/quote structure it expects
- `Wiring`: the frontmatter form authors should copy
- `Notes`: any important ordering assumptions or optional elements

Example template spec:

```md
Name: pricing-slide
Layout: two-cols
Attach Point: layoutClass
Purpose: side-by-side comparison of pricing or package details
Best For:
- left-column table plus right-column notes
Avoid When:
- purely narrative prose with no clear comparison structure
Expected Markdown Shape:
- left column starts with `#` or `##`
- table appears in the left column
- right column contains `##` sections followed by lists or notes
Wiring:
- `layout: two-cols`
- `layoutClass: slide-shell pricing-slide`
Notes:
- theme styles tables and `h2 + ul`
- avoid extra leading paragraphs before the first heading
```

If a theme relies on special ordering, document it explicitly. Do not make deck authors reverse-engineer the contract from CSS.

## Content Fidelity Guidance

Theme READMEs should explicitly support content-preserving adaptation, especially when decks are being reshaped by AI.

Document these principles in the theme README when the theme is intended for real authoring work:

- preserve facts, names, dates, numbers, ordering, and claims
- allow hierarchy changes such as turning prose into headings, bullets, tables, or multi-slide splits
- allow pagination changes when a source block is too dense for one slide
- avoid inventing new supporting points, summaries, or decorative filler just to satisfy a template
- note which templates are safe for light restructuring and which rely on stricter ordering

Themes do not need to prescribe one universal rewriting style, but they should make clear that the public API is about fitting existing content into stable Markdown shapes, not about forcing authors to guess from CSS.

## Theme Manifest

When themes use canonical template names, one shared authoring standard can cover most usage.

That means a full theme-specific guide is optional, not mandatory.

Each shared theme should still provide a minimal manifest that tells authors and AI what that specific theme implements.

The minimal manifest should live in the theme's `README.md`.

CSS comments are optional support material, not the primary manifest.

The manifest should include:
- `Theme Summary`
- `Shell`
- authoring rules that differ from the repo-wide defaults
- implemented canonical templates
- unsupported canonical templates when that matters
- non-canonical templates, if any
- deviations from the standard contract, if any
- a template catalog with content-shape guidance

If a theme follows canonical names and has no unusual behavior, the guide can stay concise. The goal is not length; the goal is that authors and AI can pick a template and use it correctly without opening the CSS.

## AI Workflow

When AI is asked to use or modify a theme, the recommended read order is:

1. `docs/theme-authoring.md`
2. `packages/core/themes/<Theme>/README.md`
3. `packages/core/themes/<Theme>/theme.css`

This gives the model:

- the shared contract first
- the theme-specific public API second
- the implementation details last

That order is usually better than asking the model to infer theme usage directly from CSS selectors.

For content adaptation tasks:

- use the theme README to choose templates
- use the theme README to decide what Markdown hierarchy to emit
- inspect `theme.css` only when debugging a mismatch, missing style, or selector-level bug

## Comment Standard

Shared theme CSS may include lightweight comments, but the authoritative authoring surface should be the theme `README.md`.

Use CSS comments to clarify implementation layers or unusual selector assumptions close to the code.

### 1. Theme Header Comment

An optional short header comment may appear at the top of the CSS file.

The header should include:
- `Theme`
- `Shell`
- `Implemented templates`
- `Unsupported templates` when relevant
- `Aliases` or `Deviations` when relevant

Example:

```css
/*
 * Theme: Cobalt
 * Shell: slide-shell
 * Implemented templates:
 * - title-slide
 * - summary-slide
 * - metrics-slide
 * Deviations:
 * - closing-slide is not implemented
 */
```

### 2. Section Comments

Add short section comments before major layers such as:
- design tokens
- base typography
- shared shell
- shared layout helpers
- page templates

Keep these comments short. Their job is to explain the layer, not narrate every selector.

Example:

```css
/* Section: Design Tokens */
/* Section: Shared Shell */
/* Shared helper: two-cols shell defaults */
```

### 3. Template Comments

Add a template comment block when the template needs authoring guidance beyond the canonical standard.

Template comments are recommended for:
- non-canonical templates
- canonical templates with important ordering assumptions
- canonical templates whose Markdown shape is unusually strict

Template comments are optional when a canonical template follows the shared contract without meaningful deviations.

When you add a template comment, it should include:
- `Template`
- `Layout`
- `Attach`
- `Purpose`
- `Expected Markdown`
- `Notes` when the template relies on ordering or other special assumptions

Example:

```css
/*
 * Template: title-slide
 * Layout: cover
 * Attach: class="slide-shell title-slide"
 * Purpose: editorial title or closing cover
 * Expected Markdown:
 * - optional short badge paragraph
 * - h1 title
 * - h2 subtitle
 * - optional supporting paragraph
 * Notes:
 * - first and last paragraphs receive positional styling
 */
```

### 4. Scope Of Comments

Comments should explain the authoring contract:
- which class to attach
- which layout to use
- what Markdown shape the template expects
- which assumptions are intentionally baked into the selectors

Comments should not:
- restate obvious CSS declarations
- describe every selector line by line
- become a long-form replacement for docs

Use comments for fast in-file guidance and use the theme `README.md` plus this document for the shared standard. When canonical names are followed closely, comments may stay very short.

## Class Wiring Rules

These rules should be treated as the standard way to attach page templates.

### `default` and `cover`

Attach shell and page type in `class`.

Example:

```md
---
layout: cover
class: slide-shell title-slide
---
```

### `two-cols`

Attach outer shell and page type in `layoutClass`.

Use `class` only for pane-level styling that should be repeated on both columns.

Example:

```md
---
layout: two-cols
layoutClass: slide-shell roadmap-slide
class: content-pane
---
```

### Recommended Rule Of Thumb

- `slide-shell` belongs on the outer slide wrapper
- page-type classes belong on the outer slide wrapper
- pane utility classes belong in `class` for `two-cols`
- keep one primary page type per slide

## Selector Rules

### Preferred Selectors

Prefer selectors that follow the renderer contract and the page template contract.

Good patterns:
- `.title-slide h1`
- `.metrics-slide .col-right h2`
- `.comparison-slide table`
- `.slide-shell blockquote`
- `.roadmap-slide h2 + ul`

These selectors are easy to read and easy to document.

### Discouraged Selectors

Avoid brittle selectors as the main public API for a reusable theme.

Use sparingly:
- `:nth-of-type(...)`
- `> p:first-child`
- `> p:last-of-type`
- deep selectors with many descendant hops

Avoid entirely when possible:
- selectors tied to specific text content
- selectors that assume deck-specific file names
- selectors that depend on runtime app chrome outside the slide
- selectors that depend on external frameworks being present

If a template uses ordering selectors on purpose, document the assumption in that template's spec.

## Markdown-Safe Theme Design

Themes should be designed around Markdown that authors can write naturally.

Prefer templates that tolerate:
- one extra sentence
- one missing paragraph
- shorter lists
- longer table cells
- slides with or without blockquotes

Be careful when a template assumes:
- the first paragraph is always a badge
- the last paragraph is always a footnote
- the second heading always means a specific section
- the first and second lists always map to fixed panels

Those patterns can still be used, but they should be limited to tightly defined templates and documented as part of the template contract.

## Theme Boundaries

### What Belongs In Shared Theme CSS

- tokens
- typography
- shell treatment
- page types
- Markdown element styling inside a page type
- shared table, quote, and list treatments

### What Belongs In Deck-Local `slides.css`

- one-off spacing fixes for a specific deck
- temporary overrides for unusually long content
- deck-specific imagery or branding exceptions
- experimentation that has not earned promotion into the shared theme

### What Does Not Belong In The Theme Contract

- page-level JavaScript requirements
- Chart.js bootstrapping
- remote CSS framework assumptions
- separate HTML files as the authoring surface

If a slide needs charts or interactive widgets, treat that as a renderer or runtime feature, not as part of the CSS theme standard.

## Minimal Theme Skeleton

Use this as the starting point for new shared themes.

Recommended file layout:

```text
packages/core/themes/
  MyTheme/
    README.md
    theme.css
```

Recommended README skeleton:

```md
# MyTheme

MyTheme is a one-line summary of the visual direction and best use cases.

## Theme Summary

- Shell: `slide-shell`
- Tone: editorial / analytic / minimal / etc.

## Authoring Rules

- Use the theme name `MyTheme` in file-level frontmatter
- Use `class` for `cover` and `default`
- Use `layoutClass` for `two-cols`

## Template Catalog

### title-slide

- Layout: `cover`
- Attach Point: `class`
- Purpose: opening cover or title-led closing page
- Best For: short framing copy, title, subtitle, CTA
- Avoid When: dense tables or long bullet lists
- Expected Markdown Shape:
  - optional short badge paragraph
  - `#` title
  - `##` subtitle
  - optional supporting paragraph
- Wiring:
  - `layout: cover`
  - `class: slide-shell title-slide`

### metrics-slide

- Layout: `two-cols`
- Attach Point: `layoutClass`
- Purpose: KPI or scorecard page
- Best For: numbers, metric-led bullets, chart-adjacent summaries
- Avoid When: purely narrative storytelling

## Template Selection Guide

- Use `title-slide` for opening and closing pages
- Use `metrics-slide` when numbers lead the story

## Content Fidelity Guidance

- Preserve facts and ordering
- Allow headings, bullets, tables, and pagination changes
- Do not invent new claims to make a template feel fuller

## Examples
```

```css
:root {
  --mk-bg: #f4f1ec;
  --mk-card: #ffffff;
  --mk-card-soft: #faf7f2;
  --mk-accent: #d4632b;
  --mk-text: #1f1f1f;
  --mk-muted: #5c5c5c;
  --mk-border: rgba(0, 0, 0, 0.08);
  --mk-shadow: 0 24px 60px rgba(0, 0, 0, 0.12);
}

.slidev-layout {
  font-family: Georgia, "Times New Roman", serif;
  color: var(--mk-text);
}

.slide-shell {
  position: relative;
  background: var(--mk-bg);
}

.slide-shell::before {
  content: "";
  position: absolute;
  inset: 24px;
  background: var(--mk-card);
  border: 1px solid var(--mk-border);
  box-shadow: var(--mk-shadow);
  z-index: -1;
}

.title-slide {
  padding: 36px 60px;
}

.title-slide h1 {
  font-size: 3rem;
  line-height: 1.1;
}

.title-slide h2 {
  color: var(--mk-muted);
}

.metrics-slide {
  grid-template-columns: 3fr 2fr;
  padding: 24px;
}

.metrics-slide .col-left,
.metrics-slide .col-right {
  padding: 36px 40px;
}

.metrics-slide h2 {
  color: var(--mk-accent);
}

.metrics-slide table {
  width: 100%;
  border-collapse: collapse;
}

.metrics-slide th,
.metrics-slide td {
  padding: 0.75rem 0.9rem;
  border-bottom: 1px solid var(--mk-border);
}
```

Example usage:

```md
---
theme: MyTheme
title: Theme Demo
---

---
layout: cover
class: slide-shell title-slide
---

# Quarterly Review

## Market expansion and operating plan

---
layout: two-cols
layoutClass: slide-shell metrics-slide
class: content-pane
---

# KPI Snapshot

| Metric | Value |
| --- | ---: |
| Revenue | 124 |
| Margin | 37% |

::right::

## Key takeaways
- Conversion improved in all focus markets
- Supply cost stabilized after Q2
```

## Recommended Workflow

1. Start with tokens in `:root`
2. Build a single stable `.slide-shell`
3. Map page roles to canonical template names before inventing new ones
4. Add two or three page types before adding more
5. Test each page type with real Markdown, not placeholder HTML
6. Verify the theme is usable without any deck-local `slides.css`
7. Move only truly reusable patterns into the shared theme
8. Publish a minimal theme manifest and document only real deviations

## Review Checklist

Before merging a new shared theme, check these points:

- Theme file lives in `packages/core/themes/` and is selected through `theme: <Name>`
- Theme works without requiring deck-local overrides for common slides
- Tokens are centralized in `:root`
- `.slide-shell` exists and acts as the shared outer surface
- Canonical template names are used when applicable
- Page-type classes end with `-slide`
- `default`, `cover`, and `two-cols` wiring rules are followed
- Markdown elements are styled contextually, not through unscoped global selectors
- Ordering-based selectors are rare and documented
- Theme does not depend on Tailwind, Chart.js, or page-level JavaScript
- Theme README is sufficient to choose templates without reading CSS
- Theme README documents expected Markdown shape and wiring for implemented templates
- Theme README includes content-fidelity guidance for adaptation work

## Relation To Existing Docs

- Use the [Developer Guide](./developer-guide.md#development-principles) for the repo-level principles behind theme flexibility, doc-first contracts, override boundaries, and examples
- Use [Syntax Guide](./syntax.md) for deck file rules and frontmatter
- Use [CSS Rules](./syntax-css.md) for the single-entry CSS model and class wiring basics
- Use this document when creating or refactoring reusable shared themes

[`packages/core/themes/Clay/theme.css`](../packages/core/themes/Clay/theme.css) and [`packages/core/themes/Clay/README.md`](../packages/core/themes/Clay/README.md) are the current reference implementation in this repo. This guide is the normative standard for future theme authoring work.
