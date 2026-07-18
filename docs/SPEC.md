# yaml-form-cli Specification (Draft)

Status: **draft — under discussion**. Decided points are marked as such;
remaining proposals are marked **(proposal)**.

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
- **`choice_table`** — matrix of questions sharing one scale. Extra fields:
  - `items` (required): column headers — the individual questions. Each is a
    string or `{ title, id? }`. The per-column `id` (unique within the item)
    overrides the key segment used in submitted data; otherwise the title is
    used.
  - `choices` (required): row headers — the shared scale. Same value rules as
    `choice`.
  - `multiple` (default `false`).
- **`rubric`** — like `choice_table`, but each cell has its own descriptor text.
  - `levels` (required): columns; `{ title, value }[]`. `value` is the
    submitted value.
  - `criteria` (required): rows; each is `{ id, title, descriptors, allow_na? }`.
    `id` is required and unique **within the rubric** (referenced as
    `<rubric_id>.<criterion_id>`). `descriptors` has one entry per level, in
    level order. `allow_na: true` adds an N/A column, submitted as `"N/A"`.
  - `comment_per_criterion` (default `false`): adds a free-text box under each
    row, submitted as `<criterion_id>_comment` within the rubric's answers.
  - No score computation (decided): instead of a computed score, the selected
    level values are submitted per criterion as a structured set (see below).

### Submitted data shape

`answers` is an object keyed by item `id`:

```jsonc
{
  "constant_test": "value",
  "id_sample": "free text",
  "single_choice": "option2",
  "multiple_choice": ["option1", "value4"],   // multiple: array of values
  "choice_table_sample": {                    // choice_table: per-column object
    "option1": "scale3",
    "opt8": "scale1"                          // column with explicit id
  },
  "presentation_rubric": {                    // rubric: per-criterion object
    "clarity": "2",
    "evidence": "N/A",
    "clarity_comment": "..."                  // when comment_per_criterion: true
  }
}
```

- Hidden items (via `visible_when`) are excluded from validation and from
  `answers`.
- `required` on a rubric means every visible criterion must be answered
  (selecting N/A counts as answered).

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

Rules see a **flattened view** of `answers`: nested objects become dotted keys
(`presentation_rubric.clarity`, `choice_table_sample.option1`). Dots are safe
characters in unquoted rule keys, so these can be referenced directly:

```
presentation_rubric.clarity in ["1","2","N/A"]
```

Array answers (`multiple: true`) are matched with `includes` / `notIncludes`.

Quoting: keys/values may be unquoted if they contain only safe characters
(no `, = ( ) < > [ ]`, quotes, or whitespace); otherwise use single or double
quotes. A quote inside a quoted value is escaped by doubling (`'it''s ok'`).

Note: the rule engine has no ordering operators (`<`, `>`), so conditions like
"less than" must be expressed by enumeration (`in [...]`).

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
  message; the user can retry. **(proposal)** actions run sequentially and stop
  at the first failure; retrying runs all actions again (endpoints should
  tolerate duplicate delivery).

**Payload (proposal)** — shared by `log`, `post`, and (serialized as text)
`mailto`:

```jsonc
{
  "form": { "title": "Test Form" },
  "submittedAt": "2026-07-18T12:34:56.789Z", // ISO 8601, client clock
  "answers": { /* see "Submitted data shape" */ }
}
```

**`mailto` body format (proposal)** — human-readable plain text using item
titles:

```
Test Form
=========
Short Text: free text
Multiple Choice: option1, value4
Choice Table:
  option1: scale3
Presentation Rubric:
  Clarity: Competent (2)
  Use of evidence: N/A
```

## Generated HTML requirements

- Valid standalone HTML5 document; all assets inlined.
- Reasonable default styling; readable on mobile (responsive).
- Client-side `required` validation before actions run.
- `visible_when` re-evaluated live as the user edits.
- Success screen shows `post_submit.message` (see result handling above).
- No build-time network access: generation must work fully offline.

## Remaining proposals to confirm

1. `post`/`log` payload shape (`{ form, submittedAt, answers }` above).
2. `mailto` body format (plain text with titles, above).
3. Multi-action failure handling (sequential, stop at first failure, full
   retry).
