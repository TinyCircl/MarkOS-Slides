# Cobalt

Cobalt is a cool analytic theme derived from the `cobalt` HTML mockups.

## Files

- `theme.css`: shared theme implementation
- `README.md`: theme manifest and authoring notes

## Shell

- `slide-shell`

## Implemented Templates

- `title-slide` (`cover`, `class`): opening title page with centered card composition
- `closing-slide` (`cover`, `class`): Q&A, thank-you, or contact closing page
- `summary-slide` (`two-cols`, `layoutClass`): executive summary with a visual placeholder on the left and insight cards on the right
- `overview-slide` (`two-cols`, `layoutClass`): project or market overview with metric-led blocks and a visual placeholder
- `comparison-slide` (`two-cols`, `layoutClass`): market landscape, evidence summary, or table-plus-notes comparison page
- `metrics-slide` (`two-cols`, `layoutClass`): KPI, scorecard, or chart-adjacent slide using metric cards and insight cards
- `process-slide` (`two-cols`, `layoutClass`): phased process or implementation methodology with numbered steps and notes

## Notes

- Use the theme name `Cobalt` in file-level frontmatter
- This theme is designed for Markdown only and does not depend on Chart.js or custom page scripts
- `metrics-slide` expects a metric-card list in the left column; inline code inside each item is styled as the headline value
- `process-slide` expects an ordered list in the left column; `strong` at the start of each item becomes the step title
- `summary-slide` and `comparison-slide` support a left-column `blockquote` as a visual placeholder

## Example Wiring

```md
---
layout: cover
class: slide-shell title-slide
---
```

```md
---
layout: cover
class: slide-shell closing-slide
---
```

```md
---
layout: two-cols
layoutClass: slide-shell metrics-slide
---
```

## Example Content Shapes

### `summary-slide`

```md
# Executive Summary

Short framing subtitle

> Visual placeholder or key summary graphic

::right::

## Core Objective
High-level summary of the presentation goal.

## Key Insight 1
First major finding or strategic pillar.
```

### `overview-slide`

```md
# Project Overview & Context

Short framing subtitle

## Market Context
### 27%
Explain the background and why this project matters.

## Growth Potential
### 3.2x
Describe the opportunity and growth drivers.

::right::

> Context graphic, value chain, or landscape placeholder

Source: internal strategy analysis
```

### `metrics-slide`

```md
# Strategic Goals and Objectives

Primary goals and milestones for the project

- **Market Share Target** `75%`
  Short note about the metric.
- **Efficiency Gain** `60%`
  Short note about the metric.
- **Customer Satisfaction** `90%`
  Short note about the metric.
- **Revenue Growth** `45%`
  Short note about the metric.

::right::

## Strategic Pillar 1
Describe the first strategic pillar.

## Strategic Pillar 2
Describe the second strategic pillar.
```

### `process-slide`

```md
# Implementation Process and Methodology

Structured approach to project execution and delivery

1. **Discovery & Audit**
   Assess the current state and business requirements.
2. **Strategy Design**
   Define the roadmap, stack, and success metrics.
3. **Development**
   Build iteratively with testing and feedback.
4. **Deployment**
   Roll out, train teams, and transition to operations.

::right::

## Agile Framework
Explain the operating model.

## Data Governance
Explain security and privacy expectations.
```
