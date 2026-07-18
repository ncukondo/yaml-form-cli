# Task 0021: i18n — route noscript warning & clear-selection label through messages

Status: todo
Depends on: 0015, 0017
Parallel: yes — sole task in flight

Issues: #28

## Goal

The two strings task 0017 added as English constants — the `<noscript>`
warning and the optional-choice "Clear selection" button — resolve through
the 0015 message table, so `lang: ja` forms show no English anywhere.

## Context

- Issue #28; decision `decisions/0010-i18n.md` (message table shape,
  precedence, placeholder syntax).
- Current constants: `NOSCRIPT_WARNING` (`src/generate/index.ts`),
  `CLEAR_SELECTION_LABEL` (`src/generate/render-item.ts`).
- Both strings are generator-side only (baked into the HTML); the runtime
  never re-renders them, so no runtime change is expected.

## Scope

- `src/messages.ts`: add `noscript_warning` and `clear_selection` to
  `MESSAGE_KEYS` with en/ja builtin translations.
- `src/schema/form-schema.ts` (`messagesSchema`) + `schema/yaml-form.schema.json`:
  accept the new override keys.
- `src/generate/index.ts` / `src/generate/render-item.ts`: replace the
  constants with resolved messages (render-item may need the `messages`
  argument threaded like choice-table already does).
- `docs/reference.md`: extend the messages key table.
- `examples/sample-ja.yaml`: no change needed unless it overrides messages.

## Out of scope

- New languages beyond en/ja.
- Any other hard-coded strings (none known — verify while in there).

## TDD plan

1. **Red** — generator tests: ja form renders the ja noscript warning and
   ja clear-selection label; `messages.noscript_warning` /
   `messages.clear_selection` overrides win. Schema tests: new keys
   accepted, unknown keys still rejected.
2. **Green** — add keys, thread messages, replace constants.
3. **Refactor** — drop the now-unused exported constants (update any tests
   importing them).

## Acceptance criteria

- [ ] `lang: ja` form contains no English text in noscript warning or
      clear-selection button
- [ ] Both strings overridable via `messages:`
- [ ] JSON Schema + docs updated
- [ ] `bun run check` passes

## Verification

- `bun test tests/generate tests/schema`
- Manual: generate `examples/sample-ja.yaml`, view with JS disabled and
  check the optional-choice clear button label.
