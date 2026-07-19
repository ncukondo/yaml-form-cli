# Task 0029: Link policy — structured `links`, relative-aware autolink, target, scheme allowlist

Status: done
Depends on: —
Parallel: no (shares `form-schema.ts` + JSON Schema regen + embedded docs with 0028/0030) — provides the URL-policy helper 0030 consumes, so land before 0030

## Goal

Author labeled navigation links via structured `links` on the top level and on
`post_submit`; autolink relative URLs (not just `http(s)`) in text; derive link
target (relative → same tab, absolute → new tab, overridable); enforce a URL
scheme allowlist everywhere (issues #32, #34).

## Context

- Relevant decisions: `decisions/0018-links-and-url-policy.md`
- Relevant docs: `docs/reference.md` (top-level, `post_submit`), embedded
  `top-level` / `payload`/`actions` neighbors
- `src/generate/escape.ts` — `renderText` currently autolinks `https?://` only
  and hardcodes `target="_blank"`.
- `src/generate/index.ts` — renders `description`; header is where top-level
  `links` render.
- `src/runtime/submit.ts` — `showSuccess` sets `.success-message` via
  `textContent`; success-screen `links` render here.

## Scope

- New shared helper (e.g. `src/generate/url-policy.ts` or `src/schema/url.ts`):
  classify a URL as relative | absolute-http(s) | mailto | disallowed; expose
  the allowlist check reused by 0030.
- `src/schema/form-schema.ts` — `links` link-object array (`{ title, url,
  target? }`) on top level and inside `post_submit`; `url` validated against
  the allowlist (disallowed scheme → generation error); `target` = `self` |
  `blank` optional.
- `src/generate/escape.ts` — add `renderLink({title,url,target?})` → `<a>`
  with target/rel derived from URL classification (relative → `_self`,
  absolute → `_blank rel="noopener noreferrer"`), override via `target`.
  `renderText` (bare-URL autolink) stays absolute-only, unchanged.
- `src/generate/index.ts` — render top-level `links` in the header AND
  `post_submit.links` statically inside the success section (revealed by the
  runtime on success, no runtime DOM building).
- JSON Schema regen + docs.

## Out of scope

- `post.url` relative resolution (task 0030 — reuses this task's helper).
- Markdown link syntax (rejected in decision 0018).

## TDD plan

1. **Red** —
   - schema: valid `links` accepted; `javascript:`/`data:` `url` → generation
     error; `target` restricted to `self`/`blank`.
   - `renderLink`: relative URL → no `_blank`; absolute → `_blank`+`rel`;
     `target` override wins.
   - generate: top-level `links` render as `<a>` in the header; disallowed
     URL never reaches `href` (generation error at schema layer).
   - generate: `post_submit.links` render inside the success section markup.
2. **Green** — helper, schema, renderers.
3. **Refactor** — ensure autolink, structured links, and 0030 share one
   allowlist/classifier; no duplicated scheme logic.

## Acceptance criteria

- [ ] `links: [{title,url,target?}]` render as links on header and success screen
- [ ] Relative URLs autolink in `description`; relative → same tab, absolute → new tab
- [ ] `target: self|blank` overrides the derived default
- [ ] Disallowed schemes are a generation error (structured) / not linkified (autolink)
- [ ] JSON Schema and docs updated; `bun test` and `bun run typecheck` pass

## Verification

- `bun test tests/generate/document.test.ts tests/generate/runtime.test.ts`
- Generate a form with header + `post_submit` links and open it: relative link
  stays in-tab, absolute opens a new tab, success screen link is clickable
