---
name: markos-theme-check
description: Review a MarkOS shared theme against repo contracts for fixed page roles, class wiring, CSS layering, selector safety, fixture alignment, and scope boundaries. Use when Codex needs to validate or review files under `packages/core/themes/`, sanity-check a new theme before merge, or investigate whether a theme follows `docs/theme-authoring.md` and related docs.
---

# MarkOS Theme Check

## Overview

Review a MarkOS shared theme by comparing its CSS, fixtures, and example usage against the repo contract. Report concrete findings first, with file references, and prioritize broken wiring, missing fixed-role support, fixture drift, and boundary violations over style-only preferences.

## Read The Contract First

- Read `docs/theme-authoring.md` and `docs/developer-guide.md` before judging a theme.
- Use [references/theme-checklist.md](references/theme-checklist.md) as the condensed review rubric.
- Treat `docs/theme-authoring.md` as the public API. Treat `theme.css` as the implementation.

## Review Workflow

1. Identify the review scope: the theme folder, any touched examples, and any related docs changes.
2. Inspect `theme.css` for alignment with the documented contract instead of inventing missing rules from selectors.
3. Inspect theme fixtures for the supported Markdown shapes and density behavior.
4. Inspect example decks when they exist.
5. Report findings ordered by severity, with concrete file references and concise explanations.
6. If no findings remain, say so explicitly and call out residual risks such as missing example coverage or unverified rendering.

## What To Check

- fixed eight-page public inventory support
- all eight public page roles are implemented, with no optional omissions
- image support is limited to `body`, `two-column`, `image-text`, and `full-bleed-image`, while `title`, `toc`, `section-divider`, and `closing` remain text-only
- runtime wiring correctness for `cover`, `default`, and `two-cols`
- CSS layering, selector safety, and scope boundaries
- fixture alignment with the current contract
- AI-facing guidance such as content-fidelity rules and doc-first usage

## Reporting Rules

- Present findings first, ordered by severity.
- Focus on bugs, risky assumptions, missing contract details, stale examples, or hidden behavior.
- Use file references whenever possible.
- Treat extra public template names beyond the fixed eight as a bug.
- If a concern is only a soft recommendation, label it as such instead of overstating it.

## Verification

- Run targeted repo checks when helpful, such as `rg`, `find`, or `npm run check:examples`.
- Build a related example deck when a theme or example changed and the environment is available.
- Say what you did not verify.

## References

- [references/theme-checklist.md](references/theme-checklist.md): condensed theme review checklist
