# Task 0019: Mobile layout for many-column choice_tables

Status: done
Depends on: 0014 (mobile semantics), 0018 (table styles)
Parallel: no — shares `src/generate/styles.ts` / table renderers

Issues: #15

## Goal

A many-column choice_table (e.g. 10 choices × 8 rows) stays answerable on
mobile without becoming an 80-item vertical radio list.

## Context

- Issue #15: below 640px every row card stacks all choices vertically.
  Fine for few columns (rubric), overwhelming for wide scales.
- **Record a decision first** (`decisions/00XX-mobile-wide-tables.md`)
  choosing between the candidates in the issue:
  - keep horizontal-scroll table on mobile above a column threshold
    (e.g. ≥ 6), or
  - per-row select box / segmented control, or
  - a schema hint to opt in.
  Few-column tables keep the current card layout either way.

## Scope

- Decision doc, then per the decision:
- `src/generate/styles.ts` (media-query block) and/or
  `src/generate/items/choice-table.ts` (column-count class/threshold on the
  wrapper so CSS can branch).
- If interaction changes (select/segmented): answer collection in
  `src/runtime/form.ts` must produce the identical payload shape.

## Out of scope

- Rubric mobile layout (stays card-stacked).
- Desktop layout (Task 0018).

## TDD plan

1. **Red** — generator test: wide tables carry the threshold marker
   (class/attr), narrow ones don't; CSS branches on it. If interaction
   changes: runtime test that answers/required behave identically in the
   mobile control.
2. **Green** — implement per decision.
3. **Refactor** — threshold as a named constant.

## Acceptance criteria

- [x] Decision recorded (`decisions/0012-mobile-wide-tables.md`)
- [x] 10×8 table is usable on a 375px viewport without an 80-row list
- [x] Few-column tables (rubric) unchanged
- [x] Payload shape identical to desktop for the same answers
- [x] `bun test` and `bun run typecheck` pass

## Verification

- `bun test tests/generate/tables tests/runtime`
- Manual: wide-table example at 375px width; answer every row and inspect
  the submitted payload.
