# Task 0028: `robots` meta output (`noindex` / `nofollow`)

Status: done
Depends on: —
Parallel: no (shares `form-schema.ts` + JSON Schema regen + embedded docs with 0029/0030; no logical dependency — order is free) — otherwise disjoint

## Goal

Generated forms emit `<meta name="robots" content="noindex, nofollow">` by
default, with per-directive opt-out via top-level `noindex` / `nofollow`
booleans (issue #33).

## Context

- Relevant decisions: `decisions/0017-robots-meta.md`
- Relevant docs: `docs/reference.md` (top-level table), embedded `top-level`
- `<head>` is assembled in `src/generate/index.ts` (currently only `charset`,
  `viewport`, `title`, styles).

## Scope

- `src/schema/form-schema.ts` — add `noindex: z.boolean().default(true)` and
  `nofollow: z.boolean().default(true)` to `formSchema`.
- `src/generate/index.ts` — emit the combined `robots` meta per the truth
  table; emit nothing when both are false.
- JSON Schema regen (`scripts/build-schema.ts` → `embedded.generated.ts`).
- Docs: top-level field table.

## Out of scope

- Any link/URL behavior (owned by 0029/0030).

## TDD plan

1. **Red** — generator tests: default form → head contains
   `content="noindex, nofollow"`; `noindex: false` → `content="nofollow"`;
   `nofollow: false` → `content="noindex"`; both false → no `robots` meta.
   Schema test: fields default to `true`; non-boolean rejected.
2. **Green** — add fields + head emission.
3. **Refactor** — factor the content-string builder if it clarifies.

## Acceptance criteria

- [ ] Default output includes `<meta name="robots" content="noindex, nofollow">`
- [ ] Each opt-out combination yields the documented `content` (or no tag)
- [ ] JSON Schema and top-level docs list `noindex` / `nofollow` (default true)
- [ ] `bun test` and `bun run typecheck` pass
- [ ] Affected docs updated

## Verification

- `bun test tests/generate/document.test.ts` — head/meta assertions
- Generate a sample and grep the `<head>` for the `robots` meta
