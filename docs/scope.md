# Project Scope

This repository is the open-source toolchain for building web slide sites from Markdown and local project assets.

## In Scope

- reusable slide build logic in `packages/core`
- the local authoring CLI in `packages/cli`
- examples, tests, and docs needed to use and validate the OSS toolchain
- built-in assets and render-engine code required for web output

## Current Product Boundary

Today, the supported path is:
- `markos build`
- `markos dev`
- web output only

The following are intentionally not part of the current OSS surface:
- `pdf` or `pptx` output
- a production `markos export` workflow
- hosted preview, publish, or artifact management flows
- HTTP or gRPC service adapters
- deployment automation, cloud setup, or internal bootstrap tooling

## Relationship to Internal Repositories

MarkOS started as part of a larger mixed tool-and-service codebase. This repository keeps the reusable build and local authoring layers. Service-side workflows and company-specific operations live outside this repository.

## When To Open a Discussion First

Open an issue or design note before implementing changes that:
- expand output formats beyond web
- introduce hosted or service-side workflows
- add a plugin or theme marketplace, or other large product surfaces
- reshape the repository split or package boundaries
