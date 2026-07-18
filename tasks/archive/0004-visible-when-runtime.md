# Task 0004: visible_when runtime

Status: done (2026-07-18)
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

- [x] Live show/hide works in the generated page for the sample form
- [x] Hidden items excluded from validation and answers
- [x] `bun test` and `bun run typecheck` pass

## Verification

- `bun test tests/runtime/visibility`
- Manual: sample form — select "yes" → comments field appears; rubric clarity
  1/2 → feedback field appears.

## Completion notes (2026-07-18)

- New module `src/runtime/visibility.ts` (bundled into the generated page):
  - `flattenAnswers(raw)` — recursive dotted-key flattening
    (`rubric.row`, `rubric.row.value`/`.comment`); string/array leaves pass
    through so `includes` matches `multiple` answers.
  - `createVisibilityEvaluator(form)` parses every `visible_when` once
    (unparsable rules fail open — generation already rejects them);
    `compute(rawAnswers)` evaluates all rules in one pass per call and
    iterates to a fixed point so a hidden item's excluded answers cascade
    (A hidden → B depending on A's stale answer hides too). Keys a rule
    depends on but that are missing/hidden default to `""` — the engine
    indexes `keyValues[key]` directly.
  - `applyVisibility(doc, map)` toggles the `hidden` attribute on
    `[data-item-id]` sections; `computeVisibility` is a one-shot wrapper.
- `src/runtime/form.ts` (minimal integration): `initForm` builds the
  evaluator, refreshes once at load and on every bubbled `change` event;
  `isItemVisible` now reads the maintained `hidden` attribute (items without
  a rule stay always-visible); `readRawAnswers` feeds all item values to the
  evaluator regardless of visibility.
- Tests in `tests/runtime/visibility.test.ts`: happy-dom live toggle for
  `has_other`/`other_comments`, `includes` on array answers, chained
  visibility (DOM + pure), dotted rubric key via `computeVisibility` (table
  DOM rendering itself is task 0005), and exclusion of hidden items from
  `validateRequired`/`collectAnswers`.
