# Task 0025: `docs` / `schema` / `example` subcommands (embedded knowledge)

Status: todo
Depends on: 0024
Parallel: yes (worktree-safe) — alongside 0027 (disjoint: embed pipeline vs eval)

## Goal

`yaml-form docs [<topic>]`, `yaml-form schema`, and `yaml-form example
[<name>]` print format knowledge to stdout from content embedded at build
time, so an `npx`/binary install is self-documenting offline.

## Context

- Relevant decisions: `decisions/0015-agent-cli-commands.md`
- Sources to embed: `docs/reference.md` (split into topics: e.g. `items`,
  `rules`, `actions`, `payload`), `schema/yaml-form.schema.json`,
  `examples/*.yaml`
- Embedding precedent: `scripts/build-runtime.ts` →
  `src/generate/runtime.generated.ts`; follow the same generated-module
  pattern and wire it into `bun run check` / `build:dist` the same way
- Topic splitting should key off `docs/reference.md` headings so doc
  restructuring fails the build loudly rather than silently dropping topics

## Scope

- `scripts/build-docs.ts` (new) + generated module under `src/`
- `src/cli.ts` — the three subcommands (dispatch hook exists from 0024)
- `tests/cli/`, `tests/docs/` as needed
- `package.json` scripts, `README.md`

## Out of scope

- Writing new documentation content — embed what exists; content gaps are
  ordinary docs work
- `docs rules` additions for `eval` usage (0027 owns that doc edit)

## TDD plan

1. **Red** — tests for: `schema` output parses as JSON and equals the built
   schema file; `docs` with no topic lists topics; `docs rules` contains a
   known sentinel string from the rules section; unknown topic/example exits
   2 listing valid names; `example` output parses as valid form YAML
   (round-trip through `parseForm`).
2. **Green** — build script + generated module + subcommands.
3. **Refactor** — ensure a stale generated module (docs edited, build not
   run) is caught by `bun run check`.

## Acceptance criteria

- [ ] All three subcommands work from the built binary with no repo present
- [ ] `yaml-form example | yaml-form validate -` exits 0
- [ ] `--help` gains the one-line pointers to `docs` / `example` per the
      help-vs-docs split in decision 0015
- [ ] `bun test` and `bun run typecheck` pass; `bun run check` regenerates or
      verifies the embedded content

## Verification

- `bun test tests/cli tests/docs`
- Manual: `bun run build:dist` then run the dist binary's `docs rules` in an
  empty directory
