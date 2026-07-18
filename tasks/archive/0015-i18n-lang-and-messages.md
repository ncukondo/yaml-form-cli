# Task 0015: i18n — `lang` attribute and overridable UI strings

Status: done
Depends on: 0012, 0013, 0014 (all hard-coded strings landed in final shape)
Parallel: no — touches schema, generator, and runtime strings

Issues: #7

## Goal

Generated HTML declares its language, and every fixed UI string (required
error, submit failed/succeeded, Submit button, `Comment — {row}`, required
legend, submitting indicator) can be produced in the form's language.

## Context

- Issue #7 (WCAG 3.1.1): no `lang` on `<html>` (`src/generate/index.ts:20`);
  English hard-coded in `src/runtime/form.ts:172,182`,
  `src/runtime/submit.ts:24-25`, `src/generate/items/choice-table.ts:47`,
  Submit button in `src/generate/index.ts:35`.
- **Record a decision first** (`decisions/00XX-i18n.md`): schema surface —
  a `lang` field plus per-message overrides (e.g. `messages.required`,
  `messages.submit_failed`, `labels.submit`) vs. built-in translations
  keyed by `lang`. Include placeholder syntax for interpolations
  (`"X" is required.`, `Comment — {row}`).

## Scope

- `decisions/`: new i18n decision.
- `src/schema/` (`form-schema.ts`, `json-schema.ts`, `parse.ts`): `lang` +
  message override fields; JSON Schema updated (`schema/`).
- `src/generate/index.ts`: `<html lang="…">`; strings routed through the
  message table (embed resolved messages for the runtime, e.g. via the
  existing config the runtime reads).
- `src/runtime/form.ts`, `src/runtime/submit.ts`: consume messages instead
  of literals.
- `docs/` + `examples/`: document `lang`/messages; add a Japanese example.

## Out of scope

- Full translation bundles beyond what the decision selects.
- RTL layout support.

## TDD plan

1. **Red** — schema tests: `lang`/messages accepted, bad shapes rejected.
   Generator tests: `<html lang>` emitted; overridden Submit label/legend
   appear. Runtime tests: overridden required/failed/success messages are
   the ones shown; interpolation fills the item title / row.
2. **Green** — schema fields → message resolution → threading into
   generator + runtime.
3. **Refactor** — one messages module both sides import.

## Acceptance criteria

- [x] `<html lang="ja">` output when the YAML says so
- [x] A Japanese form shows no English text end-to-end (validation,
      submitting, success/failure, Submit button, comment labels)
- [x] Defaults unchanged for existing English forms
- [x] JSON Schema + docs updated
- [x] `bun test` and `bun run typecheck` pass

## Verification

- `bun test tests/schema tests/generate tests/runtime`
- Manual: generate the Japanese example and click through submit
  success/failure paths.
