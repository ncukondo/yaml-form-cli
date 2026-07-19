# Task 0029: Link policy — structured `links`, relative-aware autolink, target, scheme allowlist

Status: todo (move to `tasks/archive/` when done)
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
- `src/generate/escape.ts` — extend autolink to relative refs; derive target
  (relative → `_self`, absolute → `_blank rel="noopener noreferrer"`).
- `src/generate/index.ts` — render top-level `links` list in the header.
- `src/runtime/submit.ts` — render `post_submit.links` on the success screen
  (structured DOM nodes, not `textContent`, with the same target policy).
- JSON Schema regen + docs.

## Out of scope

- `post.url` relative resolution (task 0030 — reuses this task's helper).
- Markdown link syntax (rejected in decision 0018).

## TDD plan

1. **Red** —
   - schema: valid `links` accepted; `javascript:`/`data:` `url` → generation
     error; `target` restricted to `self`/`blank`.
   - autolink: `renderText` links `/path`, `./x`, `../y` and `http(s)`; a
     relative link gets no `_blank`, an absolute one keeps `_blank`+`rel`.
   - generate: top-level `links` render as `<a>` with derived/overridden
     target; disallowed URL never reaches `href`.
   - runtime: success screen shows `post_submit.links` as clickable links
     (extend `tests/generate/runtime.test.ts` / submit flow tests).
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
