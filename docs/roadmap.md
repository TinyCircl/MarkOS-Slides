# Roadmap

This page captures the direction of the open-source repository, not every experiment around MarkOS.

## Near Term

- stabilize the public core API surface
- improve the local authoring experience for `build` and `dev`
- keep examples, tests, and docs aligned with the actual CLI behavior
- make the repository easier for external contributors to navigate

## Later

- improve the packaging and publishing story for the reusable core
- add richer authoring ergonomics within the web-first toolchain
- expand the set of example projects that exercise real local project layouts

## Not Planned Right Now

These may be discussed later, but they are not active goals for this repository today:
- `pdf` or `pptx` output
- a production `markos export` workflow
- hosted preview or publish services
- deployment or cloud automation inside this repository

## Proposing Larger Changes

If you want to push the project beyond the current web-first OSS scope, start with an issue or design note that explains:
- the user problem being solved
- the expected impact on packages, docs, and tests
- whether the change belongs in this repository or in a separate service or tooling layer

See [Project Scope](./scope.md) for the current boundary.
