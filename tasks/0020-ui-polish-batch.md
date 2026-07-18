# Task 0020: UI polish batch — constant styling, print, :has() fallback, success screen, focus-visible, nested scroll

Status: done
Depends on: 0013 (success screen markup), 0016, 0018 (styles.ts churn)
Parallel: no — touches `styles.ts`, `render-item.ts`, success section

Issues: #16

## Goal

Land the minor appearance fixes bundled in issue #16.

## Context / Scope

Sub-items (issue #16):

1. **constant item styling** — `src/generate/render-item.ts:12-14` /
   `.constant-value`: info-box treatment (background + border) so it reads
   as content, not a disabled field.
2. **Print styles** — `@media print`: undo `.table-scroll` max-height/
   overflow so tables paginate; hide interactive-only chrome as sensible.
3. **`:has()` fallback** — mobile comment-row merge
   (`src/generate/styles.ts:205`): provide a fallback for non-supporting
   browsers or document the double-border as accepted (decide in-task,
   note in code comment).
4. **Success screen** — card treatment + checkmark on the 0013 success
   section (pure CSS/inline SVG; no external assets).
5. **Button `:focus-visible` / `:active`** — accent focus ring matching
   text inputs; pressed state.
6. **Nested table scroll** — only apply `max-height: 75vh` when the table
   is actually tall (e.g. row-count threshold class from the renderer), so
   short tables don't trap wheel scrolling.

## Out of scope

- New schema surface; behavior changes beyond CSS/markup.

## TDD plan

1. **Red** — generator/CSS assertions per sub-item: constant-value box
   rules; `@media print` block resetting `.table-scroll`; fallback (or
   documented acceptance) for `:has()`; success-section classes; button
   `:focus-visible` rule; max-height gated by the threshold marker.
2. **Green** — implement.
3. **Refactor** — one commit per sub-item.

## Acceptance criteria

- [x] All six sub-items addressed (fallback implemented as a separate
      `@supports not selector(:has(*))` rule)
- [x] Print preview of a long-table form shows complete tables
- [x] `bun test` and `bun run typecheck` pass

## Verification

- `bun test tests/generate`
- Manual: print preview; keyboard-tab to the Submit button; short-table
  example scrolls the page, not the table.
