# Task 0014: a11y — choice_table/rubric cell labels & mobile table semantics

Status: done
Depends on: 0010
Parallel: yes — group B (owns `src/generate/items/choice-table.ts`, `src/generate/items/rubric.ts`)

Issues: #6

## Goal

Rubric descriptors are read by screen readers when picking a cell, and the
mobile (stacked) layout degrades into an intentional, self-contained list
structure instead of silently losing table semantics.

## Context

- Issue #6: `choice-table.ts:25` sets `aria-label="{row}: {choice}"`, which
  overrides visible cell text — rubric descriptors become unreachable to AT.
  Mobile `display: block` + `thead { display: none }` strips implicit
  table/row/cell roles.
- Relevant decisions: `decisions/0004-choice-table.md`,
  `decisions/0005-rubric.md`.

## Scope

- `src/generate/items/rubric.ts` / `choice-table.ts`:
  - Include the descriptor in the cell input's accessible name, or link the
    descriptor element via `aria-describedby` instead of overriding it.
  - Keep the `"{row}: {choice}"` construction in one helper (i18n hook for
    Task 0015; note the separator hard-coding there).
- `src/generate/styles.ts` (mobile block only): make the stacked layout
  self-contained — visible row title + visible choice text (existing
  `.cell-choice` inlining) and, if roles are lost anyway, explicit
  `role="presentation"`/restructure so AT gets a coherent list.

## Out of scope

- Desktop scroll affordance / row highlighting (Task 0018).
- Alternative mobile layouts for many-column tables (Task 0019).

## TDD plan

1. **Red** — generator tests: rubric cell input's accessible name (or
   description) contains the descriptor text; choice_table cells keep
   row+choice naming; stacked-mode markup carries the agreed roles/classes.
2. **Green** — adjust cell markup.
3. **Refactor** — share the naming helper between both renderers.

## Acceptance criteria

- [x] Screen reader announces the descriptor when focusing a rubric radio
- [x] Mobile stacked view presents row title + choice text without relying
      on (now-absent) column headers
- [x] `bun test` and `bun run typecheck` pass

## Verification

- `bun test tests/generate/tables`
- Manual: inspect the a11y tree of a rubric cell; check a phone-width
  viewport with a screen reader.
