# 0012: Mobile layout for many-column choice_tables

Date: 2026-07-18
Status: accepted

Issues: #15

## Context

Below 640px every table row is stacked as a card with all choices listed
vertically (`@media (max-width: 640px)` block in `src/generate/styles.ts`).
For few-column tables (rubrics) this reads well, but a 10-choice × 8-row
choice_table becomes an 80-item radio list — the page gets extremely long and
the scale loses its shape. Issue #15 lists three candidates:

1. keep the horizontal-scroll table on mobile above a column threshold,
2. switch each row to a select box / segmented control,
3. a schema hint to opt in to one of the above.

## Decision

**Candidate 1: choice_tables with ≥ 6 columns keep the horizontal-scroll
table layout on mobile.** Fewer-column tables and all rubrics keep the
stacked card layout.

- The generator (`src/generate/items/choice-table.ts`) adds a `table-wide`
  class to the `.table-scroll` wrapper when `choices.length >=
  MOBILE_WIDE_TABLE_MIN_COLS` (named constant, value 6). Only
  `renderChoiceTable` applies it; rubrics never get the marker.
- The mobile stacking rules in `styles.ts` are scoped to
  `.table-scroll:not(.table-wide)`, so a wide table simply retains the
  desktop layout below 640px: scrollable wrapper, sticky header and sticky
  row labels, plus the scroll-affordance cues from task 0018.

Why not the alternatives:

- **Per-row select box / segmented control (candidate 2)** changes the
  interaction model and requires parallel answer collection in
  `src/runtime/form.ts` to keep the payload shape identical — more surface
  for divergence. A 10-option segmented control does not fit a 375px width
  anyway, and a `<select>` hides the scale until opened, which is worse for
  comparing columns. A wide Likert scale is inherently horizontal; keeping
  the table preserves that shape.
- **Schema hint (candidate 3)** pushes a presentation decision onto every
  form author and adds schema surface for what has a good default. If a
  concrete need appears, an opt-in hint can be layered on top of this
  decision later without conflicting with it.

Threshold rationale: 5 stacked choices per card are still scannable; sample
wide scales (8–10 columns) are not. 6 splits those regimes and matches the
"e.g. ≥ 6" suggestion in issue #15.

## Consequences

- Payload shape and runtime behavior are untouched — the same inputs exist
  in the same DOM, only CSS branches. No `form.ts` change.
- Wide tables on a 375px viewport rely on the task-0018 scroll cues and
  sticky row labels to stay answerable; the zebra row-tracking rules remain
  desktop-only (`min-width: 641px`) and can be extended to mobile wide
  tables later if row tracking proves hard.
- Markup carries explicit ARIA table roles either way, so AT semantics are
  identical in both branches.
