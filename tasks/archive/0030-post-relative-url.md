# Task 0030: `post` action relative URL

Status: done
Depends on: 0029 (reuses the URL-policy allowlist/classifier helper)
Parallel: no (shares `form-schema.ts` + JSON Schema regen + docs; depends on 0029's helper)

## Goal

`post.url` accepts a relative reference (`/api/submit`, `./submit`) in addition
to an absolute `http(s)` URL, resolved at submit time against the page URL, so
one generated form works unchanged on localhost preview and production
(issue #35).

## Context

- Relevant decisions: `decisions/0018-links-and-url-policy.md`
- Relevant docs: `docs/reference.md` (Actions), embedded `actions`
- `src/schema/form-schema.ts` — `post` action currently `url: z.url()`.
- `src/runtime/actions.ts` — where the `post` action issues `fetch`.

## Scope

- `src/schema/form-schema.ts` — relax `post.url` to accept absolute `http(s)`
  **or** a relative reference, validated via task 0029's helper; disallowed
  schemes (`javascript:` etc.) stay rejected.
- `src/runtime/actions.ts` — resolve with `new URL(url, location.href)` before
  `fetch`; a `file://`-resolved URL that cannot be fetched surfaces the
  existing post-failure UI (no new error path).
- JSON Schema regen + Actions docs.

## Out of scope

- Link rendering / autolink (task 0029).

## TDD plan

1. **Red** — schema: `url: "/api/submit"` and `"./submit"` accepted;
   `url: "javascript:…"` rejected; absolute `http(s)` still accepted. Runtime:
   posting resolves the relative URL against `location.href` and fetches the
   absolute result; failure keeps the form with the retry message.
2. **Green** — relax validator (reuse 0029 helper), resolve at fetch time.
3. **Refactor** — no second URL-classification implementation; import 0029's.

## Acceptance criteria

- [ ] Relative `post.url` validates and, at submit, POSTs to the page-resolved URL
- [ ] Absolute `http(s)` `post.url` unchanged (backward compatible)
- [ ] Disallowed schemes rejected at generation
- [ ] Actions docs note relative-URL support and the `file://` caveat
- [ ] `bun test` and `bun run typecheck` pass

## Verification

- `bun test tests/schema tests/generate/runtime.test.ts`
- Generate a form with `post.url: /api/submit`, serve it, and confirm the POST
  hits `<origin>/api/submit`
