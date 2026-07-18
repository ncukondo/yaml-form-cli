# Task 0003: HTML generator skeleton + basic items

Status: todo
Depends on: 0002
Parallel: no (runtime/render foundations for group A)

## Goal

Generate a valid, self-contained, responsive HTML5 document rendering the
basic item types (`constant`, `short_text`, `long_text`, `choice`) with
client-side `required` validation.

## Context

- Relevant decisions: `decisions/0009-development-process.md`
- Relevant docs: `docs/reference.md` (Generated HTML)
- Constraints: all CSS/JS inlined, no external resources, works via `file://`,
  no build-time network access.

## Scope

- `src/generate/` — document shell, inline CSS baseline (readable on mobile),
  item renderers for the four basic types, form title/description (URL
  auto-linking), answer collection keyed by item id.
- `src/runtime/` — browser-side code (authored in TS, bundled/inlined at
  generation): required validation with per-item messages.
- Test approach for generated output: DOM assertions via happy-dom (or
  equivalent) on the generated string.

## Out of scope

- choice_table / rubric rendering (task 0005)
- visible_when (task 0004), actions & submit flow (task 0006)

## TDD plan

1. **Red** — tests: output is a single HTML document with no external
   `src`/`href`; each basic item renders with label/description; required
   short_text blocks submit and shows a message; answers object shape for
   basic items (choice single = value, multiple = array; constant included).
2. **Green** — shell + renderers + runtime bundling.
3. **Refactor** — split per-item renderer modules so task 0005 can add table
   renderers without touching existing files.

## Acceptance criteria

- [ ] Generated file opens from `file://` offline and renders the sample's
      basic items on desktop and mobile widths
- [ ] No external resource references in the output
- [ ] Required validation works client-side
- [ ] `bun test` and `bun run typecheck` pass

## Verification

- `bun test tests/generate`
- Manual: generate from `examples/sample.yaml` (tables may render as
  placeholders until 0005) and open in a browser.
