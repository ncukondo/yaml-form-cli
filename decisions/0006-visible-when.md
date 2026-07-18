# 0006: `visible_when` rules — engine, flattening, key validation

Date: 2026-07-18
Status: accepted

## Context

Conditional visibility needs an expression language; writing a new one is out
of scope.

## Decision

- Use [`@ncukondo/dynamic-form-rules`](https://github.com/ncukondo/dynamic-form-rules)
  syntax and evaluation (comparison, includes, in, matches, and/or/not,
  anyOf/allOf/noneOf). Note: its README is slightly outdated; the operator
  list follows the current source (`src/schema.ts`, `src/source-parser.ts`).
- Rules see a **flattened view** of `answers`: nested objects become dotted
  keys, recursively (`rubric.row`, `rubric.row.value` with `comment_per_row`).
- Hidden items are excluded from validation and from `answers`.
- **Generation-time rule-key validation**: every key referenced by a
  `visible_when` rule must be a possible answer key (item ids and their dotted
  sub-keys); unknown keys are a generation error.

## Consequences

- No ordering operators (`<`, `>`); "less than" conditions are written by
  enumeration (`in [...]`).
- Typos and stale references (e.g. after toggling `comment_per_row`) fail at
  generation time instead of silently evaluating to false in the browser.
