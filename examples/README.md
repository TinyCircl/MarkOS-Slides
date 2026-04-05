# Examples

This directory contains small runnable examples for the local-authoring workflow.

The recommended MarkOS layout is a flat deck directory anchored by `slides.md`:

```text
deck/
  slides.md
  slides.css        # optional
  overrides.css     # optional
```

## Example Decks

Each subdirectory in `examples/` that contains `slides.md` is treated as a runnable deck and is picked up automatically by `npm run check:examples`.

Examples should be:

- runnable from the repository root
- structurally correct for the current theme contract
- good references for authors and AI, not legacy leftovers

## `tokyo3days/`

The current example deck demonstrates a structure-first shared-theme workflow.

Its shared source theme lives at [theme.css](../packages/core/themes/Clay/theme.css). The deck references the theme through file-level frontmatter and focuses on slide structure in [slides.md](./tokyo3days/slides.md).

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

For deck Markdown authoring, see the [Syntax Guide](../docs/syntax.md). For reusable theme CSS contracts, see [Theme Authoring](../docs/theme-authoring.md).
