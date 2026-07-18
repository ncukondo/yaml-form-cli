# yaml-form-cli Specification (Archived)

Status: **archived.** All points were decided and the content has been
migrated: user-facing behavior → [`docs/reference.md`](../../docs/reference.md),
decision rationale → [`decisions/`](../). This file is kept as a historical
record and is no longer maintained.

## Overview

`yaml-form-cli` is a command-line tool that converts a YAML form definition
into a **single self-contained HTML file**:

- No external resources (no CDN scripts, stylesheets, fonts, or images).
  All CSS/JS is inlined; the file works offline and when opened via `file://`.
- The generated page renders the form, validates input, evaluates conditional
  visibility, and executes submit actions — entirely client-side.

The YAML schema is based on the form definition used in
[flexible-form](https://github.com/ncukondo/flexible-form), extended with a
`rubric` item type. The canonical example is [`examples/sample.yaml`](../../examples/sample.yaml).

## CLI

```
yaml-form <input.yaml> [-o <output.html>]

Options:
  -o, --output <file>   Write HTML to file (default: stdout)
  -h, --help            Show help
  --version             Show version

Subcommands:
  yaml-form upgrade     Self-upgrade to the latest released version
```

### Distribution (decided)

Both of the following, released from the same version tag:

- **npm package** — run via `bunx yaml-form` / `npx yaml-form`, upgraded
  through the package manager.
- **Single-file executable** — built with `bun build --compile` per platform,
  attached to GitHub Releases. `yaml-form upgrade` downloads and replaces the
  running binary with the latest release.

> Note: automatic binary download requires the GitHub repository (or at least
> its releases) to be public, or a token to be configured. To revisit before
> the first release.

## YAML schema

### Top level

| Field         | Type                | Required | Description |
| ------------- | ------------------- | -------- | ----------- |
| `title`       | string              | yes      | Form title |
| `id`          | string              | no       | Form identifier, echoed into the submit payload as `form.id` |
| `version`     | string              | no       | Form definition version, echoed into the submit payload as `form.version` |
| `description` | string              | no       | Multi-line supported; URLs are auto-linked |
| `actions`     | action[] \| action  | no       | Actions executed on submit (see below). A single mapping is treated as a one-element array |
| `post_submit` | object              | no       | `message`: text displayed on the success screen |
| `items`       | item[]              | yes      | Form items in display order |

### Common item fields

| Field          | Type    | Required | Description |
| -------------- | ------- | -------- | ----------- |
| `type`         | string  | no       | One of `constant`, `short_text`, `long_text`, `choice`, `choice_table`, `rubric`. Defaults to `short_text` |
| `title`        | string  | yes      | Item label |
| `id`           | string  | **yes**  | Unique key across the form; used in submitted data and `visible_when` rules (decided: required for every item) |
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
  A choice is either a string or `{ title, value? }`; the submitted value is
  `value` if given, otherwise `title`.
- **`choice_table`** — matrix of questions sharing one scale. Questions are
  **rows**, the scale is **columns** (decided). Extra fields:
  - `items` (required): rows — the individual questions. Each is a string or
    `{ title, id? }`. The per-row `id` overrides the key segment used in
    submitted data; when omitted, the title serves as the key and is subject
    to the same constraints as an `id` (decided). Either way the key must be
    unique within the item.
  - `choices` (required): columns — the shared scale. Same value rules as
    `choice`.
  - `multiple` (default `false`): allow multiple selections per row
    (checkboxes instead of radios).
  - `required` (decided): every row must have at least one selection.
- **`rubric`** — a `choice_table` whose rows additionally carry per-cell
  descriptor text (decided: same structure and field names as `choice_table`;
  the former `levels` / `criteria` / `allow_na` fields are removed). Rows =
  `items`, columns = `choices`; key rules, submitted shape, and `required`
  semantics are those of `choice_table`. Differences:
  - Each row is `{ id?, title, descriptors }`. `descriptors` (required) has
    exactly one entry per column, in column order — the cell text for that
    row. A count mismatch with `choices` is a generation-time error.
  - `multiple` is not allowed (generation-time error).
  - `comment_per_row` (default `false`): adds a free-text box under each row.
    When `true`, each row's answer is submitted as
    `{ "value": <selected value>, "comment": <text> }` (comment omitted when
    empty) instead of the bare value, referenced from rules as
    `<rubric_id>.<row_id>.value` / `<rubric_id>.<row_id>.comment`.
  - An N/A option is not special: model it as a regular column, e.g.
    `{ title: "N/A", value: "NA" }`, giving it a descriptor in each row.
  - No score computation (decided): the selected values are submitted per row
    as a structured set (see below).

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
    "sub_question1": ["scale1", "scale3"],
    "sub_question2": ["scale2"]
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

- Hidden items (via `visible_when`) are excluded from validation and from
  `answers`.
- `required` on `choice_table` / `rubric` means every row must have at least
  one selection.

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

Rules see a **flattened view** of `answers`: nested objects become dotted keys,
recursively (`presentation_rubric.clarity`, `choice_table_sample.sub_question1`,
and with `comment_per_row: true`, `presentation_rubric.clarity.value`). Dots are
safe characters in unquoted rule keys, so these can be referenced directly:

```
presentation_rubric.clarity in ["1","2"]
```

Array answers (`multiple: true`) are matched with `includes` / `notIncludes`.

Quoting: keys/values may be unquoted if they contain only safe characters
(no `, = ( ) < > [ ]`, quotes, or whitespace); otherwise use single or double
quotes. A quote inside a quoted value is escaped by doubling (`'it''s ok'`).

Note: the rule engine has no ordering operators (`<`, `>`), so conditions like
"less than" must be expressed by enumeration (`in [...]`).

**(decided)** At generation time, rule keys are validated against the set of
possible answer keys (item ids and their dotted sub-keys); an unknown key is a
generation error. This catches stale references — e.g. after toggling
`comment_per_row`, which changes `<rubric_id>.<row_id>` to
`<rubric_id>.<row_id>.value`.

### Actions (decided: explicit `type` objects)

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
| `log`    | Log the payload to the **browser console** (decided). Always succeeds. Useful for testing |
| `post`   | `POST` the payload as JSON (`Content-Type: application/json`) via `fetch`. Success = HTTP 2xx |
| `mailto` | Build a `mailto:` URL with the answers serialized into the body and open it. The user's mail client opens with the message pre-filled; the user sends it manually |

`mailto` caveats (documented limitations, kept in spec):

- URL length is effectively limited (~2000 chars); long forms may be truncated.
- Whether the mail was actually sent cannot be detected; opening the mail
  client is treated as success.

**Result handling (decided):**

- On success of all actions: replace the form with a success screen showing
  `post_submit.message` (default message if unset).
- On failure: stay on the form (input preserved) and show a submission-failure
  message; the user can retry. Actions run sequentially and stop at the first
  failure; retrying runs all actions again (endpoints should tolerate duplicate
  delivery) (decided).

**Payload (decided)** — shared by `log`, `post`, and (serialized as text)
`mailto`. Keys are snake_case, matching the YAML schema:

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

**`mailto` body format (decided)** — human-readable plain text using item
titles:

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

## Generated HTML requirements

- Valid standalone HTML5 document; all assets inlined.
- Reasonable default styling; readable on mobile (responsive).
- `choice_table` / `rubric` tables (decided): the header row (scale/levels)
  and the row-label column (questions/criteria) stay fixed (sticky) while the
  table body scrolls. When the table still cannot be displayed usefully
  (narrow screens), fall back to stacking each row vertically as its own
  block (question label followed by its options).
- Client-side `required` validation before actions run.
- `visible_when` re-evaluated live as the user edits.
- Success screen shows `post_submit.message` (see result handling above).
- No build-time network access: generation must work fully offline.

## Remaining proposals to confirm

None — all points are decided. See the `decisions/` directory for the record
of each decision.
