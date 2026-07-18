# yaml-form reference

`yaml-form` converts a YAML form definition into a **single self-contained
HTML file**: no external resources, all CSS/JS inlined, works offline and via
`file://`. The generated page renders the form, validates input, evaluates
conditional visibility, and executes submit actions entirely client-side.

The canonical example is [`examples/sample.yaml`](../examples/sample.yaml).

## CLI

```
yaml-form <input.yaml> [-o <output.html>]

Options:
  -o, --output <file>   Write HTML to file (default: stdout)
  -h, --help            Show help
  --version             Show version

Subcommands:
  yaml-form upgrade [--dry-run]
                        Self-upgrade a binary install to the latest release
                        (npm installs: upgrade via your package manager)
```

Installation: `bunx @ncukondo/yaml-form` / `npx @ncukondo/yaml-form`, or
download a single-file executable from
[GitHub Releases](https://github.com/ncukondo/yaml-form-cli/releases).

## YAML format

A JSON Schema is published for editor completion/validation; reference it at
the top of your YAML:

```yaml
# yaml-language-server: $schema=<path or URL to yaml-form.schema.json>
```

### Top level

| Field         | Type               | Required | Description |
| ------------- | ------------------ | -------- | ----------- |
| `title`       | string             | yes      | Form title |
| `id`          | string             | no       | Form identifier, echoed into the submit payload as `form.id` |
| `version`     | string             | no       | Form definition version, echoed as `form.version` |
| `description` | string             | no       | Multi-line supported; URLs are auto-linked |
| `actions`     | action[] \| action | no       | Actions executed on submit (see [Actions](#actions)). A single mapping is treated as a one-element array |
| `post_submit` | object             | no       | `message`: text displayed on the success screen |
| `items`       | item[]             | yes      | Form items in display order |

### Common item fields

| Field          | Type    | Required | Description |
| -------------- | ------- | -------- | ----------- |
| `type`         | string  | no       | One of `constant`, `short_text`, `long_text`, `choice`, `choice_table`, `rubric`. Defaults to `short_text` |
| `title`        | string  | yes      | Item label |
| `id`           | string  | yes      | Unique key across the form; used in submitted data and `visible_when` rules |
| `description`  | string  | no       | Help text for the item |
| `required`     | boolean | no       | Defaults to `false` |
| `visible_when` | string  | no       | Rule expression; item is shown only when it evaluates to true |

### Item types

- **`constant`** — fixed, non-editable value. Extra field: `value` (required).
  Included in submitted data.
- **`short_text`** — single-line text input. Extra optional fields
  (decision 0011):
  - `input_type`: one of `email`, `tel`, `url`, `number` — rendered as the
    input's `type` attribute so browsers offer a matching keyboard and
    autofill (WCAG 1.3.5). Omitted → plain text input.
  - `autocomplete`: HTML autocomplete token(s), rendered verbatim (e.g.
    `email`, `name`, `section-x shipping tel`).
- **`long_text`** — multi-line text input.
- **`choice`** — single (`radio`) or multiple (`checkbox`) choice.
  Extra fields: `choices` (required), `multiple` (default `false`).
  A choice is either a string or `{ title, value? }`; the submitted value is
  `value` if given, otherwise `title`.
- **`choice_table`** — matrix of questions sharing one scale. Questions are
  **rows**, the scale is **columns**. Extra fields:
  - `items` (required): rows — the individual questions. Each is a string or
    `{ title, id? }`. The per-row `id` overrides the key used in submitted
    data; when omitted, the title serves as the key and is subject to the
    same constraints as an `id`. Either way the key must be unique within the
    item.
  - `choices` (required): columns — the shared scale. Same value rules as
    `choice`.
  - `multiple` (default `false`): allow multiple selections per row
    (checkboxes instead of radios); the row's answer is then an array.
  - `required` means every row must have at least one selection.
- **`rubric`** — a `choice_table` whose rows additionally carry per-cell
  descriptor text. Same structure, key rules, submitted shape, and `required`
  semantics as `choice_table`, with these differences:
  - Each row is `{ id?, title, descriptors }`. `descriptors` (required) has
    exactly one entry per column, in column order — the cell text for that
    row. A count mismatch with `choices` is a generation error.
  - `multiple` is not allowed.
  - `comment_per_row` (default `false`): adds a free-text box under each row.
    When `true`, each row's answer is submitted as
    `{ "value": <selected value>, "comment": <text> }` instead of the bare
    value, referenced from rules as `<rubric_id>.<row_id>.value` /
    `<rubric_id>.<row_id>.comment`. `value` and `comment` are each omitted
    when unset/empty; a row with neither is omitted entirely.
  - There is no built-in N/A: model it as a regular column, e.g.
    `{ title: "N/A", value: "NA" }`, giving it a descriptor in each row.
  - No score is computed; the selected values are submitted per row.

### Submitted data shape

`answers` is an object keyed by item `id`:

```jsonc
{
  "constant_test": "value",
  "id_sample": "free text",
  "single_choice": "option2",
  "multiple_choice": ["option1", "value4"],   // multiple: array of values
  "choice_table_sample": {                    // choice_table: per-row object
    "sub_question1": "scale3",
    "sq8": "scale1"                           // row with explicit id
  },
  "multiple_choice_table": {                  // multiple: true → array per row
    "sub_question1": ["scale1", "scale3"]
  },
  "presentation_rubric": {                    // rubric: same shape as choice_table
    "clarity": "2",
    "evidence": "3"
  },
  "commented_rubric": {                       // comment_per_row: true → object per row
    "clarity": { "value": "2", "comment": "..." }
  }
}
```

Hidden items (via `visible_when`) are excluded from validation and from
`answers`.

### Conditional visibility (`visible_when`)

Rule syntax follows
[`@ncukondo/dynamic-form-rules`](https://github.com/ncukondo/dynamic-form-rules):

```
Comparison:  id="value"              id<>"value"
Contains:    id includes "value"     id notIncludes "value"
Set:         id in ["a","b","c"]     id notIn ["a","b"]
Regex:       id matches "\d+"        id notMatches "\d+"
Logical:     expr and expr           expr or expr          not expr
             ("and" binds tighter than "or"; parentheses supported)
Multi-key:   anyOf(id1,id2)="x"      allOf(id1,id2)="x"    noneOf(id1,id2)="x"
```

Rules see a **flattened view** of `answers`: nested objects become dotted
keys, recursively (`presentation_rubric.clarity`,
`choice_table_sample.sub_question1`, and with `comment_per_row: true`,
`presentation_rubric.clarity.value`). Dots are safe in unquoted rule keys:

```
presentation_rubric.clarity in ["1","2"]
```

Array answers (`multiple: true`) are matched with `includes` / `notIncludes`.

Quoting: keys/values may be unquoted if they contain only safe characters
(no `, = ( ) < > [ ]`, quotes, or whitespace); otherwise use single or double
quotes. A quote inside a quoted value is escaped by doubling (`'it''s ok'`).

Notes:

- The rule engine has no ordering operators (`<`, `>`); express "less than"
  by enumeration (`in [...]`).
- Rule keys are validated at generation time against the possible answer
  keys; a typo or stale reference (e.g. after toggling `comment_per_row`)
  fails generation instead of silently hiding items.

### Actions

`actions` is an array of action objects executed in order after client-side
validation passes:

```yaml
actions:
  - type: log
  - type: post
    url: "https://example.com/api/submit"
  - type: mailto
    to: "example@example.com"
    subject: "Optional subject"   # default: form title
```

| Action   | Behavior |
| -------- | -------- |
| `log`    | Log the payload to the browser console. Always succeeds. Useful for testing |
| `post`   | `POST` the payload as JSON (`Content-Type: application/json`) via `fetch`. Success = HTTP 2xx |
| `mailto` | Build a `mailto:` URL with the answers serialized into the body and open it; the user sends the pre-filled mail manually |

`mailto` limitations:

- URL length is effectively limited (~2000 chars); long forms may be
  truncated.
- Whether the mail was actually sent cannot be detected; opening the mail
  client is treated as success.

Result handling:

- On success of all actions: the form is replaced by a success screen showing
  the form title and `post_submit.message` (default message if unset); the
  form description is hidden.
- On failure: the form stays (input preserved) with a submission-failure
  message; the user can retry. Actions run sequentially and stop at the first
  failure; retrying runs all actions again, so endpoints should tolerate
  duplicate delivery.

### Payload

Shared by `log`, `post`, and (serialized as text) `mailto`:

```jsonc
{
  "payload_version": 1,                        // payload schema version
  "generator": "yaml-form/1.2.3",              // tool name/version that generated the HTML
  "form": {
    "title": "Test Form",
    "id": "test_form",                         // present only when set in the YAML
    "version": "2.0"                           // present only when set in the YAML
  },
  "submitted_at": "2026-07-18T21:34:56+09:00", // ISO 8601, client clock, local UTC offset
  "answers": { /* see "Submitted data shape" */ }
}
```

`mailto` body — human-readable plain text using item titles:

```
Test Form
=========
Short Text: free text
Multiple Choice: option1, value4
Choice Table:
  sub_question1: scale3
Presentation Rubric:
  Clarity: Competent (2)
  Use of evidence: Expert (3)
```

## Generated HTML

- Valid standalone HTML5 document; all assets inlined; no network access
  needed at generation time or in the browser (except a `post` action's own
  request).
- Reasonable default styling; readable on mobile.
- `choice_table` / `rubric` tables: the header row (scale) and the row-label
  column (questions/criteria) stay fixed while the table scrolls; on screens
  too narrow for that, each row stacks vertically as its own block.
- `required` validation runs client-side before actions.
- `visible_when` is re-evaluated live as the user edits.
