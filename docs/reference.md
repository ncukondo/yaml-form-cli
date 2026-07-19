# yaml-form reference

`yaml-form` converts a YAML form definition into a **single self-contained
HTML file**: no external resources, all CSS/JS inlined, works offline and via
`file://`. The generated page renders the form, validates input, evaluates
conditional visibility, and executes submit actions entirely client-side.

The canonical example is [`examples/sample.yaml`](../examples/sample.yaml);
a Japanese form is at [`examples/sample-ja.yaml`](../examples/sample-ja.yaml).

## CLI

```
yaml-form generate <input.yaml|-> [-o <out.html>] [--json]
yaml-form validate <input.yaml|-> [--json]
yaml-form eval <input.yaml|-> --answers <json|@file|->
yaml-form schema
yaml-form docs [<topic>]
yaml-form example [<name>]
yaml-form upgrade [--dry-run]
```

- `generate` writes the HTML form (stdout by default, `-o` to a file).
- `validate` parses and cross-checks only, reporting every problem at once.
- `eval` prints each item's `visible_when` result for a set of answers,
  computed by the same code the generated form runs (see
  [Testing rules with `yaml-form eval`](#testing-rules-with-yaml-form-eval)).
- `schema` / `docs` / `example` print the JSON Schema, this field reference
  (by topic), and a runnable sample; they work offline so an `npx` or binary
  install is self-documenting.
- Input `-` reads YAML from stdin; `--json` makes a command emit a single
  `{"ok":...}` object (`{"ok":false,"errors":[{code,path,message}]}` on
  failure). Exit codes: `0` success, `1` operation failed, `2` usage error.
  Run `yaml-form --help` for the full contract.

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
| `lang`        | string             | no       | BCP 47 language tag (default `en`); sets `<html lang>` and selects the built-in UI strings (see [Language and UI strings](#language-and-ui-strings-lang-messages)) |
| `messages`    | object             | no       | Per-string overrides of the built-in UI strings |
| `autosave`    | boolean            | no       | Draft autosave to localStorage (default `true`; see [Draft autosave](#draft-autosave)) |
| `noindex`     | boolean            | no       | Emit `<meta name="robots" content="noindex">` (default `true`); set `false` to allow indexing |
| `nofollow`    | boolean            | no       | Emit `nofollow` in the robots meta (default `true`); set `false` to allow link following. When both `noindex` and `nofollow` are `false`, no robots meta is emitted |
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
  Included in submitted data. Extra optional fields (decision 0013):
  - `from_url` (default `false`): allow the value to be overridden by a URL
    query parameter named after the item's `id`; `value` remains the fallback
    when the parameter is absent. See
    [URL-parameter prefill](#url-parameter-prefill).
  - `hidden` (default `false`): don't render the item at all. It still
    participates in submitted data and in `visible_when` rules of other
    items. Combining `hidden` with `visible_when` on the same item is a
    generation error. Only `constant` supports `hidden` — use `visible_when`
    for dynamic hiding of input items.
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
- Literal values compared against a choice-derived key are validated too: a
  comparison a choice can never satisfy (e.g. `role = "Student"` when the
  values are `student` / `resident` / `faculty`) makes the rule constant and
  fails generation. Free-text keys (`short_text`, `long_text`, a rubric
  `.comment`) accept any literal. To confirm a rule behaves as intended for a
  given set of answers, use `yaml-form eval`.

#### Testing rules with `yaml-form eval`

`yaml-form eval <form.yaml> --answers <json>` prints each item's visibility
for a given set of answers, evaluated by the exact code the generated form
runs — so it verifies rule *behavior* the static checks above cannot:

```
$ yaml-form eval form.yaml --answers '{"has_other":"yes"}'
{"ok":true,"visible":{"has_other":true,"other_comments":true, ...}}
```

- Answers are the **nested** answer shape (the same shape the form submits,
  before flattening): a top-level object keyed by item `id`, with
  `choice_table` / `rubric` rows as a nested object
  (`{"presentation_rubric":{"clarity":"1"}}`), and `comment_per_row` rows as
  `{value, comment}`. Multiple-select answers are arrays.
- Every item id appears in `visible`; items without `visible_when` are always
  `true`. Omitted answers count as unanswered (a hidden item's answers are
  excluded from what rules see, so hiding one item can reveal another —
  `eval` resolves this to a fixed point just like the browser).
- `--answers` accepts an inline JSON string, `@file`, or `-` for stdin (the
  form input must then be a file path). Assert expected visibility by
  diffing the JSON — the same way a unit test would.

### URL-parameter prefill

Opening a generated form with query parameters prefills matching fields
before the form is shown (decision 0013):

```
form.html?name=John&role=student&tags=a,b
```

- Parameter names are matched **exactly** against the form's answer keys:
  the item `id` for `short_text` / `long_text` / `choice`, `<id>.<rowKey>`
  for `choice_table` / `rubric` rows, `<id>.<rowKey>.comment` for rubric
  per-row comments (with `comment_per_row: true`), and the item `id` for
  `constant` items with `from_url: true`.
- Choice-like targets match against the choice **`value`** (not `title`).
  Renaming a `value` breaks previously distributed URLs, same as renaming an
  `id`.
- Repeated parameters: single-valued targets take the last occurrence;
  `multiple: true` targets take the union (`?tags=a&tags=b`).
- **Comma shorthand** for `multiple: true` targets: `?tags=a,b` checks both.
  A parameter value is first matched whole against the choice values (so a
  value that itself contains a comma wins), otherwise split on `,`. Text and
  single-select targets are never split.
- Text values are applied verbatim after standard URL decoding (`+` becomes
  a space).
- Unknown parameter names and unmatched choice values are ignored with a
  `console.warn`; prefill never breaks the form and never triggers error
  messages (`required` is still checked only at submit).
- `visible_when` rules see prefilled answers on first render.
- A `constant` item is only overridable when it declares `from_url: true`;
  without it, URL parameters cannot change submitted metadata.

`hidden: true` + `from_url: true` together enable **per-respondent
distribution URLs**: hand each respondent a URL like
`form.html?respondent=r042` and the identifier lands in the submit payload
without an on-screen field.

> **Disclosure note:** a parameter applied to a hidden constant is invisible
> to the respondent. If distribution URLs carry identifiers, you are
> responsible for telling respondents — do not present such a survey as
> anonymous.

### Draft autosave

Answers are autosaved to the browser's localStorage while the user edits
(debounced, flushed when the page is left), so closing the tab does not lose
input (decision 0014). **On by default**; `autosave: false` at the top level
turns it off entirely (no reads, no writes).

- Reopening the same URL — same form `id`/`title`, same `version`, and the
  same recognized query parameters — restores the draft, overlaying any URL
  prefill. Restoring is announced via a `role="status"` notice with a
  **discard** button (message keys `draft_restored` / `draft_discard`);
  discarding deletes the draft, resets the fields in place to the pristine
  prefilled state (no page reload, so it also works where `file://` refuses
  scripted reloads), and turns the notice into a confirmation (message key
  `draft_discarded`).
- A different distribution URL (different recognized parameters, decision
  0013) uses a different storage key and starts pristine — one respondent's
  draft can never leak into another's URL. Unrecognized query noise does not
  affect the key.
- A successful submit deletes the draft — except when the form's actions
  include `mailto`: opening the mail client counts as success but the user
  may still cancel the mail, so the draft is kept as a safety net.
- Constants are never stored; their values come from the YAML/URL. Stale or
  malformed drafts (e.g. after the form changed) apply what still matches
  and ignore the rest. Drafts older than 30 days are pruned. If storage is
  unavailable (privacy mode, quota), autosave turns itself off silently.
- Changing `form.id`, `version`, or choice `value`s orphans existing drafts
  (they stop matching) — bump `version` deliberately when redistributing an
  updated form.

**Recommendation:** set `form.id` when autosave matters. The `title`
fallback is weaker on `file://`, where some browsers give all local files
one shared storage origin.

> **Shared devices:** answers persist in the browser profile until submitted,
> discarded, or pruned. For forms filled in on shared or kiosk machines,
> consider `autosave: false`.

### Language and UI strings (`lang`, `messages`)

`lang` (default `"en"`) is emitted verbatim as `<html lang="…">` and selects
the built-in translation of every fixed UI string. Built-in bundles: `en`,
`ja` (a region subtag like `ja-JP` selects the `ja` bundle). An unknown tag
still sets `<html lang>` but falls back to the English strings — override
them via `messages`.

`messages` overrides individual strings on top of the selected bundle.
Unknown keys are a generation error. `{name}` placeholders are interpolated;
unknown placeholders are left as-is.

| Key               | Placeholders       | English default (`en`) |
| ----------------- | ------------------ | ---------------------- |
| `required`        | `{title}` = item title | `"{title}" is required.` |
| `required_row`    | `{row}` = row title, `{title}` | `"{row}" in "{title}" is required.` |
| `required_legend` | `{mark}` = the `*` required mark | `{mark} indicates required` |
| `submit`          | —                  | `Submit` |
| `submitting`      | —                  | `Submitting…` |
| `submit_failed`   | —                  | `Submission failed. Please try again.` |
| `submit_success`  | —                  | `Your response has been submitted.` |
| `comment`         | `{row}` = row title | `Comment — {row}` |
| `noscript_warning` | —                 | `This form requires JavaScript. Enable JavaScript and reload the page to fill it in.` |
| `clear_selection` | —                  | `Clear selection` |
| `draft_restored`  | —                  | `Restored your previous answers.` |
| `draft_discard`   | —                  | `Discard draft` |
| `draft_discarded` | —                  | `Draft discarded.` |

```yaml
lang: ja
messages:
  required: "「{title}」を入力してください。"
  submit: "回答を送信"
```

`post_submit.message`, when set, takes precedence over
`messages.submit_success`. See
[`examples/sample-ja.yaml`](../examples/sample-ja.yaml) for a complete
Japanese form.

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
- `<html lang="…">` declares the form's language (`lang`, default `en`); all
  fixed UI strings follow it (see
  [Language and UI strings](#language-and-ui-strings-lang-messages)).
- Reasonable default styling; readable on mobile.
- `choice_table` / `rubric` tables: the header row (scale) and the row-label
  column (questions/criteria) stay fixed while the table scrolls; on screens
  too narrow for that, each row stacks vertically as its own block.
- `required` validation runs client-side before actions.
- `visible_when` is re-evaluated live as the user edits.
- Query parameters prefill matching fields at load (see
  [URL-parameter prefill](#url-parameter-prefill)); this works on `file://`
  URLs too.
- Edits are autosaved to localStorage and restored on reopening the same URL
  (see [Draft autosave](#draft-autosave)); disable with `autosave: false`.
