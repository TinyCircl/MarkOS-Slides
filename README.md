# MarkOS

MarkOS is an open-source Markdown-to-slides toolchain focused on local authoring and static web output.

This repository currently contains:
- a reusable build core in `packages/core`
- a local CLI for building and previewing slide projects in `packages/cli`

Hosted services, deployment pipelines, and other internal tooling are intentionally out of scope for this repository. See [Project Scope](docs/scope.md).

## Current Status

MarkOS currently supports:
- `markos build`
- `markos dev`
- web output
- a flat local deck layout with one Markdown file and one sibling CSS file

MarkOS does not currently support:
- `pdf`
- `pptx`
- a production `markos export` workflow

## Quick Start

Requirements:
- Node.js `>=22`

Install dependencies:

```bash
npm install
```

Build the example deck:

```bash
npm run markos:build -- examples/tokyo3days
```

This writes a static site to `examples/tokyo3days/dist`.

Run the example deck in dev mode:

```bash
npm run markos:dev -- examples/tokyo3days --port 3030
```

Apply the shared Clay theme into the example deck:

```bash
npm run markos:theme -- apply Clay examples/tokyo3days
```

Run the full check suite:

```bash
npm run check
```

For local scratch decks, use `playground/`. It is ignored by Git in this repository.

## Examples

- [examples/tokyo3days](examples/tokyo3days): the current runnable deck example

## Repository Layout

- `packages/core`: reusable build core, engines, config, and built-in assets
- `packages/cli`: local authoring CLI
- `src/`: compatibility entry points that re-export the workspace packages
- `examples/`: runnable example slide projects
- `themes/`: shared theme source files that can be applied into a deck
- `test/`: automated coverage for CLI, config, and render flows

## Documentation

Start here:
- [CLI Reference](docs/cli.md)
- [Syntax Guide](docs/syntax.md)
- [Architecture Overview](docs/architecture.md)
- [Project Scope](docs/scope.md)

Contributor and maintenance docs:
- [Contributing](CONTRIBUTING.md)
- [Documentation Index](docs/README.md)
- [Roadmap](docs/roadmap.md)
- [Release Checklist](docs/release.md)
- [Commit Convention](docs/COMMIT_CONVENTION.md)
- [Security Policy](SECURITY.md)
- [Code of Conduct](CODE_OF_CONDUCT.md)
