# Contributing

Thanks for helping with MarkOS.

## Before You Start

MarkOS is currently an open-source repository for:
- the reusable build core
- the local authoring CLI
- examples, tests, and docs for the web-first toolchain

If your change expands the repository beyond that scope, read [Project Scope](docs/scope.md) first and consider opening an issue before implementing it.

## Local Development

Requirements:
- Node.js `>=22`

Install dependencies:

```bash
npm install
```

Useful commands:

```bash
npm test
npm run check:fixtures
npm run check:examples
npm run check
```

Try the local CLI:

```bash
npm run markos:build -- examples/basic/slides.md
npm run markos:dev -- examples/project/slides.md --port 3030
```

## Code Layout

Put changes in the narrowest layer that owns the behavior:
- `packages/core/src`: build pipeline, input normalization, engines, manifest site integration, and shared config
- `packages/core/assets`: built-in static assets
- `packages/core/styles/presets`: built-in preset styles
- `packages/cli/src`: local authoring CLI behavior
- `src/`: compatibility entry points that re-export workspace packages

## Pull Requests

Before opening a PR, run at least:

```bash
npm test
npm run check:examples
```

Also run this when you change fixtures, markdown normalization, path handling, or other source parsing logic:

```bash
npm run check:fixtures
```

Keep pull requests focused. If a change affects scope, architecture, or output formats, explain the tradeoffs clearly in the PR description or an issue.

## Commit Messages

Follow the format in [docs/COMMIT_CONVENTION.md](docs/COMMIT_CONVENTION.md).

## Large Changes

Please start with an issue or design note before working on:
- non-web outputs such as `pdf` or `pptx`
- a production `markos export` workflow
- hosted preview, publish, or service-side flows
- plugin or theme marketplaces, or other large product surfaces
- major repository split or package-boundary changes

Those topics are intentionally outside the current day-to-day OSS surface. See [Project Scope](docs/scope.md).
