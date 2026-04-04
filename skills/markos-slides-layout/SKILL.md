---
name: markos-slides-layout
description: Adapt existing prose or Markdown into MarkOS-Slides `slides.md` decks while preserving content fidelity and using theme README contracts to choose slide layouts, heading hierarchy, tables, and two-column structure. Use when Codex needs to reformat notes, outlines, itineraries, reports, or existing slide text for MarkOS-Slides without rewriting the substance.
---

# MarkOS Slides Layout

## Overview

Adapt source content into a cleaner MarkOS-Slides deck by changing structure, not substance. Preserve the source meaning and facts, then use slide boundaries, heading levels, lists, tables, and theme templates to make the deck fit the target theme.

## Use README Contracts

- Read `packages/core/themes/<Theme>/README.md` before editing.
- Treat the theme README as the source of truth for template names, expected content shapes, and wiring.
- Do not inspect `theme.css` to infer layout rules unless the user explicitly asks for CSS-level debugging.
- Infer the theme from file frontmatter first. If the deck has no `theme`, infer from nearby examples or ask only when the choice is ambiguous.
- Use [references/theme-readmes.md](references/theme-readmes.md) as a quick index, then read the live README in the repo you are editing.

## Content Fidelity Rules

- Preserve facts, names, dates, numbers, places, qualifiers, and intent.
- Preserve substantive ordering unless the user explicitly asks for a new sequence.
- Use hierarchy as the main adaptation tool: slide boundaries, `#`, `##`, paragraphs, lists, tables, blockquotes, and `::right::`.
- Allow light normalization of Markdown emphasis or punctuation only when needed to fit a template cleanly.
- Do not invent new claims, examples, summary points, or decorative filler.
- If a sentence feels too long for one block, split it across headings and supporting bullets only when the wording still stays faithful to the source.

## Map Content To Templates

- Use title or closing templates for short framing copy, hero titles, opening context, and final CTA pages.
- Use overview or summary templates when one side can hold a table, metric block, or summary structure and the other side can hold callouts or notes.
- Use balanced two-column templates for paired lists, day-part breakdowns, pros/cons, or left-right highlights.
- Use comparison or differentiation templates for table-plus-notes pages, narrative contrasts, or evidence summaries.
- Use feature or metrics templates for dense tables, capability matrices, or KPI-style content.
- Use roadmap or process templates when the source naturally supports an ordered sequence on one side plus short notes on the other.
- Use SWOT only when the source clearly provides four ordered buckets.

## Authoring Pattern

1. Snapshot the source text and decide what is immutable.
2. Split the source into slide-sized chunks without dropping content.
3. Choose the template whose README contract best matches each chunk.
4. Reshape only the Markdown structure: headings, bullets, tables, ordered lists, blockquotes, and two-column separators.
5. Add file-level and slide-level frontmatter only when the layout needs it.
6. Prefer one clear `#` title per slide and use `##` to create visual rhythm inside the slide.

## MarkOS Wiring

- Put deck-wide settings such as `theme` and `title` in the opening frontmatter block.
- For `cover` and `default` layouts, attach theme classes with `class`.
- For `two-cols`, attach outer theme classes with `layoutClass`.
- Split columns with `::right::`.
- Keep the Markdown surface simple and theme-friendly: headings, short paragraphs, lists, tables, and blockquotes.

## Verification

- Run `npm run markos:build -- <deck-dir>` when the repo is available.
- Check that every source fact still appears somewhere in the deck.
- Check that each chosen template matches the README contract.
- If the content and template are a slightly awkward fit, note the compromise instead of silently rewriting the source.
