# Task 0033: Submit-completion `CustomEvent`s (#38)

Status: done
Depends on: 0031 (fires on the root element from the root-scoped `performSubmit`)
Parallel: yes — disjoint from task 0032 (submit.ts vs styles.ts); both land after 0031

## Goal

When a submit attempt settles, the form dispatches a bubbling `CustomEvent` on
its root element — `yaml-form:submit-success` or `yaml-form:submit-error` — so a
host page (or same-origin iframe parent) can advance progress, jump to the next
form, or log the result without watching DOM mutations (issue #38).

## Context

- Relevant decisions: `decisions/0021-submit-events.md` (event names,
  `bubbles:true`/`composed:false`, `detail` shapes, fire-once-after-UI,
  standalone + mailto behavior).
- Builds on the root-scoped `performSubmit(root, …)` from task 0031.
- `src/runtime/submit.ts` — `performSubmit` builds the `SubmitPayload` and gets
  `runActions`' result (`{ ok:true } | { ok:false; message }` from
  `src/runtime/actions.ts`); no `actions.ts` change is needed.

## Scope

- `src/runtime/submit.ts`:
  - On success (after `applySubmitState` success and after `onSuccess`),
    dispatch `yaml-form:submit-success` on root with
    `detail: { form: { id, version }, payload }`. `id`/`version` mirror the
    payload's `form` (both optional — `undefined` for a standalone form without
    them; always present in `--fragment`, which requires `id`).
  - On failure (after the failure UI), dispatch `yaml-form:submit-error` with
    `detail: { form: { id, version }, message }` (the `runActions` message).
  - Both `bubbles: true`, `composed: false`, fired once per settled submit.
    mailto counts as success (unchanged UI semantics).
- Docs: `docs/reference.md` — a public "submit events" section (names +
  `detail` shapes + iframe note).
- Tests: `tests/runtime/submit-flow.test.ts` (or a new
  `tests/runtime/events.test.ts`).

## Out of scope

- A `submit-start`/pending event (deferred, decision 0021).
- `postMessage` iframe channel (the same event on `iframe.contentDocument`
  covers it).
- Changing `runActions`' return shape or per-action reporting.

## TDD plan

1. **Red** — event tests:
   - success (`log`/`post`) dispatches `yaml-form:submit-success` once, on the
     root, `detail.payload` equals the built payload, `detail.form` carries
     `id`/`version`, and it bubbles to `document`;
   - a failing `post` dispatches `yaml-form:submit-error` once with
     `detail.message` = the action failure reason, bubbling to `document`;
   - `mailto` dispatches `submit-success`;
   - the double-submit guard means a second in-flight submit dispatches nothing.
2. **Green** — add the two dispatch points in `performSubmit`.
3. **Refactor** — a small `dispatch(root, type, detail)` helper; keep the
   fire-once ordering relative to `applySubmitState`. Rebuild the runtime bundle.

## Acceptance criteria

- [ ] `yaml-form:submit-success` fires once on success with
      `detail: { form:{id,version}, payload }`, bubbling to `document`
- [ ] `yaml-form:submit-error` fires once on failure with
      `detail: { form:{id,version}, message }`, bubbling to `document`
- [ ] mailto success fires `submit-success`; standalone forms fire with no
      listener attached and are otherwise unaffected
- [ ] No `actions.ts` change; `bun run check` passes; runtime bundle rebuilt
- [ ] `docs/reference.md` documents the event contract

## Verification

- `bun test tests/runtime/submit-flow.test.ts tests/runtime`
- Manual: generate a form with a `log` action, attach a `document` listener for
  `yaml-form:submit-success`, submit → listener fires with the payload; point
  `post` at an unreachable URL → `yaml-form:submit-error` with the reason.
