# Task 0017: UX/a11y batch — reduced-motion, live error clearing, input types, radio deselect, touch targets, noscript

Status: todo
Depends on: 0012 (error lifecycle), 0016 (spacing/tokens)
Parallel: no — touches `form.ts`, `render-item.ts`, `styles.ts`, schema

Issues: #10

## Goal

Land the small UX/a11y fixes bundled in issue #10 as one pass over the
runtime and generator.

## Context / Scope

Sub-items (issue #10):

1. **prefers-reduced-motion** — `scrollIntoView({behavior:"smooth"})`
   (`src/runtime/form.ts:258`) falls back to `auto` under
   `prefers-reduced-motion: reduce`.
2. **Live error clearing** — on input/change of a failed field, clear that
   field's error message and invalid state (uses 0012's set/clear helper).
3. **`input_type` / `autocomplete` schema fields** (WCAG 1.3.5) — allow
   `email | tel | url | number` input types and an `autocomplete` string on
   short_text. **Record a decision first** (`decisions/00XX-input-types.md`)
   for names/allowed values; update `src/schema/*`, `schema/` JSON Schema,
   `render-item.ts`, docs, examples.
4. **Radio deselect** — optional single-choice items get a clear affordance
   (e.g. a "clear selection" control); required items don't need one.
5. **Touch targets** — `.choice-option` padding up so rows reach ≥ 24px
   (WCAG 2.5.8), coordinated with 0016's control sizing.
6. **noscript warning** — generator emits `<noscript>` telling users the
   form needs JavaScript (string routed through the 0015 message table if
   0015 has landed; otherwise a constant it can pick up).
7. **Focus loss on hide** — when `visible_when` hides the focused item,
   move focus somewhere sane (e.g. next visible item or the form).

## Out of scope

- Anything visual-polish only (Task 0020).

## TDD plan

Per sub-item, red → green:

1. matchMedia mock → behavior `auto` when reduced.
2. fail submit, edit field → error slot emptied, `aria-invalid` removed.
3. schema accepts/rejects values; generated `type=`/`autocomplete=` attrs.
4. optional choice can end unselected; answer omitted from payload.
5. CSS assertion on `.choice-option` padding.
6. `<noscript>` present in generated HTML.
7. hide focused item via visibility update → `document.activeElement` is
   not `body`.

Refactor: keep sub-items as separate commits.

## Acceptance criteria

- [ ] All seven sub-items implemented with tests
- [ ] Decision recorded for the schema additions (`input_type`,
      `autocomplete`)
- [ ] Docs/examples updated for the new schema fields
- [ ] `bun test` and `bun run typecheck` pass

## Verification

- `bun test tests/runtime tests/generate tests/schema`
- Manual: phone-sized viewport tap targets; toggle OS reduced-motion; open
  the form with JS disabled.
