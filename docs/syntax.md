# Syntax Guide

MarkOS recommends a flat local deck layout:

```text
deck/
  slides.md
  slides.css
```

Use these two documents together:

- [Markdown Syntax](./syntax-markdown.md): deck file rules, frontmatter, slide boundaries, and `two-cols` usage
- [CSS Rules](./syntax-css.md): single-entry CSS rules, class wiring, and the recommended slide styling architecture

The rule of thumb is simple:
- `slides.md` is the only content entry
- `slides.css` is the only custom style entry
- the two files should stay side by side and share the same basename
