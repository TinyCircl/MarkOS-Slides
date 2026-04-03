# Themes

This directory stores the built-in shared theme folders that ship with `@tinycircl/markos-slides-core`.

Each theme should live in its own directory such as:
- `Clay/theme.css`
- `Clay/README.md`
- `Cobalt/theme.css`
- `Cobalt/README.md`

For the repo-wide standard on making reusable themes and page templates, see [../../../docs/theme-authoring.md](../../../docs/theme-authoring.md).

Decks still render from their own local `slides.css`, and may optionally add `agent-overrides.css` as a final incremental override layer. To set a shared theme on a deck, run:

```bash
markos theme apply Clay examples/tokyo3days
```

That command writes `theme: "Clay"` into `examples/tokyo3days/slides.md`. At build time, MarkOS loads `packages/core/themes/Clay/theme.css` first, then `examples/tokyo3days/slides.css`, and finally `examples/tokyo3days/agent-overrides.css` when that extra file exists.
