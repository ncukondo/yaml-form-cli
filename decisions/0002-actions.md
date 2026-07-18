# 0002: Typed submit actions and result handling

Date: 2026-07-18
Status: accepted

## Context

Earlier drafts encoded actions as URL-like strings (`log:`, `https://…`,
`mailto:…`). That is compact but not extensible (no per-action options such as
a mail subject).

## Decision

`actions` is an array of objects with an explicit `type` (a single mapping is
accepted as a one-element array):

- `log` — log the payload to the browser console; always succeeds.
- `post` — `POST` payload as JSON via `fetch`; success = HTTP 2xx.
- `mailto` — build a `mailto:` URL (`to`, optional `subject` defaulting to the
  form title) with a human-readable plain-text body using item titles
  (`Title: value`, nested items indented, choice values shown as
  `Level title (value)`); opening the mail client counts as success.

Result handling: actions run **sequentially, stopping at the first failure**.
On success of all actions, the form is replaced by a success screen showing
`post_submit.message`. On failure the form stays (input preserved) with an
error message; retry re-runs **all** actions, so endpoints should tolerate
duplicate delivery.

## Consequences

- New action types / options can be added without breaking the format.
- `mailto` limitations are documented: ~2000-char URL limit may truncate long
  forms; actual sending cannot be detected.
