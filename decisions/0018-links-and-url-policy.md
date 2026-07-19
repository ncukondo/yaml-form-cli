# 0018: Links and URL policy — structured `links`, relative-aware autolink, `post` relative URLs

Date: 2026-07-20
Status: accepted

## Context

Three issues are all facets of one question — how URLs and links are authored
and rendered:

- **#32**: `post_submit.message` is inserted via `textContent`, so a URL in it
  stays plain text; there is no way to place a labeled "next form" link on the
  success screen.
- **#34**: `description` autolinking hardcodes
  `target="_blank" rel="noopener noreferrer"`; a same-site "back to list" link
  opens a new tab every time — bad for a 148-form serial-scoring flow.
- **#35**: `post.url` uses `z.url()`, rejecting relative URLs like
  `/api/submit`, so a form served and posted on the same origin cannot be
  reused unchanged across localhost preview and production.

Underlying gaps: the autolink regex (`escape.ts`) matches `https?://` only, so
**relative URLs are never linkified**; and any richer authoring (explicit link
objects, markdown) would introduce a `javascript:` / `data:` injection surface
into what is otherwise a safe, self-contained HTML artifact.

The tool is frequently driven by AI agents writing/editing YAML. That favors
notations that are **schema-validatable, unambiguous, and safe to edit as
structured data** over free-form string conventions.

## Decision

**1. Structured `links` as the blessed mechanism for discrete navigation.**
Both #32 and #34's real need is a discrete, labeled navigation target, not an
inline prose link. Add:

```yaml
links:                       # top-level: rendered in the form header area
  - { title: "Back to list", url: "/index.html" }
post_submit:
  message: "Saved."
  links:                     # success-screen navigation ("next record")
    - { title: "Next record", url: "./r002.html" }
```

Each link is `{ title, url, target? }`. Chosen over inline markdown because a
structured field is self-documenting via `schema`/`docs`, validated per-field
(URL scheme enforced on `url`), and safely machine-editable (array ops, not
string surgery). Markdown is explicitly **rejected**: unvalidatable, overlaps
the bare-URL autolink, and carries escaping hazards, with no real gain here.

**2. Relative-aware bare-URL autolink, retained.** `renderText` keeps
autolinking bare URLs in `description` (and message text), extended to
recognize root/relative/`./`/`../` paths in addition to `http(s)://`. This
stays the zero-friction path for incidental URLs in prose.

**3. Target policy.** Default `target` is derived from the URL:
relative / same-document URLs → same tab (`_self`); absolute URLs → new tab
(`target="_blank" rel="noopener noreferrer"`). A structured link may override
with `target: self | blank`. This makes #34's "relative = same tab" the
default without needing runtime origin detection (the serving origin is
unknown at generate time).

**4. URL scheme allowlist (security).** Every rendered `href` — autolinked or
structured — must be `http`, `https`, `mailto`, or a relative reference
(`/…`, `./…`, `../…`, `#…`, `?…`). Anything else (`javascript:`, `data:`, …)
is a **generation error** for structured `links`, and simply not linkified for
bare-URL autolink. Preserves the "safe self-contained HTML" guarantee.

**5. `post` relative URLs (#35).** `post.url` accepts a relative reference in
addition to an absolute `http(s)` URL; at submit time it is resolved against
the page with `new URL(url, location.href)`. Under `file://` the resolved URL
is unfetchable and surfaces the existing post-failure UI — same as an
unreachable absolute URL today.

## Consequences

- New schema surface: top-level `links`, `post_submit.links`, a relaxed
  `post.url` validator, plus a shared URL-classification/allowlist helper
  reused by autolink, structured links, and `post.url`. JSON Schema
  (decision 0008) and docs (`top-level`, `actions`, `post_submit`) regenerate.
- `escape.ts` `renderText` gains relative-URL matching and target derivation;
  the success-screen renderer (`submit.ts`) and the header renderer
  (`generate/index.ts`) render the `links` list.
- One coherent link model across description, success screen, and post target,
  documented once — cheaper to test and to explain to agents than three
  ad-hoc behaviors.
- `post.url` resolution is deferred to runtime; build-time absolute URLs remain
  valid, so existing forms are unaffected (backward compatible).
