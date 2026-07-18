# Task 0006: Submit actions runtime

Status: todo
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

- [ ] Sample form with `log` action logs the documented payload and shows the
      success message
- [ ] `post` failure keeps input and allows retry
- [ ] `bun test` and `bun run typecheck` pass

## Verification

- `bun test tests/runtime/actions`
- Manual: submit sample form; check console payload and success screen.
