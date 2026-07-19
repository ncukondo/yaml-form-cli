# Task 0027: `eval` — headless `visible_when` evaluation

Status: done
Depends on: 0024
Parallel: yes (worktree-safe) — alongside 0025 (disjoint: eval vs embed pipeline)

## Goal

`yaml-form eval form.yaml --answers '<json>'` prints per-item visibility as
JSON, evaluated by the same code the generated HTML runs, so agents can test
rule behavior without a browser.

## Context

- Relevant decisions: `decisions/0016-rule-semantics-feedback.md`
- Reuse `src/runtime/visibility.ts` (`createVisibilityEvaluator` /
  `flattenAnswers`) — do not reimplement evaluation; the point is fidelity
  with the browser runtime
- Answers arrive in the nested raw shape (`RawAnswers`); `--answers` accepts
  an inline JSON string, `@file`, or `-` for stdin (input YAML must then be a
  file path, not `-`)
- Output: `{"ok":true,"visible":{"<item_id>":bool,...}}` covering every item
  (items without `visible_when` are `true`); invalid form → same error JSON
  and exit 1 as `validate`

## Scope

- `src/cli.ts` — `eval` subcommand (dispatch hook exists from 0024)
- `tests/cli/`
- `docs/reference.md` rules section — document the answers JSON shape and the
  test-loop workflow; `README.md` one-liner

## Out of scope

- Assertion flags (`--expect ...`) — agents compare JSON themselves
- Simulating URL prefill or draft restore as eval inputs

## TDD plan

1. **Red** — tests for: the README `talk_rubric.clarity` example —
   `{"talk_rubric":{"clarity":"1"}}` → `clarity_advice` true, `"2"` → false;
   empty answers → only unconditioned items true; nested rubric answers
   flatten correctly (incl. `comment_per_row`); malformed `--answers` JSON →
   exit 2 with a message naming the flag; invalid form → exit 1 with
   `validate`-shaped errors; `@file` and `-` answer sources.
2. **Green** — wire subcommand to `parseForm` + visibility evaluator.
3. **Refactor** — share form-loading/error-reporting with
   `generate`/`validate`.

## Acceptance criteria

- [ ] Visibility output for the README example matches actual behavior of
      the generated HTML for the same answers (spot-check via existing
      runtime tests' fixtures)
- [ ] Every item id appears exactly once in `visible`
- [ ] `--help` and `docs rules` describe the command and answers shape
- [ ] `bun test` and `bun run typecheck` pass

## Verification

- `bun test tests/cli`
- Manual: `bun src/cli.ts eval examples/sample.yaml --answers '{}'` and one
  answer that toggles a conditional item
