# Task 0005: choice_table & rubric rendering

Status: done (2026-07-18)
Depends on: 0003
Parallel: yes — group A (owns table/rubric renderer modules)

## Goal

Render `choice_table` and `rubric` per the decided structure, including
responsive behavior and their submitted-answer shapes.

## Context

- Relevant decisions: `decisions/0004-choice-table.md`,
  `decisions/0005-rubric.md`

## Scope

- Renderers: rows = questions/criteria, columns = scale; radio per row, or
  checkboxes when `multiple: true` (choice_table only); rubric cells show
  descriptors; `comment_per_row` text boxes.
- Answer collection: per-row object; arrays for multiple; `{ value, comment }`
  when `comment_per_row: true` (comment omitted when empty).
- `required` = every row has a selection; per-row validation message.
- Responsive: sticky header row + sticky row-label column with scrolling
  table; below a width threshold, stack each row as its own block.

## Out of scope

- visible_when integration (0004) beyond exposing answers in the shared shape.

## TDD plan

1. **Red** — tests: DOM structure for both types (headers, per-row inputs,
   descriptors in cells); answer shapes incl. multiple arrays and
   `{value, comment}`; required blocks until all rows answered; stacking
   markup/classes present.
2. **Green** — implement renderers + collection.
3. **Refactor** — share row/column logic between choice_table and rubric.

## Acceptance criteria

- [x] Sample form's tables and rubric render and submit the decided shapes
- [x] Sticky header/label scrolling works; narrow screens stack per row
- [x] `bun test` and `bun run typecheck` pass

## Verification

- `bun test tests/generate/tables`
- Manual: open generated sample in a browser; check a phone-width viewport.

## Completion notes (2026-07-18)

- New renderers `src/generate/items/choice-table.ts` (shared `renderTable`
  core + `renderChoiceTable`) and `src/generate/items/rubric.ts` (radios
  only, per-cell descriptors, optional `comment_per_row` textarea rows);
  `render-item.ts` now dispatches to them instead of the placeholder.
- Markup: `.table-scroll > table.choice-table`, `thead th[scope=col]` per
  choice plus a `.table-corner` cell, one `tr.table-row` per question with a
  `th[scope=row].row-label`; inputs are named `<item_id>.<row_key>`
  (comments `<item_id>.<row_key>.comment`). Each row label carries a
  `data-error-for="<item_id>.<row_key>"` slot for per-row messages. Cells
  include a `.cell-choice` span (hidden on wide screens) so stacked rows
  stay readable.
- Runtime (`src/runtime/form.ts`): `readTableValue` collects per-row
  answers — bare value, array when `multiple: true`, `{ value, comment }`
  when `comment_per_row: true` with empty comments omitted; unanswered rows
  and fully unanswered tables are omitted. `validateRequired` emits one
  failure per unanswered row (`rowKey` added to `RequiredFailure`); a
  comment alone does not satisfy required. `showErrors` generalized to fill
  any `[data-error-for]` slot. `Answers` type widened for nested row
  objects.
- Styles: sticky `thead` + sticky row-label column inside a scrolling
  `.table-scroll` wrapper; `@media (max-width: 640px)` stacks each row as
  its own block with visible choice titles.
- Tests: `tests/generate/tables.test.ts` (24 tests) covers DOM structure for
  both types, answer shapes, required behavior, and stacking markup/styles.
