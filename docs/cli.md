# CLI Reference

MarkOS currently supports two local-authoring commands: `build` and `dev`.

MarkOS recommends a flat local deck layout:

```text
deck/
  slides.md
```

For normal authoring, a deck only needs `slides.md` plus a file-level `theme`.

When a deck file declares `theme: Clay` in its top-level frontmatter, MarkOS loads `themes/Clay/theme.css` as the shared theme entry. A sibling `slides.css` file is optional and acts as an advanced local override layer.

For deck authoring rules, see [Syntax Guide](./syntax.md).

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
class: slide-shell title-slide
---

# Hello MarkOS

## My first deck
'@ | Set-Content -LiteralPath playground\my-deck\slides.md -Encoding utf8
npm run markos:dev -- playground\my-deck --port 3030
npm run markos:build -- playground\my-deck
```

Default styling path:
- write Markdown in `slides.md`
- set `theme` in file-level frontmatter
- do not create `slides.css` unless you explicitly need local overrides

Important output note:
- the final CSS is currently bundled into `dist/index.html`
- MarkOS does not emit a separate CSS file inside `dist/`
- if an AI or advanced workflow edits the built styling today, it edits the generated `dist/index.html`, not a standalone `dist/*.css`

## Command Summary

- `markos build [deck] [--out-dir dir] [--work-dir dir] [--base /] [--project-root dir] [--title name]`
- `markos dev [deck] [--out-dir dir] [--work-dir dir] [--base /] [--host 127.0.0.1] [--port 3030] [--project-root dir] [--title name]`
- `markos theme apply <theme> [deck]`
- `markos export [deck]`

`markos export` is reserved for future non-web artifacts and currently exits with an error.

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
- loads `themes/<theme>/theme.css` when `theme` is declared in file-level frontmatter
- loads the sibling `slides.css` file as an optional local override layer when it exists
- ignores other files in the deck directory during build input collection
- removes the temporary work directory after the build completes

## `markos dev`

Build once, serve locally, and rebuild when deck files change.

Examples:

```bash
markos dev examples/tokyo3days
markos dev examples/tokyo3days --port 4000
markos dev examples/tokyo3days --base /deck/
```

Options:
- `deck`: deck directory. Default: the current directory
- `--out-dir`: dev output directory. Default: `.markos-dev/` next to the entry file
- `--work-dir`: work directory used during rebuilds. Default: `.markos-work/<out-dir-name>/` next to the entry file
- `--base`: local site base path. Default: `/`
- `--host`: dev server host. Default: `127.0.0.1`
- `--port`: dev server port. Default: `3030`. Use `0` to let the OS choose an available port
- `--project-root`: directory used to watch deck files. Default: the entry file directory
- `--title`: fallback document title when the source does not provide one

Behavior:
- performs an initial build before the server starts
- serves the generated output through the local manifest site server
- watches the project root recursively and rebuilds on file changes
- ignores the output and work directories while watching

## `markos theme apply`

Set a deck's file-level `theme` and keep `slides.css` as the local override layer.

Examples:

```bash
markos theme apply Clay examples/tokyo3days
markos theme apply Clay .
```

Behavior:
- verifies that `themes/<theme>/theme.css` exists
- writes `theme: <theme>` into the top-level frontmatter of `slides.md`
- creates `slides.css` only when the deck does not already have one
- keeps the runtime contract explicit: shared theme first, local deck overrides second

## Validation

Useful commands when changing the CLI or examples:

```bash
npm test
npm run check:examples
npm run check
```

## Scope Notes

The CLI is currently for local authoring and web output only. The recommended local convention is one Markdown file paired with one sibling CSS file. For repository boundaries and non-goals, see [Project Scope](./scope.md).
