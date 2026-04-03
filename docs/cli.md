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

- `markos build [entry] [--out-dir dir] [--work-dir dir] [--base /] [--project-root dir] [--title name]`
- `markos dev [entry] [--out-dir dir] [--work-dir dir] [--base /] [--host 127.0.0.1] [--port 3030] [--project-root dir] [--title name]`
- `markos export [entry]`

`markos export` is reserved for future non-web artifacts and currently exits with an error.

## `markos build`

Build a local slide deck into a static site.

Examples:

```bash
markos build examples/basic/slides.md
markos build examples/project/slides.md --out-dir build/site
markos build talks/intro.md --project-root talks --title "Intro Talk"
```

Options:
- `entry`: entry Markdown file. Default: `slides.md`
- `--out-dir`: output directory. Default: `dist/` next to the entry file
- `--work-dir`: work directory used during the build. Default: `.markos-work/<out-dir-name>/` next to the entry file
- `--base`: site base path. Default: `/`
- `--project-root`: directory containing the deck files. Default: the entry file directory
- `--title`: fallback document title when the source does not provide one

Behavior:
- reads the entry Markdown file and bundles a sibling CSS file with the same basename when present
- removes the temporary work directory after the build completes

## `markos dev`

Build once, serve locally, and rebuild when deck files change.

Examples:

```bash
markos dev examples/project/slides.md
markos dev examples/project/slides.md --port 4000
markos dev examples/project/slides.md --base /deck/
```

Options:
- `entry`: entry Markdown file. Default: `slides.md`
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
