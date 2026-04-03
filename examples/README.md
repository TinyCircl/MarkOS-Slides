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

The current example deck demonstrates the flat `slides.md` + `slides.css` convention.

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
