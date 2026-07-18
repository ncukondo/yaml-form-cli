# Task 0010: Release docs verification

Status: done (2026-07-18)
Depends on: 0009
Parallel: no

## Goal

Before the first release, user-facing docs match the implemented behavior
exactly, with install instructions verified against real artifacts.

## Context

- Relevant decisions: `decisions/0009-development-process.md`
- Docs were written spec-first (`docs/reference.md`, `README.md`); this task
  is the final sweep against reality.

## Scope

- Walk `docs/reference.md` and `README.md` against the shipped behavior:
  every YAML field, error message category, action behavior, payload example
  (regenerate examples from actual output rather than by hand).
- Verify install/run instructions (`bunx`, `npx`, binary download, `upgrade`)
  on a clean environment.
- Confirm `decisions/archive/SPEC.md` contains nothing user-facing that is
  missing from `docs/`.

## Out of scope

- New features discovered missing — file them as new tasks/decisions.

## TDD plan

Not code-driven; the "tests" are the doc walkthrough checklist above plus the
example regeneration (which should be scripted so docs examples can't drift:
consider a test that regenerates payload examples and diffs them against the
docs).

## Acceptance criteria

- [x] Every documented behavior demonstrated against the release candidate
- [x] Payload / mailto examples in docs are generated output, not hand-written
- [x] Install instructions verified on a machine without the repo (npm pack → node-only global install; registry/bunx and binary download verifiable only after the first published release)

## Notes on completion

- `tests/docs/examples.test.ts` pins the three docs/reference.md examples
  (submitted data shape, payload, mailto body) byte/data-equal to actual
  runtime output from an equivalent fixture form — docs can no longer drift.
- Full docs-vs-implementation audit (subagent, every src/ file + empirical
  rule-engine checks): no incorrect factual claims. Three precision issues
  found and fixed: CLI upgrade help text synced with actual USAGE; text
  inputs now re-evaluate visible_when on "input" (per keystroke), matching
  the "live" claim; comment_per_row docs note that value/comment are each
  omitted when unset and an empty row is omitted.
- README rewritten for release (install via bunx/npx `@ncukondo/yaml-form`,
  binaries, usage, annotated YAML example — example verified to parse and
  generate). `decisions/archive/SPEC.md` contains nothing user-facing that is
  missing from docs/.
- Cosmetic: dead `.placeholder` CSS removed, stale test name updated.

## Verification

- Checklist in this file completed; discrepancies fixed or filed.
