# Task 0026: `visible_when` value-domain check

Status: done
Depends on: —
Parallel: yes (worktree-safe) — alongside 0024 (disjoint: schema layer vs CLI entry)

## Goal

Rules comparing a choice-derived key against a literal no choice can produce
fail generation with `rule_value_unreachable`, naming the actual choice
values.

## Context

- Relevant decisions: `decisions/0016-rule-semantics-feedback.md` (what is
  checked, what is exempt), `decisions/0006-visible-when.md`
- Extend `src/schema/rule-keys.ts` (which already walks parsed rules via
  `@ncukondo/dynamic-form-rules`); error plumbing in `src/schema/errors.ts`
- Domain derivation mirrors `answerKeys()`: `choice` → its values;
  `choice_table`/`rubric` rows → the table's shared scale values;
  `.comment` and free-text keys exempt
- Check literal operands of equality/`in`/`includes`-style operators; skip
  regex/`matches`. Consult the engine's parsed-rule shape
  (`safeParseSource`) for how operands are represented — decision 0006 notes
  the engine README lags its source

## Scope

- `src/schema/rule-keys.ts`, `src/schema/errors.ts`
- `tests/schema/`
- `docs/reference.md` rules section (mention the check)

## Out of scope

- `eval` command (0027)
- Did-you-mean suggestions on unknown keys/values (nice-to-have; separate
  task if wanted)

## TDD plan

1. **Red** — tests for: literal not in choice values → error naming the
   choices; case mismatch caught; `in [...]` with one bad member caught and
   the member named; valid literals pass; free-text keys never flagged;
   choice_table/rubric row keys resolve to the shared scale;
   `comment_per_row` `.value`/`.comment` split handled; choices given as
   `{title, value}` check against `value`, not `title`.
2. **Green** — domain map + operand walk in `checkRuleKeys`.
3. **Refactor** — share key→item resolution between the existence check and
   the domain check.

## Acceptance criteria

- [ ] The `role = "Student"` / `[student, resident, faculty]` case from
      decision 0016 fails generation with choices listed in the message
- [ ] Message points at `yaml-form eval` for behavioral verification
- [ ] No false positives across `examples/` and existing test fixtures
- [ ] `bun test` and `bun run typecheck` pass; docs updated

## Verification

- `bun test tests/schema` — the cases above
- `bun src/cli.ts generate examples/sample.yaml > /dev/null` — still
  generates (bare invocation form if 0024 hasn't merged into this worktree)
