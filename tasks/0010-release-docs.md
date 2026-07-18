# Task 0010: Release docs verification

Status: todo
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

- [ ] Every documented behavior demonstrated against the release candidate
- [ ] Payload / mailto examples in docs are generated output, not hand-written
- [ ] Install instructions verified on a machine without the repo

## Verification

- Checklist in this file completed; discrepancies fixed or filed.
