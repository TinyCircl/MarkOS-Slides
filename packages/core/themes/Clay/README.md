# Clay

Clay is a warm editorial shared theme for structured Markdown slides.

## Files

- `theme.css`: shared theme implementation
- `README.md`: theme manifest and authoring notes

## Shell

- `slide-shell`

## Implemented Templates

- `title-slide`: opening cover or title-led closing page
- `overview-slide`: mixed summary with table and supporting notes
- `competitors-slide`: narrative comparison with bullets
- `feature-slide`: full-width feature or capability matrix
- `pricing-slide`: side-by-side package or plan comparison
- `positioning-slide`: positioning matrix with supporting notes
- `strengths-slide`: balanced two-column strengths or highlights
- `differentiation-slide`: differentiation summary with table and talking points
- `swot-slide`: SWOT-style paired analysis
- `roadmap-slide`: staged roadmap or next-steps plan

## Notes

- `title-slide` uses positional paragraph styling for the first and last paragraph
- `swot-slide` uses order-based selectors to map the four SWOT sections
- `pricing-slide` gives special treatment to `h2 + ul`

## Example Wiring

```md
---
layout: cover
class: slide-shell title-slide
---
```

```md
---
layout: two-cols
layoutClass: slide-shell roadmap-slide
---
```
