# Task 0034: `generate --fragment` output mode (#36)

Status: todo
Depends on: 0031 (root-scoped runtime + prefixed ids), 0032 (scoped CSS), 0033 (submit events)
Parallel: no — integrates 0031–0033 and shares `generate/index.ts` + CLI + schema

## Goal

`yaml-form generate --fragment` emits a self-contained form fragment — a
`.yaml-form-root` `<div>` carrying scoped `<style>`, the `<form>`, the embedded
data/meta, and the **shared runtime bundle** `<script>` placed inside the root
so its baked-in `document.currentScript` bootstrap (task 0031) initializes that
root — compositable into a host page at build time, safely more than once per
document. `form.id` is required in this mode (issue #36).

## Context

- Relevant decisions: `decisions/0019-runtime-scoping-model.md` (`id` required,
  duplication/URL caveats), `0020` (scoped CSS + standalone-only body block),
  `0021` (events).
- The `currentScript`-vs-fallback bootstrap already lives in `main.ts` and ships
  in the shared bundle (task 0031); `initForm` is **not** a global, so this task
  writes **no** new bootstrap code — it only places the same bundle `<script>`
  inside the root and drops the document envelope.
- `src/cli.ts` — `parseGenerateArgs` / `cmdGenerate` (add `--fragment`).
- `src/generate/index.ts` — currently emits a full `<!doctype>` document; add a
  fragment assembly reusing the same root subtree without the head/envelope and
  the standalone `body` reset (task 0032's scoped core + `draftStyles` only).
- `src/schema` / generation — enforce `form.id` presence for `--fragment`.

## Scope

- `src/cli.ts` — `--fragment` flag on `generate`; `--fragment` with a form that
  has no `id` is a generation error with a clear message; `--json` result
  unchanged in shape.
- `src/generate/index.ts` — a fragment renderer: `.yaml-form-root` div with the
  scoped `<style>` (core + `draftStyles`, **no** standalone `body` block), the
  header/form/success subtree, the `application/json` data+meta scripts inside
  the root, and the **shared runtime bundle** `<script>` inside the root (its
  `currentScript` bootstrap self-initializes that root). Factor a common
  root-subtree renderer shared with standalone so only the envelope differs.
- Docs: `docs/reference.md` + embedded docs — a "fragment output" section: the
  build-time composition model, `id` requirement, and the documented caveats
  (runtime/CSS byte duplication; one page URL prefills every fragment sharing an
  answer key; relative `post`/link URLs resolve against the host page;
  fetch+innerHTML does not execute the `<script>` — build-time only).
- Tests: `tests/generate/` (fragment structure, no doctype/head, `id`-required
  error, currentScript bootstrap present) and a `tests/runtime` composition test
  loading two generated fragments into one document.

## Out of scope

- A shared-runtime / de-duplicated emission mode (deferred, decision 0019).
- A dynamic compile+mount library API (future; the `<script>` runs only under
  build-time composition, not `fetch`+`innerHTML`).
- Per-fragment prefill/draft URL isolation (page URL stays shared).

## TDD plan

1. **Red** — CLI: `generate --fragment form-with-id.yaml` emits a fragment (no
   `<!doctype>`/`<head>`, a `.yaml-form-root` root, inline scoped `<style>`,
   data+meta and the runtime bundle `<script>` inside the root, no standalone
   `body` block); `generate --fragment` on an id-less form exits non-zero with a
   clear message; standalone `generate` is unchanged.
2. **Green** — fragment renderer + CLI flag + id-required guard.
3. **Red** — composition test: inject two generated fragments (distinct
   `form.id`) into one happy-dom document, run their IIFE bootstraps, and assert
   independent init, ids, submit, and events (reuses task 0031's multi-root
   guarantees end-to-end).
4. **Green**, then **Refactor** — share the root subtree renderer between
   standalone and fragment so only the envelope differs; keep tests green.
   Rebuild bundle/embedded docs.

## Acceptance criteria

- [ ] `generate --fragment` emits a self-contained `.yaml-form-root` fragment
      (scoped style, form, data/meta, shared runtime bundle inside the root)
      with no document envelope
- [ ] `--fragment` without `form.id` is a generation error (exit 1) with a clear
      message; standalone stays `id`-optional and unchanged
- [ ] Two fragments composited into one page initialize and operate
      independently (ids, submit, validation, events)
- [ ] Docs cover the composition model, `id` requirement, and all caveats
- [ ] `bun run check` passes; runtime bundle + embedded docs rebuilt

## Verification

- `bun test tests/generate tests/runtime`
- Manual: `generate --fragment` two forms, paste both into one static HTML page,
  open it → both render, submit independently, each fires its own
  `yaml-form:submit-success`; host `body`/`h1`/`a` styles untouched.
