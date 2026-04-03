# Markdown Syntax

MarkOS recommends a flat local deck layout:

```text
deck/
  slides.md
  slides.css
```

`slides.md` is the only content entry for a deck.

## File Contract

- Keep one deck in one Markdown file such as `slides.md`
- Keep custom styling in one sibling CSS file such as `slides.css`
- Keep local authoring focused on that source pair; other files in the deck directory are ignored
- Do not rely on `styles/index.css` or theme preset CSS
- There is no deck-wide frontmatter block
- The first slide follows the same page-frontmatter rules as every other slide

## Page Frontmatter

Put a frontmatter block at the start of a slide only when that slide needs configuration:

```md
---
title: Team Update
layout: cover
class: slide-shell title-slide
---

# Cover Slide
```

If a slide does not need configuration, just write content directly and let the renderer use defaults.

Supported slide-level fields that matter to the current renderer:
- `title`: slide title label, also used as the document title when set on the first slide
- `layout`: `default`, `cover`, or `two-cols`
- `class`: extra class names for `default` and `cover`, or repeated pane classes in `two-cols`
- `layoutClass`: extra class names for the outer `two-cols` container
- `background`: inline background value applied to the slide wrapper

## Slide Boundaries

Separate slides with a line containing only `---`:

```md
# Cover

---

# Next Slide
```

## Two-Column Syntax

Use `layout: two-cols` and split content with `::right::`:

```md
---
layout: two-cols
layoutClass: slide-shell pricing-slide
---

## Left Column
- Point A
- Point B

::right::

## Right Column
- Point C
- Point D
```

Notes:
- Content before `::right::` becomes the left column
- Content after `::right::` becomes the right column
- In `two-cols`, `layoutClass` styles the outer grid container and `class` styles both column panes

## Markdown Surface

Within each slide, MarkOS currently renders standard Markdown through `marked` with GFM and line breaks enabled.

You can safely rely on:
- headings
- paragraphs
- lists
- tables
- links
- code fences
- blockquotes
- inline emphasis

Practical recommendation:
- Use the first meaningful heading or line as the slide title you want to see in overview and presenter modes
- If you want an explicit slide label, set `title` in that slide's frontmatter
- Keep slide structure explicit with headings and short blocks, because your CSS hooks will usually target those elements

## Example

See [slides.md](C:/Users/xuao5/Desktop/MarkOS-Slides/examples/project/slides.md) for a working example.
