# Theme Check Checklist

Use this file as a condensed review rubric. If anything here conflicts with the live repo docs, follow the live docs.

## Read Order

1. `docs/theme-authoring.md`
2. `docs/developer-guide.md`
3. `packages/core/themes/<Theme>/README.md`
4. `packages/core/themes/<Theme>/theme.css`
5. related examples or changed decks

## Required Theme Surface

- Theme lives under `packages/core/themes/<Theme>/`
- `README.md` exists
- `theme.css` exists
- The theme is reviewable without reverse-engineering CSS alone

## README Contract

Check that the README clearly covers:

- `Theme Summary`
- `Authoring Rules`
- `Template Catalog`
- `Template Selection Guide`
- `Content Fidelity Guidance`
- `Examples`

Check that template entries describe:

- template name
- layout
- attach point
- purpose
- best fit
- avoid-when guidance when needed
- expected Markdown shape
- wiring
- notes for strict ordering or unusual assumptions

The README should answer three practical questions:

1. Which template should I pick?
2. What Markdown shape should I feed it?
3. What content changes are allowed during adaptation?

## Runtime And Wiring

Check that the README and CSS respect the renderer contract:

- theme name matches the theme folder name
- `cover` and `default` templates attach classes with `class`
- `two-cols` templates attach outer classes with `layoutClass`
- pane-level repeated classes, if any, use `class`
- `slide-shell` acts as the shared outer wrapper unless the theme intentionally documents otherwise

## CSS Structure

Preferred organization:

1. `:root` design tokens
2. `.slidev-layout` base typography
3. `.slide-shell` shared shell
4. shared layout helpers
5. optional shared template-family helpers
6. concrete template blocks
7. export or responsive fixes

Check for:

- tokens centralized in `:root`
- contextual styling scoped to shell or template classes
- page-type classes ending in `-slide`
- template blocks matching what the README claims to expose

## Selector Safety

Prefer:

- `.title-slide h1`
- `.comparison-slide table`
- `.slide-shell blockquote`

Be careful with:

- `:nth-of-type(...)`
- `> p:first-child`
- `> p:last-of-type`
- deep descendant chains

Ordering-based selectors are acceptable only when the README or comments document the assumption.

## Boundaries And Philosophy

Check that the theme follows the repo philosophy:

- README defines the contract, CSS implements it
- theme personality is allowed; rigid naming uniformity is not required
- non-canonical names are acceptable when the README makes role, shape, and wiring obvious
- shared theme CSS is not treated as a place for page-level JavaScript or external framework assumptions
- `slides.css` remains the deck-local override layer
- `overrides.css` remains the final AI or renderer adjustment layer

## Examples And Validation

Check that examples are:

- runnable from the repo root when present
- structurally aligned with the current theme contract
- good references rather than stale legacy leftovers

Useful verification commands:

```bash
rg --files packages/core/themes
rg -n '^## |^### ' packages/core/themes/<Theme>/README.md
npm run check:examples
```

If a theme changed in a way that affects example rendering, build a related deck when practical.

## Reporting

- Put findings first.
- Cite files precisely.
- Distinguish hard problems from softer suggestions.
- If no findings are discovered, say that explicitly and mention residual risks or testing gaps.
