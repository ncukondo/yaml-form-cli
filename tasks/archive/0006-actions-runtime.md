# Task 0006: Submit actions runtime

Status: done
Depends on: 0003
Parallel: yes — group A (owns `src/runtime/submit*` / action modules)

## Goal

On submit, build the payload and run the configured actions with the decided
success/failure handling.

## Context

- Relevant decisions: `decisions/0002-actions.md`,
  `decisions/0007-submit-payload.md`

## Scope

- Payload builder: `payload_version`, `generator` (from package version at
  generation time), `form.{title,id?,version?}`, `submitted_at` (ISO 8601 with
  local offset), `answers`.
- Actions: `log` (console), `post` (fetch JSON, 2xx = success), `mailto`
  (plain-text body per decision 0002; URL-encode; open via location).
- Sequential execution, stop at first failure; success screen with
  `post_submit.message` (default text when unset); failure keeps the form and
  shows a retry-able error; retry re-runs all actions.

## Out of scope

- New action types.

## TDD plan

1. **Red** — tests: payload shape (snake_case keys, optional form.id/version
   omitted when unset, offset format); each action's success/failure paths
   (fetch mocked); ordering + stop-at-first-failure; success screen swap;
   mailto body text matches the documented format for nested/multiple
   answers.
2. **Green** — implement builder + runners.
3. **Refactor** — action interface so types share the run/report loop.

## Acceptance criteria

- [x] Sample form with `log` action logs the documented payload and shows the
      success message
- [x] `post` failure keeps input and allows retry
- [x] `bun test` and `bun run typecheck` pass

## Verification

- `bun test tests/runtime/actions`
- Manual: submit sample form; check console payload and success screen.

## Completion notes (2026-07-18)

- New `src/runtime/submit.ts`: `buildPayload` (snake_case payload per decision
  0007; `form.id`/`form.version` omitted when unset), `formatLocalIso`
  (ISO 8601 with local UTC offset), and `performSubmit` which builds the
  payload, runs the actions, and swaps in the success screen
  (`post_submit.message`, default "Your response has been submitted.") or
  shows a retry-able error ("Submission failed. Please try again.") while
  keeping the form and input intact. Retry (re-submit) re-runs all actions.
- New `src/runtime/actions.ts`: `ActionEnv` (log / fetch / openUrl,
  injectable for tests) and a per-type runner map sharing one sequential
  stop-at-first-failure loop (`runActions`). `post` sends JSON and treats
  non-2xx or a thrown fetch as failure; `mailto` builds the documented
  plain-text body (`buildMailtoBody`: item titles, indented table/rubric
  rows, `Title (value)` cell labels, `— comment` for per-row comments,
  unanswered items skipped) and opens the URL via `location.href`.
- Generator version is stamped at generation time into
  `<script type="application/json" id="yaml-form-meta">` (read by the
  runtime), so the runtime bundle itself stays version-independent.
  `src/generate/index.ts` also gained the `#yaml-form-error` /
  `#yaml-form-success` markup; `tsconfig.json` gained `resolveJsonModule`
  for the package.json version import.
- `initForm` success path now calls `performSubmit`; verified end-to-end by
  evaluating the actual minified inline bundle against a happy-dom document
  (happy-dom does not execute inline scripts under Bun).
