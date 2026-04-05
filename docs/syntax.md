# Syntax Guide

MarkOS syntax is Markdown-first.

For normal deck authoring, `slides.md` is the main file users write. Most decks should not require hand-written CSS.

MarkOS recommends a flat local deck layout:

```text
deck/
  slides.md
```

`slides.md` is the only content entry for a deck.

## File Contract

- Keep one deck in one Markdown file such as `slides.md`
- Use file-level frontmatter for deck-wide settings such as `theme`
- Add `slides.css` only when you need deck-local style overrides
- Keep local authoring focused on that source pair; other files in the deck directory are ignored
- Do not rely on `styles/index.css` or theme preset CSS

## File Frontmatter

Use the opening frontmatter block for deck-wide settings:

```md
---
theme: Clay
title: Team Update
aspectRatio: 16/9
canvasWidth: 1280
---
```

Supported file-level fields that matter to the current renderer:
- `theme`: shared theme name, resolved from the standard `themes/<theme>/theme.css` entry
  Use the theme folder name only, for example `Clay`, not `Clay.css`
- `title`: document title
- `aspectRatio`: for example `16/9` or `4/3`
- `canvasWidth`: viewport width in pixels

Do not put page-only fields such as `layout`, `class`, `layoutClass`, or `background` in the first frontmatter block.

## Page Frontmatter

After file frontmatter, put a page frontmatter block before a slide only when that slide needs configuration:

```md
---
layout: cover
class: slide-shell title
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
layoutClass: slide-shell two-column
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

For the higher-level reasoning behind these rules, also read:

- [Developer Guide](./developer-guide.md#development-principles): why MarkOS favors content fidelity, shared doc contracts, and lightweight authoring surfaces

If you are creating or refactoring a reusable shared theme, also read:

- [Theme Authoring](./theme-authoring.md): the repo-wide standard for CSS themes and page templates

The rule of thumb is simple:
- `slides.md` contains the deck content plus file-level and page-level frontmatter
- `theme` in file-level frontmatter selects a shared CSS source from the built-in core theme library
- `slides.css` is an optional local override layer, not the main user authoring surface
- other files in the deck directory are ignored by local build input collection
- for most decks, `slides.md` plus `theme` is enough

## Example

See [examples/tokyo3days/slides.md](../examples/tokyo3days/slides.md) for a working example.
