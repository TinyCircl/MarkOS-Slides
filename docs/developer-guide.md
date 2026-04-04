# Developer Guide

This guide is for contributors and maintainers working on the MarkOS repository itself.

Use it for repository layout, build flow, scope, roadmap, and release decisions.

## Development Principles

These principles guide authoring, theme design, examples, and validation across the repository.

### Content First

- Preserve source meaning before optimizing presentation.
- Treat Markdown structure as the primary adaptation tool: slide boundaries, headings, lists, tables, blockquotes, and two-column splits.
- Prefer structural reshaping over rewriting substance.
- Keep factual content, ordering, and intent stable unless the user explicitly asks for a content edit.

### Docs Define The Contract

- Repository docs define the public authoring rules.
- Skills should consume and apply those rules, not invent parallel rulesets.
- Theme `README.md` files are the public contract for humans and AI.
- `theme.css` implements the contract; it should not be the first place authors need to read.

### Theme Flexibility Over Forced Uniformity

- Themes should share a common documentation format, not a forced identical template inventory.
- Canonical template names are useful as a shared vocabulary, but strict naming uniformity is less important than clear README contracts.
- If a theme uses a distinct template name, document the role and Markdown shape clearly.
- Let themes keep visual and authoring personality as long as the public contract stays understandable.

### Structure Over Mandatory Shared CSS APIs

- The most important standardization target is structure: layout choice, attach point, expected Markdown shape, and slide role.
- Users may write deck-local CSS when needed.
- Shared themes should provide strong structure and sensible defaults, but they do not need to eliminate local styling completely.

### Local Override Boundaries

- Shared theme CSS loads first.
- `slides.css` is the deck-local author override layer.
- `overrides.css` is the final incremental override layer intended for later AI or renderer-driven adjustments.
- Avoid teaching users to treat `overrides.css` as the main authoring surface.

### Examples Are Product Surface

- Example decks should be runnable, structurally correct, and aligned with the current theme contract.
- Examples should demonstrate the intended authoring shape, not accidental legacy structure.
- If docs and examples disagree, fix the example.

### Validation Matters

- Prefer contracts that can be checked through docs, examples, and build/test workflows.
- Theme work should be reviewable with a checklist, not hidden assumptions.
- A dedicated validation skill or check tool is acceptable when it reinforces the documented contract.

### Keep The System Lightweight

- Do not require machine-only metadata just to make themes usable.
- Prompt-first and doc-first workflows should remain first-class.
- Add extra configuration only when the docs and examples are not enough.

## Repository Layout

- `packages/core/src`: input normalization, build pipeline, engine wiring, manifest site integration, and shared config
- `packages/core/assets`: built-in static assets shipped with the core
- `packages/cli/src`: command parsing and local authoring workflow for `markos build` and `markos dev`
- `src/`: compatibility entry points that re-export the workspace packages
- `examples/`: runnable example projects
- `packages/core/themes/`: built-in shared theme source files bundled with the core package
- `test/`: CLI, config, local project, and render-engine tests

## Build Flow

1. The CLI parses arguments and resolves the entry, output, and work directories.
2. MarkOS reads the local deck files and normalizes them into a consistent source input.
3. The core prepares a work directory and build output.
4. The `markos-web` engine renders a static web slide site and bundles local CSS layers in order: built-in theme, sibling `slides.css`, then optional `overrides.css`.
5. In `dev` mode, a local manifest site server serves the generated output and rebuilds on file changes.

## Scope And Boundaries

This repository is the open-source toolchain for building web slide sites from Markdown and local project assets.

In scope:

- reusable slide build logic in `packages/core`
- the local authoring CLI in `packages/cli`
- examples, tests, and docs needed to use and validate the OSS toolchain
- built-in assets and render-engine code required for web output

Current product boundary:

- `markos build`
- `markos dev`
- web output only

Not part of the current OSS surface:

- `pdf` or `pptx` output
- a production `markos export` workflow
- hosted preview, publish, or artifact management flows
- HTTP or gRPC service adapters
- deployment automation, cloud setup, or internal bootstrap tooling

The current architecture is optimized for local authoring and static web output, not hosted services.

Open an issue or design note before implementing changes that:

- expand output formats beyond web
- introduce hosted or service-side workflows
- add a plugin or theme marketplace, or other large product surfaces
- reshape the repository split or package boundaries

## Current Priorities

Near term:

- stabilize the public core API surface
- improve the local authoring experience for `build` and `dev`
- keep examples, tests, and docs aligned with the actual CLI behavior
- make the repository easier for external contributors to navigate

Later:

- improve the packaging and publishing story for the reusable core
- add richer authoring ergonomics within the web-first toolchain
- expand the set of example projects that exercise real local project layouts

Not planned right now:

- `pdf` or `pptx` output
- a production `markos export` workflow
- hosted preview or publish services
- deployment or cloud automation inside this repository

If you want to push the project beyond the current web-first OSS scope, start with an issue or design note that explains:

- the user problem being solved
- the expected impact on packages, docs, and tests
- whether the change belongs in this repository or in a separate service or tooling layer

## Release Checklist

Product and scope:

- confirm the root README reflects the current OSS surface
- confirm this guide matches the actual code and docs
- confirm unsupported features are described consistently across docs

Docs and examples:

- confirm [CLI Reference](./cli.md) matches current command behavior and defaults
- confirm the repository layout and build flow in this guide still reflect the codebase
- confirm `examples/` can be run from the repo root as documented
- confirm contributor docs point people to the right entry points

Quality:

- run `npm test`
- run `npm run check:fixtures`
- run `npm run check:examples`
- run `npm run check`

Release decisions:

- confirm package names and branding are ready for publication
- confirm which packages, if any, should be published to npm
- confirm repository policy docs and licensing are ready for external users

## Related Docs

- [Commit Convention](./COMMIT_CONVENTION.md): commit message format
- [Theme Authoring](./theme-authoring.md): reusable theme and template contract
