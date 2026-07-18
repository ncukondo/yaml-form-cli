# 0004: `choice_table` structure

Date: 2026-07-18
Status: accepted

## Context

The inherited draft had questions as columns and the scale as rows, which is
the opposite of the common convention (Google Forms grid etc.) and produced
very wide tables.

## Decision

- Orientation: **`items` = rows (the questions), `choices` = columns (the
  shared scale)**.
- `required` means every row must have at least one selection.
- `multiple: true` allows several selections per row; the row's answer is then
  an array of values.
- Submitted shape: `{ <row key>: <value | value[]> }` under the item's id. Row
  key = row `id`, or the row title when `id` is omitted (see decision 0003).
- Responsive rendering: header row and row-label column stay fixed (sticky)
  while the table scrolls; when it still cannot fit, rows stack vertically as
  independent blocks.

## Consequences

- Matches user expectations for survey grids; long scales grow horizontally
  and are handled by the scroll/stacking rules.
- The submitted-data and rule-key shape (`<item_id>.<row_key>`) is shared with
  `rubric` (decision 0005).
