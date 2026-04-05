# CLI Reference

MarkOS currently supports local-authoring commands for decks and for theme fixture preview.

MarkOS recommends a flat local deck layout:

```text
deck/
  slides.md
```

For normal authoring, a deck only needs `slides.md` plus a file-level `theme`.

When a deck file declares `theme: Clay` in its top-level frontmatter, MarkOS loads the built-in theme entry at `packages/core/themes/Clay/theme.css`. The `theme` value is the theme folder name, not a file name. A sibling `slides.css` file is optional and acts as the primary local override layer, and an optional `overrides.css` file can add a final incremental override layer after that.

For deck Markdown authoring rules, see [Syntax Guide](./syntax.md).

## TL;DR

PowerShell on Windows:

The recommended local scratch area is `playground/`, which is ignored by Git in this repository.

```powershell
npm install
New-Item -ItemType Directory -Path playground\my-deck -Force | Out-Null
@'
---
theme: Clay
title: My first deck
---

---
layout: cover
class: slide-shell title
---

# Hello MarkOS

## My first deck
'@ | Set-Content -LiteralPath playground\my-deck\slides.md -Encoding utf8
npm run markos:dev -- playground\my-deck --port 3030
npm run markos:build -- playground\my-deck
```

macOS with zsh:

Use `/` in deck paths on macOS shells such as `zsh`. A path like
`playground\my-deck` is parsed as `playgroundmy-deck`, so MarkOS will not find
the deck directory.

```bash
npm install
mkdir -p playground/my-deck
cat > playground/my-deck/slides.md <<'EOF'
---
theme: Clay
title: My first deck
---

---
layout: cover
class: slide-shell title
---

# Hello MarkOS

## My first deck
EOF
npm run markos:dev -- playground/my-deck --port 3030
npm run markos:build -- playground/my-deck
```

Default styling path:
- write Markdown in `slides.md`
- set `theme` in file-level frontmatter using the theme folder name such as `Clay`
- do not create `slides.css` unless you explicitly need local overrides
- use `overrides.css` only when you need a separate final override layer beyond `slides.css`

Important output note:
- the final CSS is currently bundled into `dist/index.html`
- MarkOS does not emit a separate CSS file inside `dist/`
- if an AI or advanced workflow edits the built styling today, it edits the generated `dist/index.html`, not a standalone `dist/*.css`

## Command Summary

- `markos build [deck] [--out-dir dir] [--work-dir dir] [--base /] [--project-root dir] [--title name]`
- `markos dev [deck] [--out-dir dir] [--work-dir dir] [--base /] [--host 127.0.0.1] [--port 3030] [--no-open] [--project-root dir] [--title name]`
- `markos theme apply <theme> [deck]`
- `markos theme preview <theme> <fixture> [--host 127.0.0.1] [--port 3030] [--no-open]`
- `markos export [deck] [--format pdf|pptx] [--out-dir dir] [--work-dir dir] [--project-root dir] [--title name] [--file-name name]`

`markos export` currently supports `pdf` and `pptx`.

`deck` must be a directory that contains `slides.md`.

## `markos build`

Build a local slide deck into a static site.

Examples:

```bash
markos build examples/tokyo3days
markos build examples/tokyo3days --out-dir build/site
markos build talks/intro --project-root talks --title "Intro Talk"
```

Options:
- `deck`: deck directory. Default: the current directory
- `--out-dir`: output directory. Default: `dist/` next to the entry file
- `--work-dir`: work directory used during the build. Default: `.markos-work/<out-dir-name>/` next to the entry file
- `--base`: site base path. Default: `/`
- `--project-root`: directory containing the deck files. Default: the entry file directory
- `--title`: fallback document title when the source does not provide one

Behavior:
- resolves `slides.md` from the given deck directory
- reads deck-level frontmatter from `slides.md`
- loads `packages/core/themes/<theme>/theme.css` when `theme` is declared in file-level frontmatter
- requires the `theme` value to be the theme folder name without a `.css` suffix
- loads the sibling `slides.css` file as an optional local override layer when it exists
- loads `overrides.css` after `slides.css` when it exists, so it can apply final incremental overrides
- ignores other files in the deck directory during build input collection
- removes the temporary work directory after the build completes

## `markos dev`

Build once, serve locally, and rebuild when deck files change.

Examples:

```bash
markos dev examples/tokyo3days
markos dev examples/tokyo3days --port 4000
markos dev examples/tokyo3days --no-open
markos dev examples/tokyo3days --base /deck/
```

Options:
- `deck`: deck directory. Default: the current directory
- `--out-dir`: dev output directory. Default: `.markos-dev/` next to the entry file
- `--work-dir`: work directory used during rebuilds. Default: `.markos-work/<out-dir-name>/` next to the entry file
- `--base`: local site base path. Default: `/`
- `--host`: dev server host. Default: `127.0.0.1`
- `--port`: dev server port. Default: `3030`. Use `0` to let the OS choose an available port
- `--no-open`: do not open the local dev URL in the system default browser after the server starts
- `--project-root`: directory used to watch deck files. Default: the entry file directory
- `--title`: fallback document title when the source does not provide one

Behavior:
- performs an initial build before the server starts
- serves the generated output through the local manifest site server
- opens the local dev URL in the system default browser by default
- watches the project root recursively and rebuilds on file changes

## `markos export`

Export a local deck into a file artifact.

Examples:

```bash
markos export examples/tokyo3days
markos export examples/tokyo3days --format pdf
markos export examples/tokyo3days --format pptx
markos export examples/tokyo3days --out-dir build/pdf --file-name tokyo-itinerary
```

Options:
- `deck`: deck directory. Default: the current directory
- `--format`: export format. Current supported values: `pdf`, `pptx`
- `--out-dir`: output directory. Default: `dist/` next to the entry file
- `--work-dir`: work directory used during export. Default: `.markos-work/<out-dir-name>/` next to the entry file
- `--project-root`: directory containing the deck files. Default: the entry file directory
- `--title`: fallback document title when the source does not provide one
- `--file-name`: output file name. The selected format suffix is added automatically when omitted

Behavior:
- resolves `slides.md` from the given deck directory
- reuses the same local project input collection as `markos build`
- renders through the real MarkOS export view so themes and deck-local CSS are preserved
- uses a local Chrome / Chromium executable for `pdf` printing and `pptx` DOM measurement
- honors `MARKOS_EXPORT_BROWSER` when you want to point MarkOS at a specific browser binary
- also accepts format-specific overrides such as `MARKOS_PDF_BROWSER` and `MARKOS_PPTX_BROWSER`
- removes the temporary work directory after the export completes
- ignores the output and work directories while watching

## `markos theme apply`

Set a deck's file-level `theme` and keep `slides.css` as the main local override layer.

Examples:

```bash
markos theme apply Clay examples/tokyo3days
markos theme apply Clay .
```

Behavior:
- verifies that `packages/core/themes/<theme>/theme.css` exists
- requires the requested theme name to be the folder name without a `.css` suffix
- writes `theme: <theme>` into the top-level frontmatter of `slides.md`
- creates `slides.css` only when the deck does not already have one
- keeps the runtime contract explicit: shared theme first, `slides.css` second, optional `overrides.css` last

## `markos theme preview`

Run a theme fixture through the real MarkOS dev pipeline.

Examples:

```bash
markos theme preview Cobalt image-text
markos theme preview Cobalt image-text --port 3030
npm run markos:theme-preview -- Cobalt image-text --port 3030
```

Behavior:
- verifies that `packages/core/themes/<theme>/theme.css` exists
- verifies that `packages/core/themes/<theme>/fixtures/<fixture>.md` exists
- copies the fixture into a temporary deck and renders it through the normal `markos dev` path
- opens the preview URL in the system browser by default
- watches the theme directory, so CSS and fixture edits rebuild the preview
- uses real Markdown rendering, so fixture preview is the primary theme validation surface

## Validation

Useful commands when changing the CLI or examples:

```bash
npm test
npm run check:examples
npm run check
```

## Scope Notes

The CLI is currently for local authoring, local export, and web output. The recommended local convention is one Markdown file with `slides.css` as the main local override layer and optional `overrides.css` as a final incremental override layer. For repository boundaries and non-goals, see the [Developer Guide](./developer-guide.md#scope-and-boundaries).
