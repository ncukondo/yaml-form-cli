# 0021: Submit-completion events — bubbling `CustomEvent`s on the root element

Date: 2026-07-20
Status: accepted

## Context

A host page that embeds a form (fragment, decision 0019; or a same-origin
iframe) wants to react to a submission completing — advance a progress bar, jump
to the next form, log the result. Today the only signal is the DOM mutation when
`showSuccess` swaps the form for the success screen; watching for that with a
`MutationObserver` is brittle and undocumented.

`runActions` already distinguishes success from failure and carries a failure
`message` (`actions.ts`: `{ ok: true } | { ok: false; message }`), and
`performSubmit` builds the full `SubmitPayload`. The information a host needs
exists; it just isn't surfaced.

## Decision

**1. Fire a `CustomEvent` on the root element when a submit attempt settles.**
On success:

```js
root.dispatchEvent(new CustomEvent("yaml-form:submit-success", {
  bubbles: true,
  detail: { form: { id, version }, payload },
}));
```

On failure:

```js
root.dispatchEvent(new CustomEvent("yaml-form:submit-error", {
  bubbles: true,
  detail: { form: { id, version }, message },
}));
```

- **Names**: `yaml-form:submit-success` / `yaml-form:submit-error`. Only these
  two for v1 — no `submit-start`/pending event (the disabled button already
  signals in-flight state; a start event has no consumer yet).
- **`bubbles: true`** so a host can delegate from `document` and cover every
  fragment (decision 0019) with one listener. **`composed` is false**: Shadow
  DOM is out of scope (decision 0020), so events need not cross shadow
  boundaries.
- **`submit-success.detail`**: `{ form: { id, version }, payload }`, where
  `payload` is the exact `SubmitPayload` sent to `post` (answers included). The
  host already embeds and can read the form, so exposing answers here is not a
  new disclosure.
- **`submit-error.detail`**: `{ form: { id, version }, message }`, `message`
  being the failing action's reason from `runActions` (e.g. the `post` status
  line). The first failing action stops the run (existing behavior), so a single
  reason is reported.

**2. Fire once per settled attempt, after the UI state is applied.** The event
dispatches in `performSubmit` right after `applySubmitState` resolves the
success/failure UI (and after `onSuccess` clears the draft on success), so a
listener observes a consistent DOM. It fires **once per submit**, not per
action.

**3. Standalone forms fire too.** Dispatch is unconditional; with no listener
attached nothing happens, so standalone output is unaffected and the two modes
stay on one code path.

**4. mailto "success" fires `submit-success`.** Consistent with decision 0002 /
existing UI, opening the mail client counts as success for the event as it does
for the success screen; the draft-retention nuance (the user may still cancel
the mail) is unchanged and not re-encoded in the event.

## Consequences

- `performSubmit` (`submit.ts`) gains the two dispatch points; it already
  receives the root/document, the `form`, and builds the `payload`. To carry the
  failure reason into `submit-error`, `performSubmit` uses the `message` already
  returned by `runActions` — no change to `actions.ts` is required.
- The same-origin iframe integration path is covered by the same mechanism (the
  parent attaches a listener to `iframe.contentDocument`), so no `postMessage`
  channel is added.
- A documented public event contract (names + `detail` shapes) for host-page and
  iframe integration; added to `docs/` alongside the fragment output docs.
- New tests assert both events fire with the correct `detail` on success and
  failure, and that they bubble to `document`.
