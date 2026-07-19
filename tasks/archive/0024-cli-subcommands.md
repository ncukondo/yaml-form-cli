# Task 0024: CLI subcommands, `validate`, `--json`, exit codes

Status: done
Depends on: —
Parallel: yes (worktree-safe) — alongside 0026 (disjoint: CLI entry vs schema layer)

## Goal

`yaml-form` becomes subcommand-only (`generate` / `validate` / `upgrade`; the
bare `yaml-form <input.yaml>` form is dropped), with a `--json` structured
output mode and the documented `0/1/2` exit-code convention.

## Context

- Relevant decisions: `decisions/0015-agent-cli-commands.md`
- Current entry point: `src/cli.ts` (hand-rolled `parseArgs`, `USAGE` string)
- Error shape to reuse in JSON output: `src/schema/errors.ts` (`FormError`)
- `docs` / `schema` / `example` subcommands are task 0025; `eval` is 0027.
  This task must leave dispatch open for them (unknown subcommand → usage
  error listing known ones).

## Scope

- `src/cli.ts` — subcommand dispatch, `validate`, `--json`, exit codes, help
- `tests/cli/` — new/updated CLI tests
- `README.md` Usage section, `docs/reference.md` if it mentions invocation

## Out of scope

- `docs` / `schema` / `example` subcommands (0025)
- `eval` (0027), value-domain check (0026)
- YAML line/column in errors, `inspect` (deferred per decision 0015)

## TDD plan

1. **Red** — tests for: `generate in.yaml -o out.html` works; bare
   `yaml-form in.yaml` exits 2 with a hint to use `generate`; `validate`
   exits 0 on valid input and
   1 on invalid with **all** errors reported; `--json` emits
   `{"ok":true,...}` / `{"ok":false,"errors":[{code,path,message}]}` as the
   only stdout; usage errors (unknown option/subcommand, missing arg) exit 2;
   `-` reads stdin for both `generate` and `validate`.
2. **Green** — implement dispatch + `validate` (thin wrapper over
   `parseForm`) + JSON emitter.
3. **Refactor** — one shared "run command, report result" path so `--json`
   and human output can't diverge; rewrite `USAGE` to the decision-0015 help
   contract (all subcommands, flags, exit codes, stdin/stdout conventions,
   one screen).

## Acceptance criteria

- [ ] `yaml-form validate bad.yaml --json` exits 1 and prints machine-parseable
      errors covering every problem in the file
- [ ] `yaml-form generate` produces the same HTML the old bare form did;
      the bare form itself exits 2 with a `generate` hint
- [ ] Exit codes 0/1/2 as specified and stated in `--help`
- [ ] `bun test` and `bun run typecheck` pass
- [ ] README usage block and `--help` match

## Verification

- `bun test tests/cli` — dispatch, exit codes, JSON shapes
- Manual: `echo 'items: []' | bun src/cli.ts validate - --json; echo $?`
