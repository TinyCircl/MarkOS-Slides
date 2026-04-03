# Themes

This directory stores shared theme source files.

Each file in `themes/` is a reusable CSS source such as:
- `Clay.css`

Decks still render from their own local `slides.css`. To set a shared theme on a deck, run:

```bash
markos theme apply Clay examples/tokyo3days
```

That command writes `theme: "Clay"` into `examples/tokyo3days/slides.md`. At build time, MarkOS loads `themes/Clay.css` first and then `examples/tokyo3days/slides.css` as local overrides.
