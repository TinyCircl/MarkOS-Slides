# Theme Authoring

MarkOS shared themes are reusable theme folders stored in `packages/core/themes/`.

A shared theme is selected through file-level frontmatter in `slides.md`, loaded before the deck-local `slides.css`, and is expected to provide a stable authoring surface for deck writers.

This document is the repo-wide standard for making CSS themes and page templates.

## What A Theme Is

- A shared theme folder at `packages/core/themes/<ThemeName>/`
- A `theme.css` implementation file inside that folder
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
    theme.css
    templates/
      panel-media.css
    fixtures/
      body.md
      two-column.md
```

Use these files for different responsibilities:

- `theme.css`: tokens, shell styling, page templates, and contextual Markdown styling
- `fixtures/*.md`: template validation decks built from real Markdown wiring and used as the primary acceptance surface

If a theme includes fixtures, prefer one fixture deck per template and put multiple content-density variants into that same file.

Treat fixture decks as pressure tests, not just happy-path examples.

For example, `two-column.md` should usually contain several `two-column` pages:

- a happy-path case
- a sparse case
- a standard case
- a denser case
- a long-title case
- a long-paragraph or many-items case when that template is sensitive to content volume
- an image case when the template is expected to support media inside a panel or card
- optionally an alternate-shape case when the template supports more than one valid Markdown shape

This keeps template tuning focused on real adaptation behavior instead of a single polished demo.

The goal is to answer questions like:

- does the title wrap too early
- does the card overflow vertically
- do 2, 3, or 4 right-column sections still feel balanced
- does a minimal page still look intentional
- does a dense page stay readable without manual one-off fixes
- does a Markdown image stay inside the panel frame instead of escaping the layout

Use the real preview command when tuning a template:

```bash
npm run markos:theme-preview -- <Theme> two-column --port 3030
```

This renders `packages/core/themes/<Theme>/fixtures/two-column.md` through the actual MarkOS dev pipeline, so it is a better acceptance surface than hand-written HTML sketches.

When a theme includes visual references or mockups, use them as style inspiration. Use fixture decks as the real validation surface.

## Reference Directory

If a theme includes a `reference/` directory, treat it as a free-form reference repository.

This means:

- `reference/` does not define the runtime contract
- `reference/` is not part of the active theme surface
- files inside `reference/` do not need to match the active template inventory
- files inside `reference/` should not be deleted just because they are not imported or directly cited elsewhere

`reference/` may contain:

- HTML mockups
- abandoned explorations
- third-party or historical layout studies
- visual experiments for future templates

Use `reference/` for inspiration and comparison only. Use `theme.css`, template files, and `fixtures/*.md` for actual authoring and validation.

## Theme-Level READMEs Are Optional

The fixed public page inventory is defined only by this document.

Theme-level `README.md` files are optional and are not part of the public authoring contract.

If a theme keeps a local README for migration notes or maintainer context, treat it as non-normative support material.

The required authoring source of truth is:

- `docs/theme-authoring.md` for the fixed eight public page roles
- `packages/core/themes/<Theme>/theme.css` for the implementation
- `packages/core/themes/<Theme>/fixtures/*.md` for runnable validation

Do not put required template names, required wiring, or required authoring decisions into per-theme READMEs.

## Authoring Source Of Truth

Use this precedence order when documenting and maintaining themes:

1. `docs/theme-authoring.md` defines the global standard
2. `packages/core/themes/<Theme>/theme.css` implements the API
3. `packages/core/themes/<Theme>/fixtures/*.md` validate the API with real Markdown

This means:

- shared rules belong in this document
- implementation details belong in the CSS
- runnable examples and pressure tests belong in fixtures
- optional theme-local notes should never redefine the public contract

Avoid duplicating the full template contract across multiple theme-local files.

For theme usage and content adaptation, prefer this document over inferred CSS behavior. CSS should implement the contract, not define it implicitly.

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
- When a theme promotes title content into a `two-cols` header row, only title and supporting text should be lifted there; media should remain in the body column it belongs to
- Theme CSS should target Markdown output such as headings, paragraphs, lists, tables, blockquotes, links, and code

Practical examples:

```md
---
layout: cover
class: slide-shell title
---
```

```md
---
layout: two-cols
layoutClass: slide-shell two-column
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
- shared media values such as image radius or media height clamps when the theme supports images inside panels

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
5. optional shared media helpers for Markdown images inside cards or panels
6. optional shared template-family helpers
7. concrete page-template blocks such as `.title` or `.two-column`
8. export or responsive safety fixes when needed

This is the pattern both existing themes broadly follow, even when the intermediate helper layers differ.

The goal is to keep the file easy to scan:

- global decisions first
- shared structural helpers second
- individual templates last

Prefer this order over mixing template-specific selectors into the global layers.

Theme authors do not need to use these exact section titles, but the file should read in that order.

### 5. Page Types

Page templates are represented by page-type classes such as:
- `.title`
- `.toc`
- `.two-column`
- `.closing`

Page-type classes should:
- use the fixed suffix-free names from this document
- describe slide role, not deck-specific content
- be applied together with `slide-shell` unless the template intentionally opts out
- use only the required public names from this document

Good names:
- `.title`
- `.body`
- `.image-text`

Avoid:
- `.page2`
- `.big-table`
- `.tokyo-day-three`
- `.customer-alpha`
- `.metrics`
- `.roadmap`
- `.comparison`

### 6. Contextual Element Styling

Style Markdown output inside the shell or page type, not globally.

Good:

```css
.two-column h2 {
  color: var(--mk-accent);
}

.body table {
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

## Required Public Template Inventory

For reusable shared themes, the public template inventory is fixed.

Every shared theme in this repository must expose exactly these eight author-facing template names:

- `title`
- `toc`
- `section-divider`
- `body`
- `two-column`
- `image-text`
- `full-bleed-image`
- `closing`

This rule is strict.

- shared themes should implement all eight
- all eight page roles are mandatory, not optional
- shared themes should not expose additional public template names
- theme-local names such as `metrics`, `comparison`, `roadmap`, `pricing`, or `swot` should not be part of the public authoring surface and should not appear in new authoring examples
- docs, examples, skills, and any optional theme-local notes should use only these eight names

These names represent page roles, not visual sameness.

Different themes may style the same page role differently, but the public page-type vocabulary must stay limited to these eight names.

Role definitions:

- `title`: opening cover with title-led composition
- `toc`: table of contents or chapter navigation page
- `section-divider`: short transition page that introduces a new section
- `body`: single-column general content page
- `two-column`: two-column comparison or parallel-information page
- `image-text`: image-plus-text page, either left-right or right-left
- `full-bleed-image`: image-only full-page visual emphasis page
- `closing`: ending page, thank-you page, CTA page, or Q&A page

Reference table:

| Template Name | Chinese Name | Purpose | Typical Content |
| --- | --- | --- | --- |
| `title` | 封面页 | The opening slide that sets the deck topic and visual tone | Large title, subtitle, author, date, logo |
| `toc` | 目录页 | Section navigation for the overall deck structure | Numbered section list, optional current-section highlight |
| `section-divider` | 章节分隔页 | Transition slide that marks the start of a new section | Section title, optional section number or icon |
| `body` | 标题+正文页 | The most general single-column content page | Title, paragraphs, lists, tables, code blocks |
| `two-column` | 双栏对比页 | Parallel or comparative information shown in two columns | Left and right headings with supporting content, optional comparison emphasis |
| `image-text` | 图文页 | Narrative page that pairs an image with explanatory text | Image on one side, title and descriptive text on the other |
| `full-bleed-image` | 全图页 | Pure image page that lets one image fill the full slide area | One full-page image without surrounding text |
| `closing` | 结尾页 | Final page that closes the deck and prompts next action | Thank-you message, CTA, contact details, Q&A cue |

Image support is also fixed at the public-contract level.

- Only `body`, `two-column`, `image-text`, and `full-bleed-image` support Markdown images.
- `title`, `toc`, `section-divider`, and `closing` are text-only templates.
- For text-only templates, image content should be filtered even if an author or AI includes Markdown image syntax by mistake.
- `image-text` is not a single-image fallback. If a page is image-only, use `full-bleed-image`.

## Page Template Standard

A page template is not a separate file. In MarkOS, a page template is the combination of:

- a slide layout such as `cover` or `two-cols`
- one or more class names attached through frontmatter
- a documented Markdown content shape
- CSS selectors scoped to that shape

Each page template in a shared theme should follow the contract in this document and prove it through fixtures.

When a template needs local explanation beyond the shared standard, keep that explanation close to the implementation with short CSS comments or clearly named fixture variants.

Important fields to keep stable in the implementation:

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
Name: two-column
Layout: two-cols
Attach Point: layoutClass
Purpose: side-by-side comparison or parallel information page
Best For:
- left-column basis plus right-column notes
Avoid When:
- the content only needs one column
Expected Markdown Shape:
- left column starts with `#` or `##`
- left column carries a structured basis, short note, blockquote, or image
- right column contains `##` sections followed by lists or notes
Wiring:
- `layout: two-cols`
- `layoutClass: slide-shell two-column`
Notes:
- title and subtitle may be promoted above the split columns
```

If a theme relies on special ordering, document it explicitly with CSS comments or fixture naming. Do not make deck authors reverse-engineer the contract from CSS.

## Adaptivity First

The most important requirement for a real shared theme is adaptivity.

Templates are not designed for one perfect demo page. They are designed to keep working when the same page role receives more content, less content, longer copy, shorter copy, or a different valid Markdown shape.

The default posture should be to leave breathing room. A stable template should look intentional when content is light or standard, and only spend that spare space once density actually increases.

In practice this means:

- adapt spacing before inventing a new template
- adapt card height before letting content spill outside the slide
- adapt typography before giving up on the layout
- adapt media framing so images stay inside the same panel contract as text
- test sparse, standard, and dense states as part of normal theme work
- prefer open space in the default state, then let adaptivity gradually consume that space as density rises

A theme that looks good only in its ideal example is not finished. A reusable theme should actively compress, rebalance, and tighten itself as density increases while keeping the page role recognizable.

Adaptive behavior may include:

- smaller gaps when card counts increase
- smaller padding when a panel becomes denser
- smaller title or body font sizes when card height is under pressure
- card spanning behavior such as letting the last odd item take full width
- media height clamps that preserve the panel frame instead of letting images define the layout

Treat these adaptive rules as part of the public template contract, not as optional polish.

## Complex Templates Are Allowed

Shared themes do not need to optimize for the simplest possible Markdown at the cost of visual quality.

If a page template is visually strong only when it receives a more structured Markdown shape, that is acceptable.

In practice this means:

- a complex template may require stricter heading order or block order than a basic template
- a complex template may rely on repeated `## + paragraph/list/table` groups to achieve the intended composition
- a complex template may expect one column to carry a more specific Markdown shape than the other
- a theme should not be flattened into a generic layout just to make the CSS feel more KISS if the result is visibly worse

MarkOS deck authoring is primarily AI-assisted, so moderate Markdown control is an acceptable tradeoff when it materially improves the final slide design.

The important boundary is:

- do not invent new author-facing syntax beyond normal Markdown, frontmatter, and the fixed page-template classes
- do allow a template to be stricter about how standard Markdown is arranged when that strictness is what makes the template work well

When a template depends on a stricter Markdown shape, document that expectation in:

- the fixture deck for that page type
- short template-local CSS comments when the ordering requirement is easy to miss

Prefer a good-looking template with clear Markdown expectations over a flatter template that is easier to implement but visually weak.

## Fixture Validation Strategy

Each reusable page template should have a matching fixture deck when the theme is intended for real authoring work.

Recommended approach:

- one fixture file per template
- one file contains several pages for that template
- each page stresses a different content condition
- the fixture is rendered through the real `markos:theme-preview` or build pipeline

Common stress cases:

- short title
- long title
- short supporting copy
- long supporting copy
- sparse content
- dense content
- few list items
- many list items
- image inside a top-level panel
- image inside a blockquote or card when the template supports those surfaces
- alternate valid Markdown shape when the template supports it

Do not treat the fixture as a brochure page whose only job is to look ideal. Its main job is to reveal where the template breaks, feels empty, or becomes visually unbalanced.

## Panel Media Guidance

Only `body`, `two-column`, and `image-text` should treat images as supported content forms.

For those image-capable templates, when a template already provides a stable panel or card surface, images should be treated as content that fits inside that surface, not as a separate layout mode.

Preferred rules:

- deck authors use Markdown only, so images must be introduced with standard Markdown image syntax such as `![alt text](image-url)`; theme authoring must not require raw HTML for image placement
- let the existing panel or card define the frame
- crop media inside that frame with stable dimensions instead of letting raw image size decide the layout
- use a shared theme token for image radius when the same image language appears across templates
- keep image radius modest by default so media does not visually overpower the surrounding panel system

Avoid:

- making image support depend on raw HTML or any author-written HTML escape hatch
- letting a large source image redefine the height of a panel that is meant to stay structurally stable
- inventing a second visual system where text panels and image panels have unrelated shapes

In practice, a good shared theme should make these pairs interchangeable when the content role is the same:

- narrative panel or image panel
- quote panel or image-backed panel
- metric card with only text or metric card with a supporting image

The panel remains the contract. The image is only one valid content form inside that contract for `body`, `two-column`, and `image-text`.

## PPTX Export-Aware Theme Design

MarkOS now exports editable `pptx` through the real web render pipeline.

That means theme CSS should not only look right in the browser. It should also keep the final DOM easy for the exporter to measure and rebuild as native PowerPoint objects.

The current exporter is documented in [PPTX Export Architecture](./pptx-export-implementation.md).

### What The Exporter Handles Best

The current exporter is strongest when templates present content as:

- real headings, paragraphs, lists, and table cells
- real Markdown images that render to `img` elements
- simple colored panels and blocks
- simple borders that can be rebuilt as accent bars or rectangle outlines
- stable header and column regions

### Write Semantic Content As Real DOM

If content needs to stay editable in PPTX, keep it as real text in the slide DOM.

Prefer:

- `#`, `##`, paragraphs, lists, tables, captions, and code blocks
- Markdown images for exportable visuals

Avoid for important content:

- `::before` or `::after` generated text
- CSS `content:` for labels, headings, or numbers the user needs to edit later
- putting meaningful copy only inside decorative wrappers with no semantic text node

If the browser can only see the content as a CSS trick, the PPTX exporter will usually not preserve it as editable text.

### Prefer Real Images Over CSS Background Images

If an image should survive as an editable/exportable PPTX image object, render it as a real image node through Markdown.

Prefer:

- `![](...)`
- image inside a panel, card, blockquote, or dedicated image region

Avoid for important visuals:

- `background-image` as the only source of a meaningful photo or diagram
- pseudo-element images used as the only carrier of content

Decorative background imagery is fine for browser rendering, but it should not be the only place where the slide stores meaningful content.

### Keep Shapes Simple When Editability Matters

The exporter currently rebuilds simple panels and accents better than highly stylized browser effects.

Prefer:

- flat fills
- simple borders
- modest border radius
- stable rectangular or elliptical blocks

Use caution with:

- heavy blur shadows
- filters
- masks
- blend modes
- complex layered decorative effects
- rotation or transform-driven composition for important content

These effects may still look fine in HTML, but PPTX export may approximate them or drop them.

### Do Not Hide Important Content In Layout Tricks

The exporter measures final browser geometry, but it still works best when important content is laid out plainly.

Prefer:

- stable header regions
- stable left and right column regions
- content that remains visible without depending on fragile clipping

Avoid:

- relying on overflow clipping to hide part of important text
- stacking meaningful content underneath decorative layers
- requiring exact z-index tricks for the slide to make sense

Decorative layers are fine. Critical information should remain visually and structurally obvious in the final DOM.

### Tables Are Allowed, But Native PPTX Table Semantics Are Still Limited

Tables are valid authoring content and should continue to be supported in themes.

But today the exporter is better at preserving:

- table text
- table geometry
- surrounding panels

than at rebuilding full native editable PowerPoint tables.

So if PPTX editability is a priority, prefer layouts where the table can still be understood if it is rebuilt as positioned text and shapes rather than a rich native table object.

### Exportability Should Be Tested Through Fixtures

If a theme supports PPTX-facing pages, test them with real fixture decks and real export:

```bash
npm run markos:theme-preview -- <Theme> two-column --port 3030
npm run markos:export -- <deck> --format pptx
```

During fixture review, check:

- important text stays in real text nodes
- images stay inside panel frames and export as images
- titles and columns remain structurally obvious
- dense pages still export without clipped text or collapsed geometry
- decorative effects do not carry essential meaning

## Content Fidelity Guidance

Shared themes should explicitly support content-preserving adaptation, especially when decks are being reshaped by AI.

Document or enforce these principles through this shared standard, fixtures, and optional implementation comments:

- preserve facts, names, dates, numbers, ordering, and claims
- allow hierarchy changes such as turning prose into headings, bullets, tables, or multi-slide splits
- allow pagination changes when a source block is too dense for one slide
- avoid inventing new supporting points, summaries, or decorative filler just to satisfy a template
- note which templates are safe for light restructuring and which rely on stricter ordering

Themes do not need to prescribe one universal rewriting style, but they should make clear through stable behavior that the public API is about fitting existing content into stable Markdown shapes, not about forcing authors to guess from CSS.

## AI Workflow

When AI is asked to use or modify a theme, the recommended read order is:

1. `docs/theme-authoring.md`
2. `packages/core/themes/<Theme>/fixtures/*.md`
3. `packages/core/themes/<Theme>/theme.css`

This gives the model:

- the shared contract first
- the real Markdown validation surface second
- the implementation details last

That order is usually better than asking the model to infer theme usage directly from CSS selectors.

For content adaptation tasks:

- use `docs/theme-authoring.md` to choose templates
- use fixtures to understand valid Markdown shape and density behavior
- inspect `theme.css` only when debugging a mismatch, missing style, or selector-level bug

## Comment Standard

Shared theme CSS may include lightweight comments, and comments are now the preferred place for short template-local caveats.

Use CSS comments to clarify implementation layers or unusual selector assumptions close to the code.

### 1. Theme Header Comment

An optional short header comment may appear at the top of the CSS file.

The header should include:
- `Theme`
- `Shell`
- `Implemented templates`
- `Migration status` when relevant
- `Aliases` or `Deviations` when relevant during migration

Example:

```css
/*
 * Theme: Cobalt
 * Shell: slide-shell
 * Implemented templates:
 * - title
 * - toc
 * - section-divider
 * - body
 * - two-column
 * - image-text
 * - closing
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

Add a template comment block when the template needs authoring guidance beyond the shared seven-page standard.

Template comments are recommended for:
- templates with important ordering assumptions
- templates whose Markdown shape is unusually strict
- templates with dense adaptive behavior or media rules worth keeping close to the code

Template comments are optional when a template follows the shared contract without meaningful caveats.

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
 * Template: title
 * Layout: cover
 * Attach: class="slide-shell title"
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

Use comments for fast in-file guidance and use this document for the shared standard. When a template follows the shared standard closely, comments may stay very short.

## Class Wiring Rules

These rules should be treated as the standard way to attach page templates.

### `default` and `cover`

Attach shell and page type in `class`.

Example:

```md
---
layout: cover
class: slide-shell title
---
```

### `two-cols`

Attach outer shell and page type in `layoutClass`.

Use `class` only for pane-level styling that should be repeated on both columns.

Example:

```md
---
layout: two-cols
layoutClass: slide-shell two-column
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
- `.title h1`
- `.two-column .col-right h2`
- `.body table`
- `.slide-shell blockquote`
- `.image-text h2 + p`

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
    theme.css
    fixtures/
      body.md
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

.title {
  padding: 36px 60px;
}

.title h1 {
  font-size: 3rem;
  line-height: 1.1;
}

.title h2 {
  color: var(--mk-muted);
}

.two-column {
  grid-template-columns: 3fr 2fr;
  padding: 24px;
}

.two-column .col-left,
.two-column .col-right {
  padding: 36px 40px;
}

.two-column h2 {
  color: var(--mk-accent);
}

.body table,
.two-column table {
  width: 100%;
  border-collapse: collapse;
}

.body th,
.body td,
.two-column th,
.two-column td {
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
class: slide-shell title
---

# Quarterly Review

## Market expansion and operating plan

---
layout: two-cols
layoutClass: slide-shell two-column
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
3. Map every public page role to one of the fixed eight template names and do not invent new public names
4. Keep the public page inventory limited to those eight names
5. Test each page type with real Markdown, not placeholder HTML
6. Verify the theme is usable without any deck-local `slides.css`
7. Move only truly reusable patterns into the shared theme
8. Keep any optional theme-local notes minimal and never use them to redefine the public contract

## Review Checklist

Before merging a new shared theme, check these points:

- Theme file lives in `packages/core/themes/` and is selected through `theme: <Name>`
- Theme works without requiring deck-local overrides for common slides
- Tokens are centralized in `:root`
- `.slide-shell` exists and acts as the shared outer surface
- The fixed eight public page names are the only author-facing template names
- Page-type classes use the fixed suffix-free public names
- `default`, `cover`, and `two-cols` wiring rules are followed
- Markdown elements are styled contextually, not through unscoped global selectors
- Ordering-based selectors are rare and documented
- Theme does not depend on Tailwind, Chart.js, or page-level JavaScript
- The theme is understandable from `theme-authoring.md`, fixtures, and CSS comments without relying on a theme README
- Fixtures demonstrate expected Markdown shape and wiring for implemented templates
- Content-fidelity expectations match the shared standard

## Relation To Existing Docs

- Use the [Developer Guide](./developer-guide.md#development-principles) for the repo-level principles behind theme flexibility, doc-first contracts, override boundaries, and examples
- Use [Syntax Guide](./syntax.md) for deck file rules and frontmatter
- Use [CSS Rules](./syntax-css.md) for the single-entry CSS model and class wiring basics
- Use this document when creating or refactoring reusable shared themes

[`packages/core/themes/Clay/theme.css`](../packages/core/themes/Clay/theme.css) is the current reference implementation in this repo. This guide is the normative standard for future theme authoring work.
