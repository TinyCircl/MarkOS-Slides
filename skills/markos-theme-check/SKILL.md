---
name: markos-theme-check
description: Review a MarkOS shared theme against repo contracts for theme README structure, template specs, class wiring, CSS layering, selector safety, example alignment, and scope boundaries. Use when Codex needs to validate or review files under `packages/core/themes/`, sanity-check a new theme before merge, update a theme README, or investigate whether a theme follows `docs/theme-authoring.md` and related docs.
---

# MarkOS Theme Check

## Overview

Review a MarkOS shared theme by comparing its README, CSS, and example usage against the repo contract. Report concrete findings first, with file references, and prioritize broken wiring, missing public contract information, example drift, and boundary violations over style-only preferences.

## Read The Contract First

- Read `docs/theme-authoring.md` and `docs/developer-guide.md` before judging a theme.
- Read the theme's live `README.md` before `theme.css`.
- Use [references/theme-checklist.md](references/theme-checklist.md) as the condensed review rubric.
- Treat the theme README as the public API for humans and AI. Treat `theme.css` as the implementation.

## Review Workflow

1. Identify the review scope: the theme folder, any touched examples, and any related docs changes.
2. Inspect the theme `README.md` for required sections, template contracts, wiring, and content-fidelity guidance.
3. Inspect `theme.css` for alignment with the documented contract instead of inferring missing rules from selectors.
4. Inspect example decks or README examples when they exist.
5. Report findings ordered by severity, with concrete file references and concise explanations.
6. If no findings remain, say so explicitly and call out residual risks such as missing example coverage or unverified rendering.

## What To Check

- README contract completeness and clarity
- runtime wiring correctness for `cover`, `default`, and `two-cols`
- CSS layering, selector safety, and scope boundaries
- template naming clarity without forcing unnecessary uniformity
- example alignment with the current contract
- AI-facing guidance such as content-fidelity rules and README-first usage

## Reporting Rules

- Present findings first, ordered by severity.
- Focus on bugs, risky assumptions, missing contract details, stale examples, or hidden behavior.
- Use file references whenever possible.
- Do not treat non-canonical template names as a bug when the README clearly explains role, Markdown shape, and wiring.
- If a concern is only a soft recommendation, label it as such instead of overstating it.

## Verification

- Run targeted repo checks when helpful, such as `rg`, `find`, or `npm run check:examples`.
- Build a related example deck when a theme or example changed and the environment is available.
- Say what you did not verify.

## References

- [references/theme-checklist.md](references/theme-checklist.md): condensed theme review checklist
