# 0014: Draft autosave to localStorage

Date: 2026-07-18
Status: accepted

## Context

Forms are filled in one sitting with no server; closing the tab loses all
input. Respondents on distribution URLs (decision 0013) should be able to
reopen *their* URL and continue, but must never see a draft belonging to a
different distribution URL (a different respondent's parameters). localStorage
is the only storage available to a self-contained page — with the caveat that
on `file://`, some browsers give all local files one shared origin, so keys
must carry the form's identity.

## Decision

**Autosave is on by default**; a form-level `autosave: false` turns it off.

### Storage key

```
yaml-form:draft:<form.id ?? title>:<form.version ?? "">:<param signature>
```

- The param signature is the canonical serialization of the *recognized*
  prefill parameters (decision 0013's valid-key set): sorted by key, repeated
  values kept in order, unknown parameters excluded. "Same URL parameters as
  last time" is therefore not a comparison step — a different distribution
  URL simply produces a different key and finds no draft, while irrelevant
  query noise does not fragment drafts.
- Including `version` means a redistributed, updated form never restores a
  draft whose answer shapes may no longer match.
- Docs recommend setting `form.id` when autosave matters: the `title`
  fallback is weaker on `file://` where all local files may share one origin.

### Saving

- Saving starts at the first user edit (the existing `change`/`input` paths)
  — an untouched form writes nothing, so only dirty forms leave a draft.
  Writes are debounced (~300 ms) and flushed on `pagehide`.
- The stored value is `{ saved_at, answers }` with answers in the raw-answers
  shape (text, selections, table rows, rubric comments). `constant` values
  are not stored — they come from the YAML/URL.
- On init, drafts under the `yaml-form:draft:` prefix older than 30 days are
  pruned, bounding growth on the shared `file://` origin.

### Restoring

- Init order: URL prefill → draft overlay → first visibility pass. A key hit
  implies the parameters match, so `from_url` constant overrides are
  identical either way; the draft (the later state) wins for overlapping
  fields, reusing 0013's value-application machinery.
- Restoring is announced, not silent: a `role="status"` notice ("Restored
  your previous answers") with a **discard** button. Discard removes the
  draft and reloads the page — same URL, no draft → pristine prefilled state.
  Two new message keys (`draft_restored`, `draft_discard`) join the i18n
  bundles and `messages` overrides (decision 0010).
- Stale or malformed drafts (JSON errors, unknown item ids, values no longer
  in the choice set) degrade exactly like prefill: apply what matches, ignore
  the rest, never break rendering.

### Clearing

- The draft is deleted when the submit flow reaches the **success** state —
  **except when the form's actions include `mailto`**. Mailto "succeeds" the
  moment the mail client opens (`src/runtime/actions.ts`), but the user may
  still cancel the mail; keeping the draft means a reload recovers their
  answers. Such drafts linger until overwritten, pruned (30 days), or
  discarded via the notice — accepted trade-off.
- Any storage failure (privacy mode, quota, disabled) disables autosave
  silently for the session; the form itself is unaffected.

## Consequences

- New runtime module (draft store + wiring in `initForm`), a notice slot in
  the generated page skeleton, `autosave` in the schema/JSON Schema, two new
  message keys in both bundles — task 0023, which depends on 0022 for the
  key enumeration and value application it reuses.
- Answers persist in the browser profile until submit/pruning. Docs must warn
  about shared/kiosk devices and point to `autosave: false`.
- Renaming `form.id`, `version`, or choice `value`s orphans existing drafts
  (they stop matching) — same stability class as 0013's parameter interface.
