# Task 0013: Submit flow — success/failure announcement, focus, double-submit guard

Status: done
Depends on: 0010
Parallel: yes — group B (owns `src/runtime/submit.ts` + success/error sections in `src/generate/index.ts`)

Issues: #5, #9

## Goal

Submission outcomes are announced to assistive technology with focus managed
across the form→success transition, and the Submit button cannot fire
multiple POSTs while a submission is in flight.

## Context

- Issue #5: `showSuccess` hides the form (dropping focus to `body`);
  `#yaml-form-success` has no `role="status"`; `#yaml-form-error` has no
  `role="alert"`.
- Issue #9: Submit stays enabled during `performSubmit`; no "submitting…"
  indicator.
- Relevant decision: `decisions/0002-actions.md` (submit actions).

## Scope

- `src/generate/index.ts`: success section with `role="status"` and
  `tabindex="-1"`; error section with `role="alert"`.
- `src/runtime/submit.ts`:
  - On success: show section, then `focus()` it.
  - On submit start: disable the Submit button and swap its label to a
    submitting state; re-enable + restore label on failure.
  - Guard against re-entry while a request is pending.
- `src/generate/styles.ts`: disabled-button styling if missing.

## Out of scope

- Localizing "Submitting…" and outcome messages (Task 0015) — keep the
  strings as named constants so 0015 can swap them.
- Success screen visual polish (Task 0020).

## TDD plan

1. **Red** — runtime tests with a mocked/slow fetch: button disabled and
   label swapped while pending; second click during flight causes no second
   request; failure re-enables the button and error section has
   `role="alert"`; success section has `role="status"` and receives focus.
2. **Green** — implement in `submit.ts` + section markup.
3. **Refactor** — single state machine for idle/pending/success/failure.

## Acceptance criteria

- [x] Double-clicking Submit on a slow connection sends exactly one POST
- [x] Success and failure are announced; focus moves to the success section
- [x] Failure leaves the form usable (button re-enabled)
- [x] `bun test` and `bun run typecheck` pass

## Verification

- `bun test tests/runtime` — submit flow coverage
- Manual: throttle network in devtools, double-click Submit, watch the
  network panel; check announcements with a screen reader.
