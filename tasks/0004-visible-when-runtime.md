# Task 0004: visible_when runtime

Status: todo
Depends on: 0003
Parallel: yes — group A (owns `src/runtime/visibility*`)

## Goal

Items with `visible_when` show/hide live as the user edits, and hidden items
are excluded from validation and submitted answers.

## Context

- Relevant decisions: `decisions/0006-visible-when.md`
- Engine: `@ncukondo/dynamic-form-rules` (bundled into the generated HTML;
  verify its license/bundle size allows inlining).

## Scope

- `src/runtime/` visibility module: flatten `answers` (recursive dotted keys),
  evaluate rules on every change, toggle item visibility.
- Exclusion of hidden items from required validation and from `answers`.

## Out of scope

- Generation-time rule-key validation (task 0007).

## TDD plan

1. **Red** — tests: `has_other = "yes"` toggle shows/hides `other_comments`;
   dotted-key reference (`presentation_rubric.clarity in [...]`) with a table
   answer; array answers matched via `includes`; hidden item's answer absent
   from collected answers and skipped by required validation; chained
   visibility (item B depends on item A that is itself hidden).
2. **Green** — implement flatten + evaluate + toggle.
3. **Refactor** — single evaluation pass per change event.

## Acceptance criteria

- [ ] Live show/hide works in the generated page for the sample form
- [ ] Hidden items excluded from validation and answers
- [ ] `bun test` and `bun run typecheck` pass

## Verification

- `bun test tests/runtime/visibility`
- Manual: sample form — select "yes" → comments field appears; rubric clarity
  1/2 → feedback field appears.
