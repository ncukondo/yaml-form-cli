# Task 0022: URL-parameter prefill, constant `from_url` / `hidden`

Status: todo
Depends on: —
Parallel: no — touches schema, generator, and runtime together

## Goal

Opening a generated form with query parameters prefills matching fields
(`?name=John&role=student&tags=a,b`), and `constant` items can opt in to URL
override (`from_url: true`) and static hiding (`hidden: true`), enabling
per-respondent distribution URLs.

## Context

- Relevant decisions: `decisions/0013-url-prefill.md` (the full spec —
  key matching, comma shorthand, opt-in rules), `decisions/0006-visible-when.md`
  (rule-key flattening the param keys mirror), `decisions/0007-submit-payload.md`.
- Relevant docs: `docs/reference.md` (item reference, submit payload).
- Runtime init lives in `src/runtime/form.ts` (`initForm`); the embedded form
  data is the `#yaml-form-data` script tag read by `readFormData` on every
  call, so rewriting its `textContent` once propagates everywhere.
- Runtime tests run under happy-dom (`tests/runtime/`); read the URL via
  `doc.defaultView?.location` so tests can set it.

## Scope

- `src/schema/form-schema.ts` — `from_url` / `hidden` on `constant` only;
  reject `hidden` + `visible_when` (schema refine or `cross-checks.ts`).
- `scripts/build-schema.ts` output (`schema/yaml-form.schema.json`) regenerated.
- `src/generate/render-item.ts` — skip the section for hidden constants.
- `src/runtime/prefill.ts` (new) + wiring in `src/runtime/form.ts` — apply
  params before the initial visibility pass.
- `docs/reference.md`, `README.md`, `examples/sample.yaml`.
- Tests: `tests/schema/`, `tests/generate/`, `tests/runtime/prefill.test.ts`.

## Out of scope

- Hash-fragment (`#…`) parameters — future decision if needed.
- A YAML `default:` field for static initial values — separate feature.
- `hidden` on non-constant item types.
- Making `value` optional on `from_url` constants (fallback stays required).

## TDD plan

1. **Red** — schema tests: `from_url` / `hidden` accepted on `constant`,
   rejected on other types; `hidden` + `visible_when` is a parse error with a
   clear message; JSON Schema exposes the new fields.
2. **Green** — schema + regenerated `schema/yaml-form.schema.json`.
3. **Red** — generator tests: hidden constant renders no section (no
   `data-item-id`); visible constant unchanged.
4. **Green** — renderer skip.
5. **Red** — runtime `prefill.test.ts`:
   - text / long_text set verbatim (incl. decoded space, comma untouched);
   - single choice checked by `value`; unknown value ignored with warn;
   - `multiple` union of repeated params; comma shorthand splits; a choice
     value containing a comma matches whole and is not split;
   - `choice_table` / `rubric` rows via `<id>.<rowKey>`, rubric comment via
     `<id>.<rowKey>.comment`;
   - constant with `from_url`: embedded JSON, rendered text, `collectAnswers`,
     and `visible_when` all see the override; without `from_url` the param is
     ignored;
   - unknown param names ignored (warn), rendering intact;
   - initial visibility reflects prefilled answers; no error slots shown;
   - repeated single-valued param: last one wins.
6. **Green** — implement `prefill.ts`, call from `initForm` before the first
   `refreshVisibility()`.
7. **Refactor** — share the valid-key enumeration with rule-key logic if it
   falls out naturally; keep tests green.

## Acceptance criteria

- [ ] `?name=John&role=student` prefills text and choice items; visibility
      rules react to prefilled values on first render
- [ ] `?tags=a,b` checks both options; `?tags=a&tags=b` equivalent
- [ ] `constant` + `from_url: true` overridden by URL and lands in the submit
      payload; without `from_url` the URL cannot change it
- [ ] `hidden: true` constant invisible but present in payload and rules
- [ ] `hidden` + `visible_when` fails generation with a clear message
- [ ] Unknown params / values never break the form (warn only)
- [ ] `bun run check` passes
- [ ] `docs/reference.md` documents prefill (incl. the note that authors must
      disclose identifier-carrying distribution URLs); `examples/sample.yaml`
      and README updated

## Verification

- `bun test tests/schema tests/generate tests/runtime/prefill.test.ts`
- Manual: `bun src/cli.ts examples/sample.yaml -o /tmp/form.html`, open
  `file:///tmp/form.html?name=Jane&role=student` in a browser — fields
  prefilled, no errors shown, submit payload contains overridden constant.
