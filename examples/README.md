# Examples

This directory contains small runnable examples for the local-authoring workflow.

## `basic/`

A minimal single-file deck with `slides.md` as the only source file.

Build it from the repository root:

```bash
npm run markos:build -- examples/basic/slides.md
```

## `project/`

A project-style deck that includes local `styles/` and `assets/` folders.

Build it:

```bash
npm run markos:build -- examples/project/slides.md
```

Preview it locally:

```bash
npm run markos:dev -- examples/project/slides.md --port 3030
```

For general setup and repository-wide docs, start from the [root README](../README.md).
