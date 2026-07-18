# Task 0012: a11y — validation error announcement, focus, and invalid styling

Status: todo
Depends on: 0011, 0016
Parallel: no — touches `src/runtime/form.ts`, `render-item.ts`, `styles.ts`

Issues: #4, #12

## Goal

When validation fails, screen readers hear the errors, keyboard focus moves
to the first failing field, and failing fields are visibly marked at the
input itself (WCAG 3.3.1).

## Context

- Issue #4: `.item-error` / `.form-error` have no `aria-live`/`role="alert"`;
  no `aria-invalid` / `aria-describedby`; submit failure only does
  `scrollIntoView` (`src/runtime/form.ts:254-258`) without `focus()`.
- Issue #12: invalid fields keep their normal border; only the message text
  turns red.
- Builds on 0011's label/description id scheme for `aria-describedby`.

## Scope

- `src/generate/render-item.ts`: error slots rendered with `role="alert"`
  (or `aria-live="assertive"`) and stable ids so inputs can reference them.
- `src/runtime/form.ts` (`showErrors`, submit handler):
  - Set `aria-invalid="true"` + `aria-describedby` (error slot id) on
    failing inputs/groups; remove both when the error clears.
  - `focus()` the first failing field (in addition to `scrollIntoView`).
  - Table rows: mark the row's inputs/row-label via the existing
    `data-error-for` slots.
- `src/generate/styles.ts`: style invalid state off `aria-invalid`
  (`[aria-invalid="true"] { border-color: var(--error); … }`); row-level
  treatment for choice_table/rubric errors.

## Out of scope

- Error summary block at the top of the form (optional in #4 — defer;
  create a follow-up task if wanted).
- Clearing errors on input/change before resubmit (Task 0017).
- Localized error text (Task 0015).

## TDD plan

1. **Red** — runtime tests (happy-dom): failed submit sets `aria-invalid`
   and `aria-describedby` on the failing input; error slot has
   `role="alert"`; first failing field receives focus; fixing the value and
   resubmitting removes `aria-invalid`/`aria-describedby`; table-row
   failures mark the row. Generator test: error slot attributes/ids.
2. **Green** — implement in `showErrors` + render templates + CSS.
3. **Refactor** — centralize set/clear of invalid state.

## Acceptance criteria

- [ ] Errors are announced (role=alert) and first invalid field is focused
- [ ] Invalid inputs/rows are visibly outlined with `--error`
- [ ] State fully clears once the field passes validation
- [ ] `bun test` and `bun run typecheck` pass

## Verification

- `bun test tests/runtime` and `bun test tests/generate`
- Manual: submit an empty required form with a screen reader running;
  confirm announcement + focus lands on the first field.
