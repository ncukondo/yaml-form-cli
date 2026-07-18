# 0003: `id` is required on every item

Date: 2026-07-18
Status: accepted

## Context

Submitted data and `visible_when` rules reference items by key. Deriving keys
from titles makes both fragile against wording changes.

## Decision

Every form item must declare an `id`, unique across the form. It is the key in
submitted `answers` and the key referenced by `visible_when`.

Exception at the row level: `choice_table` / `rubric` rows may omit `id`, in
which case the row **title** serves as the key and is subject to the same
constraints as an `id` (unique within the item).

## Consequences

- Renaming a title never silently changes data keys (except row titles used as
  keys — authors opting into that convenience accept the coupling).
- Generation fails on duplicate ids.
