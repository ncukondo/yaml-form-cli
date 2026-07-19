# 0017: `robots` meta — `noindex, nofollow` by default, per-directive opt-out

Date: 2026-07-20
Status: accepted

## Context

yaml-form's primary use is research/survey forms distributed to a known set
of respondents via unguessable URLs (decision 0013's per-respondent
distribution), often on static hosting or `file://` where response headers
like `X-Robots-Tag` cannot be controlled. Such forms should not be indexed by
search engines. Today the generated `<head>` emits no `robots` meta and there
is no option to add one (issue #33).

`noindex` (do not index this page) and `nofollow` (do not crawl/pass equity to
this page's outbound links) are **independent axes**. Bundling them into one
switch removes a legitimate choice: a form whose `description` cites a public
resource it wants credited may want `noindex` without `nofollow`. For the
private-distribution threat model, `nofollow` is otherwise beneficial — if a
crawler ever reaches the form it will not discover linked private forms/lists
through the link graph.

There is effectively no in-the-wild install yet, so defaulting to
`noindex, nofollow` is not a disruptive regeneration-time behavior change.

## Decision

Emit search-engine directives into the generated `<head>`, controlled by two
top-level booleans, **both defaulting to `true`**:

```yaml
noindex: true    # default; set false to allow indexing
nofollow: true   # default; set false to allow link following
```

Output rules for the combined `<meta name="robots" content="…">`:

- both true (default) → `content="noindex, nofollow"`
- `noindex: false`, `nofollow: true` → `content="nofollow"`
- `noindex: true`, `nofollow: false` → `content="noindex"`
- both false → **no `robots` meta emitted** (default browser/crawler behavior
  = index, follow), keeping fully-public forms clean.

The directives are page-level only; they never affect a respondent's ability
to click links (see decision 0018 for link behavior).

## Consequences

- Newly generated forms are unindexed and non-link-following unless the author
  explicitly opts a directive back in — the safe default for private research
  distribution.
- Authors publishing a public form set `noindex: false` (and usually
  `nofollow: false`) to restore indexing.
- Two new top-level schema fields; JSON Schema (decision 0008) and the
  top-level docs table must be regenerated/updated.
- Because it lives in the generated HTML, the directive travels with the file
  to any host, including `file://`, unlike a server header.
