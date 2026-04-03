# Architecture Overview

MarkOS is organized as a small workspace with a reusable core and a thin local CLI.

## Repository Layout

- `packages/core/src`: input normalization, build pipeline, engine wiring, manifest site integration, and shared config
- `packages/core/assets`: built-in static assets shipped with the core
- `packages/core/styles/presets`: built-in style presets
- `packages/cli/src`: command parsing and local authoring workflow for `markos build` and `markos dev`
- `src/`: compatibility entry points that re-export the workspace packages
- `examples/`: runnable example projects
- `test/`: CLI, config, local project, and render-engine tests

## Build Flow

1. The CLI parses arguments and resolves the entry, output, and work directories.
2. MarkOS reads the local project and normalizes it into a consistent source input.
3. The core prepares a work directory and build output.
4. The `markos-web` engine renders a static web slide site.
5. In `dev` mode, a local manifest site server serves the generated output and rebuilds on file changes.

## Design Notes

- The CLI is intentionally thin; most reusable behavior lives in `packages/core`.
- Local authoring ignores generated output and work directories during rebuilds.
- Root-level `src/*` files exist as compatibility entry points, not as a second implementation.
- The current architecture is optimized for local authoring and static web output, not hosted services. See [Project Scope](./scope.md).
