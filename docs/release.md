# Release Checklist

This checklist is for maintainers preparing or polishing the open-source repository.

## Product and Scope

- confirm the root README reflects the current OSS surface
- confirm [Project Scope](./scope.md) matches the actual code and docs
- confirm unsupported features are described consistently across docs

## Docs and Examples

- confirm [CLI Reference](./cli.md) matches current command behavior and defaults
- confirm [Architecture Overview](./architecture.md) still reflects the repo layout
- confirm `examples/` can be run from the repo root as documented
- confirm contributor docs point people to the right entry points

## Quality

- run `npm test`
- run `npm run check:fixtures`
- run `npm run check:examples`
- run `npm run check`

## Release Decisions

- confirm package names and branding are ready for publication
- confirm which packages, if any, should be published to npm
- confirm `LICENSE`, `SECURITY.md`, and `CODE_OF_CONDUCT.md` are ready for external users
