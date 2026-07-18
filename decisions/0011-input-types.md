# 0011: `input_type` / `autocomplete` fields on short_text

Date: 2026-07-18
Status: accepted

## Context

WCAG 1.3.5 (Identify Input Purpose) asks that fields collecting user data
expose their purpose to the browser so autofill and assistive tech can help.
`short_text` always rendered `<input type="text">` with no `autocomplete`,
so email/phone/URL/number fields got no matching mobile keyboard, no
validation semantics, and no autofill (issue #10, task 0017).

## Decision

- Add two optional fields to **`short_text` only**:
  - `input_type`: one of `email | tel | url | number`. Rendered as the
    input's `type` attribute; omitted → `text` as before. The name is
    `input_type` (not `type`) because `type` already selects the item kind.
  - `autocomplete`: free-form non-empty string, rendered verbatim as the
    `autocomplete` attribute (e.g. `email`, `tel`, `name`,
    `section-x shipping tel`). The HTML token list is open-ended and
    space-separated combinations are valid, so the schema does not enumerate
    it; browsers ignore unknown tokens.
- The two fields are independent: either may be given without the other.
- Allowed `input_type` values are limited to text-like single-line inputs
  that keep the free-text answer shape. `date`/`time`/`color`/`range` etc.
  change the value model or widget and would deserve their own item types;
  `password` is out because answers are submitted (and logged) in plain
  text.
- No client-side format validation is attached to these types; `required`
  remains the only built-in validation. Browser-native format hints still
  apply where the UA provides them (the form keeps `novalidate`, unchanged).

## Consequences

- Schema (`src/schema/form-schema.ts`), published JSON Schema, renderer,
  docs, and `examples/sample.yaml` gain the two fields.
- Styling: CSS selectors targeting `input[type="text"]` do not match the new
  types; a small appended rule extends the same styling to
  `email/tel/url/number` inputs (kept as an appended block to avoid
  conflicts with parallel style work).
- Future item types (e.g. a real date picker) are not blocked: `input_type`
  stays scoped to text-like inputs.
