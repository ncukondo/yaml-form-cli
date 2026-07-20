# Task 0031: Root-element-scoped runtime

Status: done
Depends on: —
Parallel: no — foundation; 0032/0033/0034 build on the root-scoped entry it introduces

## Goal

The runtime initializes from a root element (`initForm(root)`) instead of the
whole document: every query, listener, and piece of state is resolved within a
`.yaml-form-root` subtree, so a document can host more than one form without
id collisions, cross-form `querySelector` ambiguity, or a shared submit lock.
The existing standalone form's behavior and appearance are unchanged.

## Context

- Relevant decisions: `decisions/0019-runtime-scoping-model.md`
- Prerequisite for CSS scoping (task 0032), submit events (task 0033), and the
  `--fragment` output mode (task 0034).
- **Two kinds of id, handled differently.** *Shell singletons* (`form#yaml-form`,
  `#yaml-form-error`, `#yaml-form-success`, `#yaml-form-draft-notice`,
  `#yaml-form-data`, `#yaml-form-meta`) are only queried by the runtime and are
  **not** referenced by `for`/`aria-*`; most already carry a class
  (`.form-error`, `.form-success`, `.draft-notice`). Drop reliance on their
  global ids and locate them **root-relative** (by class / tag / the
  `application/json` scripts by class), so no prefixing is needed. *A11y ids*
  (`ids.ts`: `label-/input-/desc-/error-<itemId>`, referenced by `for` and
  `aria-describedby`) **must be unique per form** → prefix them `yf-<form.id>-…`.
- **The bootstrap is baked into the bundle.** `runtime.generated.ts` is a single
  minified IIFE built from `main.ts` (`build-runtime.ts`), and `initForm` is
  **not** a global. So the root-discovery bootstrap must live inside `main.ts`
  and ship in the shared bundle — a separate inline `<script>` cannot call
  `initForm`. One bundle serves standalone and (later) fragments.
- Today's singletons to unwind:
  - `src/runtime/form.ts` — the shell selectors above; `readFormData` on
    `#yaml-form-data`.
  - `src/runtime/submit.ts` — `#yaml-form-meta`, `submitButton`, `setError`,
    `showSuccess` selectors; `pendingDocs = new WeakSet<Document>()`.
  - `src/runtime/draft.ts`, `src/runtime/prefill.ts` — read
    `window.location.search` (stays page-global; documented caveat).
  - `src/runtime/table-scroll.ts` — `initTableScroll(doc)` queries `.table-scroll`
    document-wide and adds a `defaultView` (window) `resize` listener.
  - `src/generate/ids.ts` — `input-/label-/desc-/error-<itemId>`, no prefix.
  - `src/runtime/main.ts` — `initForm(document)` bootstrap.
- Tests run under happy-dom; every runtime test uses a local `loadDom` helper
  that calls `initForm(document)` then queries `document.querySelector("#yaml-form-…")`
  (`submit-flow`, `error-announcement`, `focus-on-hide`, `choice-clear`,
  `reduced-motion`, `draft`, `prefill`, `visibility`, `i18n`). All migrate to
  resolve the root and pass it.

## Scope

- `src/runtime/form.ts` — `initForm(root: Element)`; all `doc.querySelector`
  → `root.querySelector`; resolve the owner document/window via
  `root.ownerDocument` / `defaultView` where needed (scroll behavior,
  timers, pagehide). Keep the `form#yaml-form` lookup relative to root.
- `src/runtime/submit.ts` — `performSubmit(root, …)`; `submitButton`/`setError`/
  `showSuccess` query within root; double-submit lock becomes
  `WeakSet<Element>` keyed on root; `readGenerator` reads the meta script
  inside root.
- `src/runtime/form.ts` / `draft.ts` / `prefill.ts` / `table-scroll.ts` —
  take the root (and derive doc/win from it); shell lookups become
  root-relative by class/tag; listeners registered per root.
- `src/generate/ids.ts` — helpers accept a per-form prefix
  (`yf-<form.id>-…`); prefix is empty when `form.id` is absent (standalone
  backward-compatible ids). Prefix is discoverable at runtime from the root
  (its `id`/`data-*`), so `errorId()` reconstructs ids without a doc lookup.
  Shell singletons are **not** routed through these helpers.
- `src/generate/index.ts` — wrap the rendered form in
  `<… class="yaml-form-root" id="yf-<form.id>">` (or a stable wrapper when no
  id); move the data/meta `application/json` scripts **inside** the root and
  locate them by class; emit item ids through the prefixed helpers.
- `src/runtime/main.ts` — the **unified bootstrap** shipped in the shared
  bundle: `const own = document.currentScript?.closest(".yaml-form-root");`
  `own ? initForm(own) : document.querySelectorAll(".yaml-form-root").forEach(initForm)`.
  Standalone (script after `<main class="… yaml-form-root">`) takes the
  fallback branch; the `currentScript` branch is what fragments (task 0034)
  rely on and is exercised end-to-end there. Rebuild via `bun run build:runtime`.
- Tests: update `tests/runtime/*` and `tests/generate/*` to the root-scoped
  entry and the wrapper; add a **two-roots-in-one-document** test proving no
  cross-talk (independent submit, independent error/success, one lock each).

## Out of scope

- `--fragment` CLI output mode and the fragment envelope (task 0034) — this task
  lands the root-scoped runtime, the shared unified bootstrap (incl. the
  `currentScript` branch), and the standalone wrapper only.
- CSS `.yaml-form-root` scoping and `--yf-*` knobs (task 0032).
- Submit `CustomEvent`s (task 0033).
- Per-fragment prefill/draft URL isolation — the page URL stays shared by
  design (documented caveat).

## TDD plan

1. **Red** — migrate the shared `loadDom` helper in each runtime suite to
   resolve `.yaml-form-root` and call `initForm(root)` / `performSubmit(root)`;
   suites must keep asserting the current single-form behavior against the root
   wrapper (shell lookups now root-relative by class/tag).
2. **Green** — thread the root through the runtime modules; derive doc/win from
   `root.ownerDocument`; add the unified `main.ts` bootstrap.
3. **Red** — new `tests/runtime/multi-root.test.ts`: two `.yaml-form-root`
   subtrees in one document; submitting one shows only its success screen and
   leaves the other editable; the in-flight lock on one does not block the
   other; error slots and ids do not collide.
4. **Green** — root-keyed lock, prefixed ids, root-relative data/meta lookup.
5. **Red** — id-prefix tests (`tests/generate`): with `form.id` set, ids are
   `yf-<id>-…` and `for`/`aria-describedby` match; without `id`, ids are the
   current unprefixed form (standalone backward compatible).
6. **Green**, then **Refactor** — one root→doc/win accessor helper shared by the
   runtime modules; keep tests green. Rebuild the runtime bundle.

## Acceptance criteria

- [x] `initForm(root)` / `performSubmit(root, …)` drive the form from a root
      element; standalone output behaves and looks exactly as before
- [x] Two forms in one document operate independently (submit, validation,
      error/success, double-submit lock, ids all isolated)
      — `tests/runtime/multi-root.test.ts`
- [x] Element ids are `yf-<form.id>-…` when `id` is set; unprefixed when absent
- [x] `.yaml-form-data` / `.yaml-form-meta` are read relative to the root, not
      by document id
- [x] `bun run check` passes; runtime bundle rebuilt
- [x] `decisions/0019` linked; no behavior doc changes yet (fragment docs land
      with 0034)

## Verification

- `bun test tests/runtime tests/generate`
- Manual: generate `examples/sample.yaml`, open standalone → unchanged; hand-
  author a page with two root subtrees → confirm independent submit/validation.
