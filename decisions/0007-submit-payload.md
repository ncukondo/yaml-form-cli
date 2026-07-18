# 0007: Submit payload shape

Date: 2026-07-18
Status: accepted

## Context

`log`, `post`, and (serialized as text) `mailto` share one payload. Receivers
read both the YAML and the payload, so naming should be consistent, and
payloads should be identifiable and evolvable.

## Decision

```jsonc
{
  "payload_version": 1,                        // payload schema version
  "generator": "yaml-form/1.2.3",              // tool name/version
  "form": {
    "title": "Test Form",
    "id": "test_form",                         // only when set in the YAML (optional)
    "version": "2.0"                           // only when set in the YAML (optional)
  },
  "submitted_at": "2026-07-18T21:34:56+09:00", // ISO 8601, client clock, local offset
  "answers": { /* keyed by item id */ }
}
```

- Keys are **snake_case**, matching the YAML schema.
- `submitted_at` keeps the client's **local UTC offset** (normalizing to UTC
  loses information; receivers can convert).
- YAML gains optional top-level `id` and `version`, echoed as `form.id` /
  `form.version` for stable routing on the receiving side.
- `answers` contains machine-readable values only (no titles); human-readable
  rendering is the mailto body's job.

## Consequences

- Endpoints can branch on `payload_version` / `form.id` without parsing
  titles.
