# Task 0005: choice_table & rubric rendering

Status: todo
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

- [ ] Sample form's tables and rubric render and submit the decided shapes
- [ ] Sticky header/label scrolling works; narrow screens stack per row
- [ ] `bun test` and `bun run typecheck` pass

## Verification

- `bun test tests/generate/tables`
- Manual: open generated sample in a browser; check a phone-width viewport.
