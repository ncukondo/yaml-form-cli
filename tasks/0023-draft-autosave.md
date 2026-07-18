# Task 0023: Draft autosave to localStorage

Status: done
Depends on: 0022
Parallel: no — extends 0022's runtime modules and the page skeleton

## Goal

Editing a form autosaves answers to localStorage; reopening the same URL
(same recognized parameters) restores them with an announced, discardable
notice; a successful submit clears the draft. `autosave: false` turns the
feature off.

## Context

- Relevant decisions: `decisions/0014-draft-autosave.md` (key format, save/
  restore/clear rules, mailto exception), `decisions/0013-url-prefill.md`
  (recognized-parameter set, value application), `decisions/0010-i18n.md`
  (message bundles/overrides).
- Reuses from 0022: the valid-key enumeration (for the param signature) and
  the value-application functions in `src/runtime/prefill.ts`.
- Submit success/failure flow: `src/runtime/submit.ts` (`applySubmitState`);
  mailto success semantics in `src/runtime/actions.ts`.
- Runtime tests run under happy-dom; happy-dom provides `localStorage` per
  Window, so tests can seed and inspect drafts directly.

## Scope

- `src/schema/form-schema.ts` — form-level `autosave` (boolean, default
  true); regenerate `schema/yaml-form.schema.json`.
- `src/runtime/draft.ts` (new) — key building (param signature), debounced
  save, restore, clear, 30-day pruning, storage-failure guard.
- `src/runtime/form.ts` — wiring: restore after prefill / before first
  visibility pass; save on edit; flush on `pagehide`.
- `src/runtime/submit.ts` — clear draft on success (skip when actions
  include `mailto`).
- `src/generate/index.ts` (page skeleton) — hidden restore-notice slot with
  discard button.
- `src/messages.ts` + messages schema — `draft_restored`, `draft_discard`
  keys in `en`/`ja` bundles and overrides.
- `docs/reference.md`, `README.md`, `examples/sample.yaml`.
- Tests: `tests/schema/`, `tests/generate/`, `tests/runtime/draft.test.ts`.

## Out of scope

- Cross-device / server-side draft sync.
- A TTL other than the fixed 30-day pruning.
- Restoring across changed `form.id` / `version` (a mismatch is a miss by
  design).
- sessionStorage or IndexedDB fallbacks.

## TDD plan

1. **Red** — schema tests: `autosave` accepted at form level, defaults to
   true, rejected on items; JSON Schema exposes it.
2. **Green** — schema + regenerated JSON Schema.
3. **Red** — draft-store unit tests (`tests/runtime/draft.test.ts`):
   - key includes `id ?? title`, `version ?? ""`, and the canonical param
     signature (sorted keys, repeated values in order, unknown params
     excluded — same recognizer as prefill);
   - no write before the first edit; debounced write after edits; flush on
     `pagehide`;
   - stored shape `{ saved_at, answers }`; constants not stored;
   - restore applies text/choice/table/comment values; malformed JSON,
     unknown ids, and out-of-set values are skipped without breaking;
   - restore happens only on exact key hit (different params → no restore);
   - draft overlays prefill for overlapping fields; visibility reflects
     restored answers on first render;
   - notice shown with `role="status"` on restore, absent otherwise;
     discard removes the draft and reloads;
   - entries older than 30 days pruned at init;
   - `autosave: false` → no reads, no writes, no notice;
   - storage throwing (quota/disabled) disables autosave silently.
4. **Green** — implement `draft.ts` + `initForm` wiring + notice slot.
5. **Red** — submit-flow tests: success clears the draft for `log`/`post`;
   success with a `mailto` action keeps it; failure keeps it.
6. **Green** — clear hook in the submit success path.
7. **Red** — i18n tests: both bundles carry the new keys; `messages`
   overrides apply; skeleton contains the notice slot.
8. **Green**, then **Refactor** — share the param-recognizer/apply helpers
   with `prefill.ts` cleanly; keep tests green.

## Acceptance criteria

- [x] Edit → close → reopen same URL restores answers, with a visible,
      screen-reader-announced notice and a working discard button
- [x] Opening a different distribution URL (different recognized params)
      starts pristine
- [x] Successful `post`/`log` submit clears the draft; `mailto` submit and
      failed submits keep it
- [x] Untouched forms write nothing; `autosave: false` disables everything
- [x] Corrupt or stale drafts never break rendering
- [x] `bun run check` passes
- [x] `docs/reference.md` documents autosave incl. the shared-device warning
      and the `form.id` recommendation; example/README updated

## Verification

- `bun test tests/runtime/draft.test.ts tests/schema tests/generate`
- Manual: generate `examples/sample.yaml`, open with `?respondent=r001`,
  type answers, close the tab, reopen the same URL → restored + notice;
  open with `?respondent=r002` → pristine; submit (log action) → draft gone
  after success screen.
