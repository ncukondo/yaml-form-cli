# Task 0011: a11y — field labels, group names, required semantics

Status: done
Depends on: 0010
Parallel: yes — group B (owns `src/generate/render-item.ts` markup)
Issues: #1, #2, #3

## Goal

Every input the generator emits has an accessible name, choice groups are
named by their item title, and required state is exposed to assistive
technology (plus a visible legend).

## Context

- Issues #1–#3 (WCAG 1.3.1 / 4.1.2 / 3.3.2)
- Current markup: `<span class="item-title" id="label-{id}">` with no
  `label for` / `aria-labelledby`; `role="group"` without a name; required
  `*` is `aria-hidden` with no AT equivalent and no visible legend.

## Scope

- `src/generate/render-item.ts` (`renderShortText`, `renderLongText`,
  `renderChoice`, `renderItem`):
  - Emit item titles as `<label for="input-{id}">` for text inputs.
  - Wire `description` via an `id` + `aria-describedby` on the input.
  - Give choice groups an accessible name: `fieldset`/`legend` (preferred)
    or `aria-labelledby="label-{id}"` on the `role="group"` element.
  - `choice_table` / `rubric` containers get `aria-labelledby` to the item
    title (container-level only; cell labeling is Task 0014).
  - Required items: `aria-required="true"` on the input / group (keep
    `novalidate` + JS validation).
- `src/generate/index.ts`: a "* indicates required" legend at the top of the
  form when any item is required.
- `src/generate/styles.ts`: only if `fieldset`/`legend` needs reset styles.

## Out of scope

- Error announcement / `aria-invalid` (Task 0012).
- Table cell `aria-label` contents (Task 0014).
- Localizing the required legend text (Task 0015).

## TDD plan

1. **Red** — generator DOM tests: text inputs referenced by a `label[for]`;
   textarea likewise; description linked via `aria-describedby`; choice
   group named by the item title; tables `aria-labelledby` the title;
   required items expose `aria-required="true"`; legend appears iff any
   item is required.
2. **Green** — adjust `render-item.ts` / `index.ts` output.
3. **Refactor** — extract shared label/description id helpers.

## Acceptance criteria

- [x] Clicking a text item's title focuses its input
- [x] Choice groups and tables announce the item title as their name
- [x] Required state exposed via `aria-required` and a visible legend
- [x] Existing runtime tests still pass (ids/names unchanged)
- [x] `bun test` and `bun run typecheck` pass
- [x] `docs/` output examples updated if they show generated markup
      (n/a — `docs/reference.md` contains no generated-markup examples)

## Verification

- `bun test tests/generate` — markup assertions
- Manual: generate an example form, tab through with a screen reader
  (VoiceOver/NVDA) or check the a11y tree in devtools.
