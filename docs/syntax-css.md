# CSS Rules

MarkOS recommends a flat local deck layout:

```text
deck/
  slides.md
```

`slides.css` is an optional deck-local override layer. MarkOS loads the shared theme CSS first and then bundles the sibling `slides.css` file after it when the file exists.

## Optional Override Layer

- Most decks should not need a hand-written CSS file
- Add `slides.css` only when the shared theme is not enough
- Treat `slides.css` as the override layer that comes after the shared theme CSS
- Use `overrides.css` only when you need a separate final override layer after `slides.css`
- Do not split the main authoring path across `styles/` directories or preset CSS

## Shared Themes

If you want a centrally managed theme library, keep the source CSS files in `themes/` and reference one from file-level frontmatter:

```md
---
theme: Clay
---
```

Use the theme folder name only. Do not write `theme: Clay.css`.

That flow keeps the architecture explicit:
- `themes/<Theme>/theme.css` files are the standard reusable theme sources
- `themes/<Theme>/README.md` is the theme manifest and usage surface for authors and AI
- `deck/slides.css` is the local override layer for that deck
- `deck/overrides.css` is an optional final incremental override layer
- the runtime loads the shared theme first and the deck-local overrides second

If you are creating a reusable shared theme, use [Theme Authoring](./theme-authoring.md) as the normative guide for page-template structure, naming, selector rules, and review criteria.

## Build Output Note

Today, MarkOS bundles the final CSS into `dist/index.html`.

That means:
- there is no standalone CSS file in `dist/`
- if an AI or advanced workflow modifies built styling, it currently edits the generated HTML output
- `slides.css` remains the source-side override file, not a required user-facing syntax step

## Recommended CSS Architecture

Use this layering model:

```text
=============================================================================
                       [ Slide CSS Architecture ]
=============================================================================

[Layer 1: Design Tokens]
  :root
   - brand colors
   - surface colors
   - text colors
   - borders and shadows

[Layer 2: Base Shell]
  .slidev-layout
   - deck-wide font and typographic defaults

  .slide-shell
   - shared card surface
   - inner spacing
   - border radius
   - shadow

[Layer 3: Page Types]
  .title-slide
  .two-columns
  .swot-slide
  .pricing-slide
  ...
   - layout proportions
   - page-specific spacing
   - visual tone by slide role

[Layer 4: Contextual Element Styling]
  .title-slide h1
  .pricing-slide .col-left h2
  .pricing-slide .col-right ul
  .swot-slide table
  .slide-shell blockquote
  ...
   - intercept Markdown elements inside each page type
   - restyle headings, lists, tables, and quotes by context
```

## Class Wiring Rules

Use the CSS hooks according to the renderer's actual HTML structure:

- For `default` and `cover` slides, put your shell and page-type classes in `class`
- For `two-cols` slides, put container-level classes such as `slide-shell` and `pricing-slide` in `layoutClass`
- For `two-cols` slides, use `class` only when you want the same class applied to both column panes

Recommended patterns:

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

## Suggested CSS Skeleton

```css
:root {
  --ab-accent: #f06b1f;
  --ab-accent-soft: rgba(240, 107, 31, 0.12);
  --ab-bg: #f3f1ec;
  --ab-card: #ffffff;
  --ab-card-warm: #fff8ef;
  --ab-text: #1b1b1b;
  --ab-muted: #555555;
  --ab-subtle: #777777;
  --ab-border: rgba(0, 0, 0, 0.08);
  --ab-shadow: 0 24px 60px rgba(0, 0, 0, 0.12);
}

.slidev-layout {
  font-family: Montserrat, Helvetica, Arial, sans-serif;
  color: var(--ab-text);
}

.slide-shell {
  padding: 24px;
  background: var(--ab-card);
  border: 1px solid var(--ab-border);
  border-radius: 28px;
  box-shadow: var(--ab-shadow);
}

.title-slide h1 {
  font-size: 2.6rem;
  border-bottom: 4px solid var(--ab-accent);
}

.pricing-slide .col-left h2,
.pricing-slide .col-right h2 {
  color: var(--ab-accent);
}

.pricing-slide ul {
  padding-left: 1.2rem;
}
```

## Practical Styling Rules

- Start with tokens in `:root`, so the deck can be rethemed without rewriting selectors
- Use `.slide-shell` as the shared visual base, not as an ad hoc one-off rule
- Add page-type classes for slide roles, not for single isolated elements
- Style Markdown output contextually, for example `.pricing-slide h2` or `.swot-slide table`
- Prefer a small number of stable class names over many one-off selectors

## Example

See [slides.css](C:/Users/xuao5/Desktop/MarkOS-Slides/examples/tokyo3days/slides.css) for a working example.
