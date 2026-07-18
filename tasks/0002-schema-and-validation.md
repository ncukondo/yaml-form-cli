# Task 0002: Form schema types, validation, and JSON Schema

Status: todo
Depends on: 0001
Parallel: no (defines the types everything else consumes)

## Goal

Parse a YAML form definition into typed data or a list of clear
generation-time errors, and emit a JSON Schema for editor support from the
same source.

## Context

- Relevant decisions: `decisions/0003-item-ids-required.md`,
  `decisions/0004-choice-table.md`, `decisions/0005-rubric.md`,
  `decisions/0007-submit-payload.md` (top-level `id`/`version`),
  `decisions/0008-json-schema.md`
- Relevant docs: `docs/reference.md` (YAML format)
- Canonical fixture: `examples/sample.yaml`

## Scope

- `src/schema/` — schema definition (pick a validation library with JSON
  Schema export, e.g. zod v4 `z.toJSONSchema`; record the choice in the task
  on completion), YAML loading, structural validation.
- Cross-field generation-time checks the schema can't express: unique item
  ids; unique row keys within `choice_table`/`rubric`; `constant` requires
  `value`; rubric `descriptors` count == `choices` count; `multiple` forbidden
  on rubric.
- JSON Schema emission (build script → `schema/yaml-form.schema.json`).
- Add `# yaml-language-server: $schema=…` reference to `examples/sample.yaml`.

## Out of scope

- `visible_when` parsing/key validation (task 0007).
- HTML generation (task 0003).

## TDD plan

1. **Red** — tests: `examples/sample.yaml` parses; each invalid fixture
   (duplicate id, descriptor count mismatch, rubric+multiple, missing
   constant value, missing title/id, unknown type) yields its specific error
   with the item path.
2. **Green** — schema + checks.
3. **Refactor** — error type with stable codes + human messages.

## Acceptance criteria

- [ ] `examples/sample.yaml` parses into typed form data
- [ ] All invalid fixtures produce path-qualified, actionable errors (all
      errors reported at once, not first-only)
- [ ] `schema/yaml-form.schema.json` generated from the runtime schema; sample
      YAML references it and validates cleanly in yaml-language-server
- [ ] `bun test` and `bun run typecheck` pass

## Verification

- `bun test tests/schema` — parse + error cases
- Open `examples/sample.yaml` in an editor with the YAML LS and confirm
  completion/diagnostics.
