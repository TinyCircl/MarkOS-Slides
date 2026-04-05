---
name: markos-slides-layout
description: Adapt existing prose or Markdown into MarkOS-Slides `slides.md` decks while preserving content fidelity and using the fixed eight-page MarkOS template contract to choose slide layouts, heading hierarchy, tables, and two-column structure. Use when Codex needs to reformat notes, outlines, itineraries, reports, or existing slide text for MarkOS-Slides without rewriting the substance.
---

# MarkOS Slides Layout

## Overview

Adapt source content into a cleaner MarkOS-Slides deck by changing structure, not substance. Preserve the source meaning and facts, then use slide boundaries, heading levels, lists, tables, and the fixed eight public page roles to make the deck fit the target theme.

## Use The Shared Template Contract

- Read `docs/theme-authoring.md` before editing.
- Treat the fixed public page inventory in `docs/theme-authoring.md` as the source of truth for template names.
- Do not inspect `theme.css` to infer layout rules unless the user explicitly asks for CSS-level debugging.
- Infer the theme from file frontmatter first. If the deck has no `theme`, infer from nearby examples or ask only when the choice is ambiguous.
- Use nearby theme fixtures when you need to see valid Markdown shape in practice.

## Content Fidelity Rules

- Preserve facts, names, dates, numbers, places, qualifiers, and intent.
- Preserve substantive ordering unless the user explicitly asks for a new sequence.
- Use hierarchy as the main adaptation tool: slide boundaries, `#`, `##`, paragraphs, lists, tables, blockquotes, and `::right::`.
- Allow light normalization of Markdown emphasis or punctuation only when needed to fit a template cleanly.
- Do not invent new claims, examples, summary points, or decorative filler.
- If a sentence feels too long for one block, split it across headings and supporting bullets only when the wording still stays faithful to the source.

## Map Content To Templates

- Use `title` for the opening slide: large title, subtitle, author, date, or short framing copy.
- Use `toc` for chapter navigation or a numbered agenda.
- Use `section-divider` for short transitions into a new chapter or phase.
- Use `body` for general single-column content: paragraphs, lists, code, tables, and image-supported content when a single-column image page still needs normal text flow.
- Use `two-column` for comparisons, paired notes, pros/cons, side-by-side structure, and image-supported two-column pages.
- Use `image-text` when one side should carry a Markdown image and the other side should carry explanatory copy.
- Use `full-bleed-image` when the page should be a single image that fills the whole slide.
- Use `closing` for thank-you pages, CTA pages, contact pages, or Q&A.

Only `body`, `two-column`, `image-text`, and `full-bleed-image` support Markdown images.
Do not place images in `title`, `toc`, `section-divider`, or `closing`; those templates are text-only and should filter images.

Use only these eight public template names. Do not invent additional public slide names in the deck.

## Authoring Pattern

1. Snapshot the source text and decide what is immutable.
2. Split the source into slide-sized chunks without dropping content.
3. Choose the page role from the fixed eight-name inventory that best matches each chunk.
4. Reshape only the Markdown structure: headings, bullets, tables, ordered lists, blockquotes, and two-column separators.
5. Add file-level and slide-level frontmatter only when the layout needs it.
6. Prefer one clear `#` title per slide and use `##` to create visual rhythm inside the slide.

## MarkOS Wiring

- Put deck-wide settings such as `theme` and `title` in the opening frontmatter block.
- For `cover` and `default` layouts, attach theme classes with `class`.
- For `two-cols`, attach outer theme classes with `layoutClass`.
- Split columns with `::right::`.
- Keep the Markdown surface simple and theme-friendly: headings, short paragraphs, lists, tables, and blockquotes.
- Use only the fixed public page names:
  - `title`
  - `toc`
  - `section-divider`
  - `body`
  - `two-column`
  - `image-text`
  - `full-bleed-image`
  - `closing`

## Verification

- Run `npm run markos:build -- <deck-dir>` when the repo is available.
- Check that every source fact still appears somewhere in the deck.
- Check that each chosen template name is one of the fixed eight public names.
- If the content and template are a slightly awkward fit, note the compromise instead of silently rewriting the source.
