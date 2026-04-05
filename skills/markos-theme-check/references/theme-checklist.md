# Theme Check Checklist

Use this file as a condensed review rubric. If anything here conflicts with the live repo docs, follow the live docs.

## Read Order

1. `docs/theme-authoring.md`
2. `docs/developer-guide.md`
3. `packages/core/themes/<Theme>/fixtures/*.md`
4. `packages/core/themes/<Theme>/theme.css`
5. related examples or changed decks

## Required Theme Surface

- Theme lives under `packages/core/themes/<Theme>/`
- `theme.css` exists
- fixtures exist for all eight required page roles
- only `body`, `two-column`, `image-text`, and `full-bleed-image` accept Markdown images
- `title`, `toc`, `section-divider`, and `closing` filter images instead of rendering them
- The theme is reviewable without reverse-engineering CSS alone

## Runtime And Wiring

Check that fixtures and CSS respect the renderer contract:

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
- page-type classes using the fixed suffix-free public names
- template blocks matching the fixed eight-page public inventory
- no missing implementation for any of the eight required page roles

## Selector Safety

Prefer:

- `.title h1`
- `.two-column table`
- `.slide-shell blockquote`

Be careful with:

- `:nth-of-type(...)`
- `> p:first-child`
- `> p:last-of-type`
- deep descendant chains

Ordering-based selectors are acceptable only when comments or fixtures document the assumption.

## Boundaries And Philosophy

Check that the theme follows the repo philosophy:

- `docs/theme-authoring.md` defines the contract, CSS implements it
- theme personality is allowed, but extra public page names are not
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
rg -n 'title|toc|section-divider|body|two-column|image-text|full-bleed-image|closing' packages/core/themes/<Theme>
npm run check:examples
```

If a theme changed in a way that affects example rendering, build a related deck when practical.

## Reporting

- Put findings first.
- Cite files precisely.
- Distinguish hard problems from softer suggestions.
- If no findings are discovered, say that explicitly and mention residual risks or testing gaps.
