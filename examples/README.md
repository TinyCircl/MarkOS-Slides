# Examples

This directory contains small runnable examples for the local-authoring workflow.

The recommended MarkOS layout is a flat pair of sibling files:

```text
deck/
  slides.md
  slides.css
```

## Example Decks

Each subdirectory in `examples/` that contains `slides.md` and `slides.css` is treated as a runnable deck and is picked up automatically by `npm run check:examples`.

## `tokyo3days/`

The current example deck demonstrates the file-frontmatter-plus-overrides convention.

Its shared source theme lives at [Clay.css](C:/Users/xuao5/Desktop/MarkOS-Slides/themes/Clay.css). The deck references it through file-level frontmatter and keeps [slides.css](C:/Users/xuao5/Desktop/MarkOS-Slides/examples/tokyo3days/slides.css) as local overrides.

You can still set the theme field with:

```bash
npm run markos:theme -- apply Clay examples/tokyo3days
```

Build it from the repository root:

```bash
npm run markos:build -- examples/tokyo3days
```

Preview it locally:

```bash
npm run markos:dev -- examples/tokyo3days --port 3030
```

For general setup and repository-wide docs, start from the [root README](../README.md).

For deck syntax and the recommended CSS architecture, see the [Syntax Guide](../docs/syntax.md).
