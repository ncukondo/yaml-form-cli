# Task 0007: Generation-time rule-key validation

Status: todo
Depends on: 0002
Parallel: yes — group A (owns `src/schema/rule-keys*`)

## Goal

Generation fails with a clear error when a `visible_when` rule references a
key that no item can produce.

## Context

- Relevant decisions: `decisions/0006-visible-when.md`,
  `decisions/0005-rubric.md` (`comment_per_row` changes the key space)
- Rule parsing: reuse `@ncukondo/dynamic-form-rules`' parser to extract
  referenced keys (including anyOf/allOf/noneOf key lists).

## Scope

- Compute the possible answer-key set from a parsed form: item ids; table/
  rubric `<item_id>.<row_key>`; with `comment_per_row`,
  `<item_id>.<row_key>.value` / `.comment` (and the bare `<item_id>.<row_key>`
  becomes invalid).
- Validate every `visible_when` expression's keys against that set; report
  unknown keys with the referencing item's path. Syntax errors in expressions
  are also generation errors.

## Out of scope

- Runtime evaluation (task 0004).

## TDD plan

1. **Red** — tests: valid sample passes; typo key fails naming the item;
   `comment_per_row: true` makes `rubric.row` invalid and `.value` valid;
   unparsable expression reported with its item path.
2. **Green** — key-space computation + check.
3. **Refactor** — share key-space code with the answer-collection docs/tests.

## Acceptance criteria

- [ ] Unknown or stale rule keys fail generation with item path + key name
- [ ] `bun test` and `bun run typecheck` pass

## Verification

- `bun test tests/schema/rule-keys`
