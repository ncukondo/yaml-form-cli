# Task 0003: HTML generator skeleton + basic items

Status: done (2026-07-18)
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

- [x] Generated file opens from `file://` offline and renders the sample's
      basic items on desktop and mobile widths
- [x] No external resource references in the output
- [x] Required validation works client-side
- [x] `bun test` and `bun run typecheck` pass

## Notes on completion

- `src/generate/`: `index.ts` (`generateHtml(form): Promise<string>` — shell,
  embedded form JSON `script#yaml-form-data`, inlined runtime), `render-item.ts`
  (per-type dispatch; `choice_table`/`rubric` render placeholders until 0005),
  `escape.ts` (HTML escaping + URL auto-linking), `styles.ts` (inline CSS,
  light/dark, mobile-friendly), `runtime-bundle.ts` (bundles the runtime with
  `Bun.build` at generation time, memoized — Node/npm distribution will
  prebuild this in task 0009).
- `src/runtime/`: `form.ts` (readFormData / validateRequired / collectAnswers /
  initForm; visibility hook returns true until 0004; submit success path just
  console.logs until 0006), `main.ts` (browser entry).
- Tests: happy-dom `Window` + `document.write` over the generated string;
  runtime functions imported directly for behavior tests (dispatch events with
  the happy-dom window's own `Event` constructor).
- Answer shapes pinned: text items always present (possibly ""), single choice
  = value or omitted, multiple choice = array or omitted, constant included.

## Verification

- `bun test tests/generate`
- Manual: generate from `examples/sample.yaml` (tables may render as
  placeholders until 0005) and open in a browser.
