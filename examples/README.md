# Examples

This directory contains small runnable examples for the local-authoring workflow.

The recommended MarkOS layout is a flat pair of sibling files:

```text
deck/
  slides.md
  slides.css
```

## `basic/`

A minimal flat pair with `slides.md` and `slides.css`.

Build it from the repository root:

```bash
npm run markos:build -- examples/basic/slides.md
```

## `project/`

A slightly richer flat pair that keeps the same `slides.md` + `slides.css` shape.

Build it:

```bash
npm run markos:build -- examples/project/slides.md
```

Preview it locally:

```bash
npm run markos:dev -- examples/project/slides.md --port 3030
```

For general setup and repository-wide docs, start from the [root README](../README.md).

For deck syntax and the recommended CSS architecture, see the [Syntax Guide](../docs/syntax.md).
