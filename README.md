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
- single-file decks and multi-file local projects

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

Build the basic example:

```bash
npm run markos:build -- examples/basic/slides.md
```

This writes a static site to `examples/basic/dist`.

Run the project example in dev mode:

```bash
npm run markos:dev -- examples/project/slides.md --port 3030
```

Run the full check suite:

```bash
npm run check
```

## Examples

- [examples/basic](examples/basic): the smallest single-file deck
- [examples/project](examples/project): a project-style deck with local `styles/` and `assets/`

## Repository Layout

- `packages/core`: reusable build core, engines, config, and built-in assets
- `packages/cli`: local authoring CLI
- `src/`: compatibility entry points that re-export the workspace packages
- `examples/`: runnable example slide projects
- `test/`: automated coverage for CLI, config, and render flows

## Documentation

Start here:
- [CLI Reference](docs/cli.md)
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
