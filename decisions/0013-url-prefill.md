# 0013: URL-parameter prefill and constant overrides

Date: 2026-07-18
Status: accepted

## Context

Forms are distributed as links (or files) to a self-contained HTML page; there
is no server to personalize them. Form authors want to pre-fill fields via the
link, and — for surveys — to identify respondents by handing each person a URL
carrying an identifier, instead of asking them to type their name. Browsers
preserve query strings on `file://` URLs and the runtime already does
everything client-side, so query parameters work in every supported
deployment with no server involvement.

## Decision

### Prefill from query parameters

At init, **before the first visibility pass**, the runtime reads
`location.search` (via `URLSearchParams`) and applies values to the form.

- Parameter names are matched by **exact string comparison** against the set
  of valid keys enumerated from the embedded form data: item `id` for
  `short_text` / `long_text` / `choice`, `<id>.<rowKey>` for `choice_table` /
  `rubric` rows, `<id>.<rowKey>.comment` for rubric per-row comments, and
  item `id` for `constant` items that opt in (below). There is no dotted-path
  *parsing* — exact matching sidesteps ambiguity, since item ids may
  themselves contain dots.
- Unknown parameter names and unmatched choice values are ignored with a
  `console.warn`; prefill must never break rendering.
- Choice-like targets match against the choice **`value`** (not `title`).
- Repeated parameters: single-valued targets take the **last** occurrence;
  `multiple: true` targets take the union of all occurrences.
- **Comma shorthand** for `multiple: true` targets (`?tags=a,b`): each
  parameter value is first matched whole against the choice-value set (a
  value that itself contains a comma wins), otherwise split on `,` with each
  token matched individually. Repeated parameters remain the unambiguous
  escape hatch. No splitting for single-select or text targets.
- Text values are applied verbatim after standard URL decoding
  (`URLSearchParams` decodes `+` as space).
- Values are applied via `input.value` / `input.checked` / `textContent`
  only — no HTML string interpolation, so URL data has no XSS path.
- Prefill never triggers error display; `required` is still checked only at
  submit. The initial visibility pass runs after prefill, so `visible_when`
  sees prefilled answers on first render.
- Hash-fragment parameters (`#…`) are **not** supported in v1. They could be
  added later to keep values out of server logs/Referer for hosted forms.

### Constant overrides are opt-in (`from_url: true`)

A `constant` item is overridable from the URL only when it declares
`from_url: true`. `value` remains required in YAML and is the fallback when
the parameter is absent. The override rewrites the embedded form data (the
`#yaml-form-data` script tag) once at init, so visibility rules,
`collectAnswers`, and the submit payload all see the override consistently;
the rendered `.constant-value` text is updated too. Default-off means a link
cannot silently tamper with submitted metadata unless the author opted in.

### `hidden: true`, on constant only

A hidden constant's `<section class="form-item">` is not rendered at all; it
still participates in answers and rule evaluation (the runtime already treats
items without a DOM section as visible). Combining `hidden` with
`visible_when` is a generation-time error — a display rule on an unrendered
item is a contradiction and should fail fast. Other item types cannot be
statically hidden: `visible_when` covers dynamic hiding, and a hidden input
would make `required` unsatisfiable.

`hidden: true` + `from_url: true` together give the survey use case:
per-respondent distribution URLs (`?respondent=r042`) whose identifier lands
in the payload without an on-screen field.

## Consequences

- Schema (`src/schema/form-schema.ts`), published JSON Schema, generator,
  runtime, docs, and examples change — task 0022.
- The runtime gains a prefill step; it reads the URL from
  `doc.defaultView.location` so tests can drive it through happy-dom.
- Docs must note that when distribution URLs carry identifiers, authors are
  responsible for telling respondents — the parameter is invisible on a
  hidden constant, which conflicts with surveys presented as anonymous.
- Choice `value`s become part of the prefill interface; renaming them breaks
  previously distributed URLs (same class of stability as item ids).
