# 0005: `rubric` = `choice_table` + per-cell descriptors

Date: 2026-07-18
Status: accepted

## Context

The initial rubric draft had its own vocabulary (`levels`, `criteria`,
`allow_na`, `comment_per_criterion`, flat `<id>_comment` keys), duplicating
most of `choice_table` with different names and special cases.

## Decision

`rubric` shares the `choice_table` schema exactly (`items` = rows, `choices` =
columns, same key rules, submitted shape, and `required` semantics). The only
differences:

- Each row carries `descriptors`: one text per column, in column order; a
  count mismatch with `choices` is a generation-time error.
- `multiple` is not allowed (generation-time error).
- `comment_per_row` (default `false`): adds a free-text box under each row.
  When `true`, the row's answer becomes `{ "value": …, "comment": … }`
  (comment omitted when empty) instead of the bare value, referenced from
  rules as `<rubric_id>.<row_id>.value` / `.comment`.

Removed concepts:

- `levels` / `criteria` — replaced by `choices` / `items`.
- `allow_na` — an N/A option is a regular column
  (`{ title: "N/A", value: "NA" }`) with its own descriptor per row.
- Flat `<criterion_id>_comment` keys — the nested comment shape cannot collide
  with row ids.
- Score computation — values are submitted per row; no aggregate score.

## Consequences

- The spec for rubric reduces to a short delta on choice_table; renderer and
  validation code can be shared.
- Per-row N/A control is lost (an N/A column applies to all rows); split into
  separate rubric items if needed.
- Toggling `comment_per_row` changes rule keys (`….<row_id>` →
  `….<row_id>.value`); caught by rule-key validation (decision 0006).
