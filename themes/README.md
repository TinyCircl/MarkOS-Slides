# Themes

This directory stores shared theme folders.

Each theme should live in its own directory such as:
- `Clay/theme.css`
- `Clay/README.md`

For the repo-wide standard on making reusable themes and page templates, see [docs/theme-authoring.md](../docs/theme-authoring.md).

Decks still render from their own local `slides.css`. To set a shared theme on a deck, run:

```bash
markos theme apply Clay examples/tokyo3days
```

That command writes `theme: "Clay"` into `examples/tokyo3days/slides.md`. At build time, MarkOS loads `themes/Clay/theme.css` first and then `examples/tokyo3days/slides.css` as local overrides.
