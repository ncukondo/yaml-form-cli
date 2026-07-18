# Task 0018: choice_table desktop UX — scroll affordance & row/column tracking

Status: done
Depends on: 0016 (styles.ts token/rule churn)
Parallel: no — shares `src/generate/styles.ts`

Issues: #14

## Goal

Wide choice_tables visibly signal that they scroll horizontally, and users
can track which row/column a cell belongs to.

## Context

- Issue #14: overlay scrollbars (macOS/mobile) leave zero scroll cues when
  headers truncate; cells are bare radios (`.cell-choice` hidden on
  desktop) with no zebra striping or hover highlight.

## Scope

- `src/generate/styles.ts`:
  - Scroll-edge fade/shadow on `.table-scroll` — prefer the pure-CSS
    `background-attachment` scroll-shadow technique; fall back to a small
    runtime class toggle (`src/runtime/`) only if CSS alone proves
    insufficient.
  - `tbody tr:hover` background highlight; zebra striping on even rows
    (tokens from 0016, both themes).
  - Optional if cheap: column highlight via `:has()` on cell hover —
    progressive enhancement only, no fallback required.

## Out of scope

- Mobile stacked-layout changes (Task 0019).
- Nested-scroll `max-height` behavior (Task 0020).

## TDD plan

1. **Red** — CSS assertions: scroll-shadow rules on `.table-scroll`; hover
   and zebra rules present with both-theme colors.
2. **Green** — implement.
3. **Refactor** — keep table styles in one clearly-marked section.

## Acceptance criteria

- [x] A 10-column table shows an edge cue whenever more columns exist
      off-screen (both themes, overlay-scrollbar platforms included)
- [x] Hovering a row highlights it; rows are zebra-striped
- [x] Sticky header/label behavior from 0005 unchanged
- [x] `bun test` and `bun run typecheck` pass

## Verification

- `bun test tests/generate`
- Manual: many-column example on macOS (overlay scrollbars) — scroll both
  directions and watch the edge cues.
