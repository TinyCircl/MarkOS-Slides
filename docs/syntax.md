# Syntax Guide

MarkOS recommends a flat local deck layout:

```text
deck/
  slides.md
```

Use these two documents together:

- [Markdown Syntax](./syntax-markdown.md): deck file rules, frontmatter, slide boundaries, and `two-cols` usage
- [CSS Rules](./syntax-css.md): single-entry CSS rules, class wiring, and the recommended slide styling architecture

The rule of thumb is simple:
- `slides.md` contains the deck content plus file-level and page-level frontmatter
- `theme` in file-level frontmatter selects a shared CSS source from the built-in core theme library
- `slides.css` is an optional local override layer for that deck
- other files in the deck directory are ignored by local build input collection
- for most decks, `slides.md` plus `theme` is enough
