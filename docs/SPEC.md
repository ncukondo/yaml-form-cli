# yaml-form-cli Specification (Draft)

Status: **draft — under discussion**. Nothing here is final.

## Overview

`yaml-form-cli` is a command-line tool that converts a YAML form definition
into a **single self-contained HTML file**:

- No external resources (no CDN scripts, stylesheets, fonts, or images).
  All CSS/JS is inlined; the file works offline and when opened via `file://`.
- The generated page renders the form, validates input, evaluates conditional
  visibility, and executes submit actions — entirely client-side.

The YAML schema is based on the form definition used in
[flexible-form](https://github.com/ncukondo/flexible-form), extended with a
`rubric` item type. The canonical example is [`examples/sample.yaml`](../examples/sample.yaml).

## CLI (draft)

```
yaml-form <input.yaml> [-o <output.html>]

Options:
  -o, --output <file>   Write HTML to file (default: stdout)
  -h, --help            Show help
  --version             Show version
```

Possible future subcommands (not in v1 unless decided otherwise):

- `yaml-form validate <input.yaml>` — validate the definition without generating HTML
- `yaml-form preview <input.yaml>` — serve the generated HTML locally with reload

## YAML schema

### Top level

| Field         | Type                 | Required | Description |
| ------------- | -------------------- | -------- | ----------- |
| `title`       | string               | yes      | Form title |
| `description` | string               | no       | Multi-line supported; URLs are auto-linked |
| `actions`     | string \| string[]   | no       | Actions executed on submit (see below) |
| `post_submit` | object               | no       | `message`: text displayed after submission |
| `items`       | item[]               | yes      | Form items in display order |

### Common item fields

| Field          | Type    | Required | Description |
| -------------- | ------- | -------- | ----------- |
| `type`         | string  | no       | One of `constant`, `short_text`, `long_text`, `choice`, `choice_table`, `rubric`. Defaults to `short_text` |
| `title`        | string  | yes      | Item label |
| `id`           | string  | no       | Unique key used in submitted data and `visible_when` rules |
| `description`  | string  | no       | Help text for the item |
| `required`     | boolean | no       | Defaults to `false` |
| `visible_when` | string  | no       | Rule expression; item is shown only when it evaluates to true |

### Item types

- **`constant`** — fixed, non-editable value. Extra field: `value` (required).
  Included in submitted data.
- **`short_text`** — single-line text input.
- **`long_text`** — multi-line text input.
- **`choice`** — single (`radio`) or multiple (`checkbox`) choice.
  Extra fields: `choices` (required), `multiple` (default `false`).
  A choice is either a string or `{ title, value?, id? }`.
- **`choice_table`** — matrix of choices. Extra fields:
  - `items` (required): column headers; each may be a string or `{ title, id? }`.
    An `id` given here must be unique across the whole form.
  - `choices` (required): row headers.
  - `multiple` (default `false`).
- **`rubric`** — like `choice_table`, but each cell has its own descriptor text.
  - `levels` (required): columns; `{ title, value }[]`. `value` is what is
    submitted and what `visible_when` rules see.
  - `criteria` (required): rows; each is `{ id, title, descriptors, allow_na? }`.
    `descriptors` has one entry per level, in level order.
    `allow_na: true` adds an N/A column (submitted as `"na"`).
    Criterion `id`s must be unique across the whole form.
  - `comment_per_criterion` (default `false`): adds a free-text box under each row.
  - `scoring` (optional): `{ method: sum | average | weighted, weights? }`.
    If omitted, no score is computed.

  Submitted data is flat — `{ criterion_id: selected_level_value, ... }` — so
  criteria can be referenced from `visible_when` directly.

### Conditional visibility (`visible_when`)

Rule syntax follows
[`@ncukondo/dynamic-form-rules`](https://github.com/ncukondo/dynamic-form-rules)
(the README there is slightly outdated; the operator list below follows the
current source, `src/schema.ts` and `src/source-parser.ts`):

```
Comparison:  id="value"              id<>"value"
Contains:    id includes "value"     id notIncludes "value"
Set:         id in ["a","b","c"]     id notIn ["a","b"]
Regex:       id matches "\d+"        id notMatches "\d+"
Logical:     expr and expr           expr or expr          not expr
             ("and" binds tighter than "or"; parentheses supported)
Multi-key:   anyOf(id1,id2)="x"      allOf(id1,id2)="x"    noneOf(id1,id2)="x"
```

Quoting: keys/values may be unquoted if they contain only safe characters
(no `, = ( ) < > [ ]`, quotes, or whitespace); otherwise use single or double
quotes. A quote inside a quoted value is escaped by doubling (`'it''s ok'`).

Hidden items are excluded from validation (a `required` item that is hidden
does not block submission) and from submitted data. (TBC)

### Actions

`actions` is a string or array of strings, executed in order on submit:

| Action              | Behavior in a self-contained HTML |
| ------------------- | --------------------------------- |
| `log:`              | Log submitted data to the browser console (**TBD** — original semantics were "server console") |
| `mailto:<address>`  | Open a `mailto:` URL with the submitted data serialized into the body (**TBD**: body format) |
| `https://<url>`     | `POST` the submitted data as JSON via `fetch` (**TBD**: payload shape, CORS expectations, error handling) |

### Submitted data shape (draft)

A flat object keyed by item `id` (items without an `id` get a generated key — **TBD**):

```jsonc
{
  "constant_test": "value",
  "id_sample": "free text",
  "single_choice": "option2",
  "multiple_choice": ["option1", "value4"],   // multiple: array
  "global_unique_id8": "scale3",              // choice_table cell by column id
  "rubric_clarity": "2",                      // rubric criterion by id
  "rubric_evidence": "na"
}
```

## Generated HTML requirements

- Valid standalone HTML5 document; all assets inlined.
- Reasonable default styling; readable on mobile (responsive).
- Client-side `required` validation before actions run.
- `visible_when` re-evaluated live as the user edits.
- After successful submit, show `post_submit.message` (if set).
- No build-time network access: generation must work fully offline.

## Open questions

1. **`log:` semantics** — browser console only, or also render the payload on
   the page (useful for testing)?
2. **`mailto:` body format** — plain text `key: value` lines? JSON?
3. **`https:` action** — payload shape (`{ answers: {...}, meta: {...} }`?),
   success/failure UI, retry.
4. **Items without `id`** — auto-generate keys (from title? index?), or make
   `id` required for non-constant items?
5. **`choice_table` submitted keys** — by column `id` (as drafted above), and
   what key when a column has no `id`?
6. **Rubric `scoring`** — where is the score shown (live on the page? included
   in submitted data as `<rubric_id>_score`?), and how does `na` interact with
   sum/average/weighted?
7. **i18n** — UI strings (validation messages, submit button) configurable?
   Default language?
8. **Distribution** — npm package (`bunx yaml-form`), single-file executable
   (`bun build --compile`), or both?
