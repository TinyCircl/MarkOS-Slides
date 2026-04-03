---
title: MarkOS Project Example
layout: cover
class: slide-shell title-slide
---

# Flat Pair Authoring

## One markdown file. One sibling css file.

---
layout: two-cols
layoutClass: slide-shell syntax-slide
---

## Markdown Rules

- `slides.md`
- `slides.css`
- every page can have its own frontmatter

::right::

## CSS Rules

- tokens live in `:root`
- base shell lives in `.slide-shell`
- page types live in layout classes

---
layout: two-cols
layoutClass: slide-shell pricing-slide
---

## CSS Layering

- design tokens
- base shell
- page types
- contextual element styling

::right::

## Selector Hooks

- `.title-slide h1`
- `.pricing-slide .col-left h2`
- `.pricing-slide .col-right ul`
