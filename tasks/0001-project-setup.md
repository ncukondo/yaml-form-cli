# Task 0001: Project setup

Status: todo
Depends on: —
Parallel: no (everything depends on it)

## Goal

A working Bun + TypeScript skeleton where `bun test`, `bun run typecheck`, and
lint/format run locally and in CI.

## Context

- Relevant decisions: `decisions/0009-development-process.md`
- `package.json` / `tsconfig.json` already exist (strict TS, bun-types).

## Scope

- `src/` and `tests/` scaffold (entry module + one placeholder test).
- Lint/format tooling (proposal: Biome — single fast tool, works well with
  Bun; decide here and record if it deviates).
- GitHub Actions CI: install, typecheck, lint, test on push/PR.
- `.gitignore`, `bun.lock` committed.

## Out of scope

- Any product code (task 0002+).
- Release workflow (task 0009).

## TDD plan

1. **Red** — a placeholder test importing from `src/` fails to compile/run.
2. **Green** — scaffold module; test passes.
3. **Refactor** — wire scripts (`lint`, `format`, `check`) into package.json.

## Acceptance criteria

- [ ] `bun install && bun test && bun run typecheck && bun run lint` all pass
- [ ] CI runs the same steps on push
- [ ] `bun test` and `bun run typecheck` pass

## Verification

- Fresh clone → `bun install && bun run check` succeeds.
