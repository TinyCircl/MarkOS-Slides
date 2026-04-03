# CLI Reference

MarkOS currently supports two local-authoring commands: `build` and `dev`.

MarkOS recommends a flat local deck layout:

```text
deck/
  slides.md
  slides.css
```

When the entry file is `slides.md`, MarkOS will automatically bundle a sibling `slides.css` file if it exists. It does not auto-load `styles/index.css` or theme preset CSS.

For deck authoring rules, see [Syntax Guide](./syntax.md).

## Command Summary

- `markos build [deck] [--out-dir dir] [--work-dir dir] [--base /] [--project-root dir] [--title name]`
- `markos dev [deck] [--out-dir dir] [--work-dir dir] [--base /] [--host 127.0.0.1] [--port 3030] [--project-root dir] [--title name]`
- `markos export [deck]`

`markos export` is reserved for future non-web artifacts and currently exits with an error.

`deck` must be a directory that contains `slides.md`.

## `markos build`

Build a local slide deck into a static site.

Examples:

```bash
markos build examples/basic
markos build examples/project --out-dir build/site
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
- reads only `slides.md` and the sibling `slides.css` file when it exists
- ignores other files in the deck directory during build input collection
- removes the temporary work directory after the build completes

## `markos dev`

Build once, serve locally, and rebuild when deck files change.

Examples:

```bash
markos dev examples/project
markos dev examples/project --port 4000
markos dev examples/project --base /deck/
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

## Validation

Useful commands when changing the CLI or examples:

```bash
npm test
npm run check:examples
npm run check
```

## Scope Notes

The CLI is currently for local authoring and web output only. The recommended local convention is one Markdown file paired with one sibling CSS file. For repository boundaries and non-goals, see [Project Scope](./scope.md).
