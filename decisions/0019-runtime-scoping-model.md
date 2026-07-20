# 0019: Runtime scoping model — root-element-scoped runtime, `--fragment` requires `id`

Date: 2026-07-20
Status: accepted

## Context

The generated runtime is written for **one form per document**. It finds its
pieces through hardcoded singleton selectors and document-wide state:

- `form.ts` queries `form#yaml-form`, `#yaml-form-error`, `#yaml-form-success`,
  `#yaml-form-draft-notice`; `readFormData` reads `#yaml-form-data` and
  `readGenerator` reads `#yaml-form-meta` — all singleton `id`s.
- `submit.ts` keeps the double-submit lock in `pendingDocs = new WeakSet<Document>()`
  — a **per-document** lock.
- `prefill.ts` / `draft.ts` read `window.location.search` globally.
- Element ids (`ids.ts`) are `input-<itemId>`, `label-<itemId>`,
  `desc-<itemId>`, `error-<itemId>` — **no per-form prefix**.

The `--fragment` output mode (#36) places a self-contained form fragment inside
a host page, and must be safe when more than one is present. Every assumption
above breaks with two forms in one document: duplicate `id`s, cross-form
`querySelector` ambiguity, a submit lock that blocks the sibling form, and one
URL query prefilling every fragment. CSS scoping (#37) and submit events (#38)
both need the same unit — "this form's root element" — to exist first. This
runtime shape is therefore the shared prerequisite for all three issues.

## Decision

**1. The runtime is scoped to a root element, not the document.** Introduce a
single entry point `initForm(root: Element)` where `root` is the form's
`.yaml-form-root` element. Every DOM query, listener, and piece of state is
resolved **within `root`** (`root.querySelector(…)`), never against `document`.
The generated markup is wrapped in `<… class="yaml-form-root">`, and the form
shell, embedded data script, error/success/draft slots all live inside it.

**2. Standalone and fragment share one code path.** Standalone output keeps its
current whole-document structure but gains the `.yaml-form-root` wrapper (on the
`<main class="container">` or an inner element); its bootstrap resolves the one
root and calls the same `initForm(root)`. Fragment output emits the same root
subtree without the `<!doctype>`/`<head>` envelope. There is no forked runtime.

**3. A fragment locates its own root via `document.currentScript`.** The
fragment's inlined `<script>` runs synchronously at parse time, so it captures
`document.currentScript` immediately and walks to `.closest(".yaml-form-root")`,
then calls `initForm(root)`. Standalone bootstrap may use the same mechanism or
a `querySelector` on the sole root; both converge on `initForm(root)`.

**4. Per-form data/meta are found relative to the root, not by singleton id.**
`readFormData` / `readGenerator` query the `application/json` script **inside
`root`** (by class, e.g. `script.yaml-form-data` / `script.yaml-form-meta`), so
each fragment reads its own embedded form. The document-level `id`s are dropped.

**5. `id`/`for`/`aria-*` are prefixed per form; `--fragment` requires `id`.**
`ids.ts` helpers take a per-form prefix derived from `form.id` (e.g.
`yf-<form.id>-input-<itemId>`). The prefix is discoverable at runtime from the
root element (its `id`/`data-*`), so `errorId()` and friends reconstruct the
same ids without a document lookup. Because a stable, unique prefix is required
for correctness, **`generate --fragment` errors when `form.id` is absent**
(standalone remains unchanged — `id` stays optional there). Radio/checkbox
`name`s are already grouped per `<form>` element and need no prefix; once
queries are root-scoped their `[name=…]` lookups are unambiguous.

**6. State and listeners are per-root.** The double-submit lock keys on the root
element (`WeakSet<Element>`), not the document. `pagehide`/draft flush is
registered per root. `prefill` / `draft` still read the one page URL — the
documented consequence below.

## Consequences

- A cross-cutting refactor of `form.ts`, `submit.ts`, `draft.ts`, `prefill.ts`,
  `table-scroll.ts`, `visibility.ts`, `main.ts`, and `ids.ts` from `Document` to
  a root `Element`. Behavior for the existing standalone form is unchanged; this
  is validated by the current test suite continuing to pass against the new
  root-scoped entry (a `.yaml-form-root` wrapper is the only structural change).
- `generate --fragment` is a new output mode (its own task/ADR references this
  one) and requires `form.id`; the error is a generation error with a clear
  message. Standalone output keeps `id` optional.
- URL prefill (decision 0013) and its draft-key signature (decision 0014) apply
  the single page URL to **every** fragment sharing an answer key; draft keys
  stay separated by `form.id` + `version`. This is documented as a known
  fragment caveat, not fixed in v1.
- Runtime JS and scoped CSS are **duplicated per fragment** (bytes only). A
  shared-runtime emission mode is explicitly deferred; the duplication and the
  "fetch + innerHTML does not execute the `<script>`" browser rule are
  documented for fragment authors.
- Relative `post`/link URLs (decision 0018) resolve against the **host page**
  URL when embedded, not the form's own origin — documented for fragment use.
